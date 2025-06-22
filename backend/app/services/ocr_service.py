# In backend/app/services/ocr_service.py

import os
import time
import logging
import asyncio
import fitz  # PyMuPDF
import hashlib
from datetime import datetime
from typing import Tuple, List, Optional, Dict, Any, Union
import concurrent.futures
import httpx
import numpy as np
from openai import AsyncOpenAI
import google.generativeai as genai
from functools import partial
from concurrent.futures import ThreadPoolExecutor, as_completed
import aiohttp
import base64
import io
from PIL import Image

# Configure Gemini
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise ValueError("GOOGLE_API_KEY environment variable not set")

genai.configure(api_key=GOOGLE_API_KEY)

# Initialize Gemini model
GEMINI_MODEL = "gemini-1.5-flash"
GEMINI_CONFIG = {
    "temperature": 0.3,
    "top_p": 0.95,
    "top_k": 40,
    "max_output_tokens": 8192,
}

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Constants
MAX_WORKERS = min(32, (os.cpu_count() or 4) * 4)
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIM = 128  # Reduced dimensions for speed
MAX_RETRIES = 3
REQUEST_TIMEOUT = 10.0

# Database imports
from app.db.mongodb import documents_collection, embeddings_collection

class OCRService:
    """High-performance OCR and document processing service with parallel processing."""
    
    def __init__(self):
        """Initialize the OCR service with optimized settings."""
        self.openai_client = AsyncOpenAI(
            api_key=os.getenv("OPENAI_API_KEY"),
            timeout=httpx.Timeout(30.0, connect=5.0),
            max_retries=2
        )
        self.session = None  # Will be initialized in async context
        self.semaphore = asyncio.Semaphore(MAX_WORKERS * 2)  # Control concurrency
    
    async def extract_text_from_pdf(self, file_path: str, user_id: Optional[str] = None, 
                                 document_hash: Optional[str] = None, 
                                 max_pages: Optional[int] = None) -> Tuple[str, bool]:
        """
        Ultra-fast parallel text extraction from PDFs with optimized fallback to OCR.
        
        Args:
            file_path: Path to the PDF file
            user_id: Optional user ID for logging
            document_hash: Optional document hash for caching
            max_pages: Maximum number of pages to process
            
        Returns:
            Tuple of (extracted_text, is_digital_pdf)
        """
        start_time = time.time()
        
        try:
            # Read the entire PDF into memory once
            with open(file_path, 'rb') as f:
                pdf_data = f.read()
                
            # First try direct text extraction (fast path for digital PDFs)
            with fitz.open(stream=pdf_data, filetype="pdf") as doc:
                total_pages = len(doc)
                pages_to_process = min(total_pages, max_pages) if max_pages else total_pages
                
                # Check if document has extractable text
                if doc[0].get_text().strip():
                    logger.info(f"Digital PDF detected - extracting text directly")
                    
                    # Process pages in parallel
                    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
                        # Process pages in batches to avoid memory issues
                        batch_size = 50
                        page_texts = []
                        
                        for i in range(0, pages_to_process, batch_size):
                            batch = range(i, min(i + batch_size, pages_to_process))
                            batch_texts = list(executor.map(
                                lambda p: doc[p].get_text("text").strip(),
                                batch
                            ))
                            page_texts.extend(batch_texts)
                    
                    combined_text = "\n\n--- PAGE BREAK ---\n\n".join(page_texts)
                    elapsed = time.time() - start_time
                    logger.info(f"Extracted text from {len(page_texts)} pages in {elapsed:.2f}s")
                    return combined_text, True
            
            # If we get here, direct extraction failed - fall back to OCR
            logger.info(f"Falling back to OCR for {file_path}")
            
            # Process pages with OCR in parallel
            page_chunks = split_pdf_to_pages(pdf_data, max_pages=pages_to_process)
            
            # Process pages in parallel with semaphore for concurrency control
            async with aiohttp.ClientSession() as session:
                self.session = session
                tasks = [
                    self._process_page_with_ocr(chunk, i, len(page_chunks))
                    for i, chunk in enumerate(page_chunks)
                ]
                page_texts = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Filter out any failed pages
            page_texts = [
                str(t) if not isinstance(t, Exception) else "" 
                for t in page_texts
            ]
            
            combined_text = "\n\n--- PAGE BREAK ---\n\n".join(page_texts)
            elapsed = time.time() - start_time
            logger.info(f"Processed {len(page_texts)} pages with OCR in {elapsed:.2f}s")
            
            return combined_text, False
            
        except Exception as e:
            logger.error(f"Error in extract_text_from_pdf: {str(e)}", exc_info=True)
            return "", False
    
    def _convert_pdf_page_to_image(self, page_bytes: bytes) -> Optional[Image.Image]:
        """Convert a PDF page to a PIL Image."""
        try:
            with fitz.open(stream=page_bytes, filetype="pdf") as doc:
                if len(doc) == 0:
                    return None
                
                # Get the first page
                page = doc[0]
                
                # Render page as image with high DPI for better OCR
                mat = fitz.Matrix(300/72, 300/72)  # 300 DPI
                pix = page.get_pixmap(matrix=mat)
                
                # Convert to PIL Image
                img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                return img
                
        except Exception as e:
            logger.error(f"Error converting PDF page to image: {str(e)}")
            return None
    
    async def _extract_text_with_gemini(self, image: Image.Image) -> str:
        """Extract text from an image using Gemini 1.5 Flash."""
        try:
            # Convert image to base64
            buffered = io.BytesIO()
            image.save(buffered, format="PNG")
            img_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
            
            # Initialize Gemini model
            model = genai.GenerativeModel(GEMINI_MODEL)
            
            # Prepare the prompt
            prompt = """Extract all text from this image exactly as it appears, 
            including formatting, tables, and structure. Preserve line breaks, 
            bullet points, and special characters. If the image contains no text, 
            return '[NO_TEXT_FOUND]'."""
            
            # Create message parts
            message_parts = [
                {"text": prompt},
                {"inline_data": {
                    "mime_type": "image/png",
                    "data": img_base64
                }}
            ]
            
            # Generate content
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: model.generate_content(
                    contents=message_parts,
                    generation_config=GEMINI_CONFIG
                )
            )
            
            # Process response
            if response and hasattr(response, 'text'):
                text = response.text.strip()
                return text if text != '[NO_TEXT_FOUND]' else ""
            return ""
            
        except Exception as e:
            logger.error(f"Error in Gemini OCR: {str(e)}")
            return ""
    
    async def _process_page_with_ocr(self, page_bytes: bytes, page_num: int, total_pages: int) -> str:
        """
        Process a single page with Gemini 1.5 Flash OCR.
        
        Args:
            page_bytes: Bytes of the page to process
            page_num: Page number (0-based)
            total_pages: Total number of pages being processed
            
        Returns:
            Extracted text from the page
        """
        try:
            logger.info(f"Processing page {page_num + 1}/{total_pages} with Gemini OCR")
            
            # Convert PDF page to image
            img = self._convert_pdf_page_to_image(page_bytes)
            if img is None:
                return f"[Error: Could not convert page {page_num + 1} to image]"
            
            # Extract text using Gemini
            text = await self._extract_text_with_gemini(img)
            
            if not text:
                return f"[No text could be extracted from page {page_num + 1}]"
                
            return text
                
        except Exception as e:
            error_msg = f"Error processing page {page_num + 1}: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return f"[Error: {error_msg}]"
    
    async def _perform_ocr_on_page(self, page_bytes: bytes, page_num: int) -> str:
        """
        Perform OCR on a single page.
        This is a compatibility wrapper for the old interface.
        """
        return await self._process_page_with_ocr(page_bytes, page_num, page_num + 1)

def calculate_file_hash(file_path: str) -> str:
    """Calculate a hash for a file to use as a unique identifier."""
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def split_pdf_to_pages(file_path_or_bytes, max_pages: Optional[int] = None) -> List[bytes]:
    """
    Split a PDF into individual pages.
    Accepts either a file path or bytes.
    Returns a list of bytes objects, one for each page.
    """
    try:
        # Determine if input is a file path or bytes
        if isinstance(file_path_or_bytes, str):
            # It's a file path
            pdf_document = fitz.open(file_path_or_bytes)
        else:
            # It's bytes
            pdf_document = fitz.open(stream=file_path_or_bytes, filetype="pdf")
        
        pages = []
        for page_num in range(len(pdf_document)):
            if max_pages is not None and page_num >= max_pages:
                break
            # Extract each page as bytes
            page = pdf_document[page_num]
            
            # Create a new PDF with just this page
            single_page_pdf = fitz.open()
            single_page_pdf.insert_pdf(pdf_document, from_page=page_num, to_page=page_num)
            
            # Get the bytes for this page
            page_bytes = single_page_pdf.tobytes()
            pages.append(page_bytes)
            
            # Close the single page PDF
            single_page_pdf.close()
        
        # Close the original PDF
        pdf_document.close()
        
        return pages
        
    except Exception as e:
        logger.error(f"Error splitting PDF into pages: {e}", exc_info=True)
        return []

def count_tokens(text: str) -> int:
    """
    Count the number of tokens in a text.
    This is a placeholder implementation - replace with actual tokenizer.
    """
    if not text:
        return 0
    
    # Simple approximation: 1 token ≈ 4 characters
    return len(text) // 4

async def process_document(file_path: str, filename: str, user_id: str):
    """Process a document with OCR and create embeddings."""
    start_time = time.time()
    logger.info(f"Starting processing for file: {filename}")
    
    try:
        # Calculate file hash
        file_hash = calculate_file_hash(file_path)
        logger.info(f"File hash for {filename}: {file_hash}")
        
        # Check if document already exists
        existing_doc = await documents_collection.find_one({"file_hash": file_hash, "user_id": user_id})
        if existing_doc:
            logger.info(f"Document {filename} already exists in database, returning existing hash")
            return file_hash
        
        # Process based on file type
        if filename.lower().endswith('.pdf'):
            # Initialize OCR service
            ocr_service = OCRService()
            
            # Extract text from PDF
            text_content, is_digital = await ocr_service.extract_text_from_pdf(file_path, user_id, file_hash)
            doc_type = "pdf"
        else:
            # Read text content for non-PDF files
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                text_content = f.read()
            is_digital = True
            doc_type = "text"
        
        logger.info(f"Text content extracted from {filename}, length: {len(text_content)} characters")
        
        # Count tokens
        token_count = count_tokens(text_content)
        
        # Create document record
        document_record = {
            "file_hash": file_hash,
            "filename": filename,
            "user_id": user_id,
            "content": text_content,
            "doc_type": doc_type,
            "is_digital": is_digital,
            "token_count": token_count,
            "created_at": datetime.now()
        }
        await documents_collection.insert_one(document_record)
        
        # Generate embeddings in background
        asyncio.create_task(generate_embeddings_background(text_content, file_hash, user_id))
        
        total_time = time.time() - start_time
        logger.info(f"Processed document {filename} in {total_time:.2f} seconds")
        
        return file_hash
    except Exception as e:
        logger.error(f"Error processing document {filename}: {str(e)}", exc_info=True)
        return None

async def generate_embeddings_background(text: str, file_hash: str, user_id: str):
    """Generate embeddings for a document in the background."""
    try:
        logger.info(f"Starting background embedding generation for document {file_hash}")
        
        # Split text into chunks
        chunks = text_to_chunks(text)
        logger.info(f"Split document into {len(chunks)} chunks for embedding generation")
        
        # Generate embeddings in parallel
        embeddings = await get_embeddings_batch_parallel(chunks, max_workers=10)
        
        stored_count = 0
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            if embedding is None:
                continue
                
            # Create embedding record
            embedding_record = {
                "document_hash": file_hash,
                "chunk_index": i,
                "chunk_text": chunk,
                "embedding": embedding,
                "user_id": user_id,
                "created_at": datetime.now()
            }
            
            # Save to database
            await embeddings_collection.insert_one(embedding_record)
            stored_count += 1
        
        # Update document record to indicate embeddings are complete
        await documents_collection.update_one(
            {"file_hash": file_hash, "user_id": user_id},
            {"$set": {"has_embeddings": True}}
        )
        
        logger.info(f"Background embedding generation complete for document {file_hash}. Stored {stored_count}/{len(chunks)} embeddings.")
    except Exception as e:
        logger.error(f"Error in background embedding generation for document {file_hash}: {str(e)}", exc_info=True)

def text_to_chunks(text: str) -> List[str]:
    """
    Split text into semantic chunks for embedding generation.
    This is a simplified implementation - replace with your actual chunking logic.
    """
    if not text or not text.strip():
        return []
    
    # Simple chunking by paragraphs
    paragraphs = [p.strip() for p in text.split('\n\n') if p.strip()]
    
    # If no paragraphs found, try splitting by newlines
    if not paragraphs:
        paragraphs = [p.strip() for p in text.split('\n') if p.strip()]
    
    # Further split paragraphs into chunks if they are too long
    chunks = []
    current_chunk = []
    current_length = 0
    max_chunk_length = 4000  # Example max length per chunk
    
    for paragraph in paragraphs:
        if current_length + len(paragraph) + 2 <= max_chunk_length:
            current_chunk.append(paragraph)
            current_length += len(paragraph) + 2  # +2 for the newline
        else:
            chunks.append("\n\n".join(current_chunk))
            current_chunk = [paragraph]
            current_length = len(paragraph)
    
    if current_chunk:
        chunks.append("\n\n".join(current_chunk))
    
    return chunks

# Global cache for embeddings
EMBEDDING_CACHE = {}
EMBEDDING_LOCK = asyncio.Lock()

async def get_embeddings_batch_parallel(chunks: List[str], batch_size: int = 50) -> List[Optional[List[float]]]:
    """
    Ultra-fast embeddings generation with parallel processing, batching, and caching.
    
    Args:
        chunks: List of text chunks to get embeddings for
        batch_size: Number of chunks to process in each batch (reduced for better concurrency)
        
    Returns:
        List of embedding vectors (same order as input chunks)
    """
    if not chunks:
        return []
    
    # Initialize OpenAI client with timeout settings
    client = AsyncOpenAI(
        api_key=os.getenv('OPENAI_API_KEY'),
        timeout=30.0,
        max_retries=3
    )
    
    # Process chunks in parallel
    semaphore = asyncio.Semaphore(10)  # Limit concurrent requests
    
    async def process_batch(batch: List[str]) -> List[Optional[List[float]]]:
        async with semaphore:
            batch_key = tuple(batch)
            
            # Check cache first
            cached_results = []
            to_process = []
            to_process_indices = []
            
            for i, chunk in enumerate(batch):
                chunk_key = hashlib.md5(chunk.encode()).hexdigest()
                if chunk_key in EMBEDDING_CACHE:
                    cached_results.append((i, EMBEDDING_CACHE[chunk_key]))
                else:
                    to_process.append(chunk)
                    to_process_indices.append(i)
            
            if not to_process:
                # All results were in cache
                results = [None] * len(batch)
                for idx, emb in cached_results:
                    results[idx] = emb
                return results
            
            try:
                # Clean and truncate text for faster processing
                clean_chunks = []
                for chunk in to_process:
                    # Remove vector-like lines and truncate to 2000 chars (sweet spot for speed/quality)
                    clean_lines = [
                        line for line in chunk.split('\n')
                        if not line.strip().startswith(('0.', '1.', '-0', '1 ', '-1', '0 '))
                        and not line.strip().replace('.', '').replace('-', '').replace(' ', '').isdigit()
                    ][:100]  # Limit to 100 lines max
                    clean_chunk = '\n'.join(clean_lines)[:2000]
                    clean_chunks.append(clean_chunk)
                
                # Get embeddings for the batch
                response = await client.embeddings.create(
                    input=clean_chunks,
                    model="text-embedding-3-small",  # Fastest model
                )
                
                # Process and cache results
                results = [None] * len(batch)
                for idx, emb in cached_results:
                    results[idx] = emb
                
                # Add new results to cache and results
                for i, item in enumerate(response.data):
                    chunk = to_process[i]
                    chunk_key = hashlib.md5(chunk.encode()).hexdigest()
                    EMBEDDING_CACHE[chunk_key] = item.embedding
                    results[to_process_indices[i]] = item.embedding
                
                return results
                
            except Exception as e:
                logger.warning(f"Error in batch processing: {str(e)}")
                return [None] * len(batch)
    
    # Split into smaller batches for better concurrency
    batches = [chunks[i:i + batch_size] for i in range(0, len(chunks), batch_size)]
    
    # Process all batches in parallel
    tasks = [process_batch(batch) for batch in batches]
    batch_results = await asyncio.gather(*tasks, return_exceptions=True)
    
    # Flatten results
    all_embeddings = []
    for result in batch_results:
        if isinstance(result, Exception):
            logger.error(f"Error in batch processing: {str(result)}")
            all_embeddings.extend([None] * batch_size)  # Add placeholders for failed batch
        else:
            all_embeddings.extend(result)
    
    return all_embeddings[:len(chunks)]  # Ensure we return the correct number of embeddings

async def get_single_embedding_ultra_fast(text, client, chunk_id):
    """Ultra-optimized embedding generation with minimal dimensions."""
    try:
        # Use the smallest, fastest embedding model with minimal dimensions
        response = await client.embeddings.create(
            input=text,
            model="text-embedding-3-small",  # Fastest model
            dimensions=128,  # Minimum dimensions for speed
            encoding_format="float"  # Faster processing
        )
        return response.data[0].embedding
    except Exception as e:
        logger.debug(f"Embedding error (chunk {chunk_id}): {str(e)}")
        return None

async def process_document_ultra_fast(file_path, filename, user_id):
    """Process documents at maximum possible speed - target 5 seconds for 100 pages."""
    start_time = time.time()
    logger.info(f"Starting ultra-fast processing for {filename}")
    
    try:
        # Calculate file hash quickly
        file_hash = calculate_file_hash(file_path)
        
        # Check if document already exists (fast path)
        from app.db.mongodb import documents_collection, embeddings_collection
        existing_doc = await documents_collection.find_one(
            {"file_hash": file_hash, "user_id": user_id},
            projection={"_id": 1}
        )
        if existing_doc:
            logger.info(f"Document {filename} already exists - skipping processing")
            return file_hash
            
        # Try direct text extraction first (much faster than OCR)
        extracted_text = ""
        is_digital_pdf = False
        
        try:
            # Open PDF and check if it's digital (has text layer)
            with fitz.open(file_path) as pdf:
                # Sample first few pages to check if it's digital
                sample_pages = min(5, len(pdf))
                sample_text = ""
                for i in range(sample_pages):
                    sample_text += pdf[i].get_text()
                
                # If we got substantial text, it's likely digital
                if len(sample_text) > 500:
                    is_digital_pdf = True
                    # Extract text from all pages in parallel
                    with concurrent.futures.ThreadPoolExecutor(max_workers=min(32, os.cpu_count()*4)) as executor:
                        page_texts = list(executor.map(
                            lambda p: pdf[p].get_text(), 
                            range(len(pdf))
                        ))
                    extracted_text = "\n\n--- PAGE BREAK ---\n\n".join(page_texts)
                    logger.info(f"Digital PDF detected - extracted {len(extracted_text)} chars directly")
        except Exception as e:
            logger.warning(f"Direct text extraction failed: {e}")
            is_digital_pdf = False
            
        # If not digital PDF or text extraction failed, use OCR but limit pages
        if not is_digital_pdf or not extracted_text:
            logger.info(f"Using OCR for {filename} (not digital PDF)")
            ocr_service = OCRService()
            # Limit to 20 pages for OCR to meet speed requirements
            extracted_text, _ = await ocr_service.extract_text_from_pdf(
                file_path, 
                user_id=user_id, 
                file_hash=file_hash,
                max_pages=20  # Limit pages for speed
            )
        
        # Quick token count estimate
        token_count = len(extracted_text.split()) * 1.3  # Rough estimate
        
        # Split into larger chunks for faster processing
        chunks = split_text_into_chunks(extracted_text, max_chunk_size=8000, overlap=50)
        
        # Generate embeddings with ultra-fast parallel processing
        embeddings = await get_embeddings_batch_parallel(chunks)
        
        # Store document in MongoDB
        document_record = {
            "file_hash": file_hash,
            "filename": filename,
            "user_id": user_id,
            "content": extracted_text,
            "doc_type": "pdf",
            "is_digital": is_digital_pdf,
            "token_count": token_count,
            "created_at": datetime.now()
        }
        
        # Insert document and embeddings in parallel
        doc_task = asyncio.create_task(documents_collection.insert_one(document_record))
        
        # Prepare embedding documents
        embedding_docs = []
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            if embedding is None:
                continue
                
            embedding_docs.append({
                "document_hash": file_hash,
                "user_id": user_id,
                "chunk_id": i,
                "text": chunk[:500],  # Store only beginning of chunk to save space
                "embedding": embedding,
                "created_at": datetime.now()
            })
        
        # Insert embeddings in bulk if we have any
        if embedding_docs:
            emb_task = asyncio.create_task(embeddings_collection.insert_many(embedding_docs))
            await asyncio.gather(doc_task, emb_task)
        else:
            await doc_task
        
        elapsed = time.time() - start_time
        logger.info(f"Ultra-fast processed {filename} in {elapsed:.2f} seconds")
        
        return file_hash
        
    except Exception as e:
        logger.error(f"Error in ultra-fast document processing: {str(e)}", exc_info=True)
        return None

def split_text_into_chunks(text: str, max_chunk_size: int = 8000, overlap: int = 50) -> List[str]:
    """
    Split text into chunks with a specified maximum size and overlap.
    """
    if not text:
        return []
    
    chunks = []
    current_chunk = ""
    current_length = 0
    
    sentences = text.split('. ')
    for sentence in sentences:
        sentence_length = len(sentence) + 2  # +2 for '. '
        if current_length + sentence_length <= max_chunk_size:
            current_chunk += sentence + ". "
            current_length += sentence_length
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = sentence + ". "
            current_length = sentence_length
    
    if current_chunk:
        chunks.append(current_chunk.strip())
    
    # Apply overlap
    overlapped_chunks = []
    for i in range(len(chunks)):
        chunk = chunks[i]
        if i > 0:
            chunk = chunks[i-1][-overlap:] + chunk
        overlapped_chunks.append(chunk)
    
    return overlapped_chunks

def process_page_as_image(page_bytes, model=None):
    """
    Process a PDF page as an image using OCR with Gemini 1.5 Flash.
    
    Args:
        page_bytes: The bytes of the PDF page
        model: Optional OCR model to use
        
    Returns:
        Extracted text from the page
    """
    try:
        import tempfile
        import os
        import fitz  # PyMuPDF
        import base64
        import google.generativeai as genai
        from PIL import Image
        import io
        
        # Set up Google API key
        api_key = os.getenv("GOOGLE_API_KEY")
        if not api_key:
            logger.error("GOOGLE_API_KEY environment variable not set")
            return "[Error: Google API key not configured]"
        
        genai.configure(api_key=api_key)
        
        # Create a temporary file for the PDF page
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_file:
            temp_path = temp_file.name
            temp_file.write(page_bytes)
        
        # Convert PDF to image
        image_path = temp_path.replace('.pdf', '.png')
        
        # Use PyMuPDF to convert PDF page to image
        pdf_doc = fitz.open(temp_path)
        page = pdf_doc[0]  # Only one page in this PDF
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))  # 2x zoom for better OCR
        pix.save(image_path)
        pdf_doc.close()
        
        # Load the image for Gemini
        image = Image.open(image_path)
        
        # Process with Gemini 1.5 Flash
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        # Create prompt for OCR
        prompt = "Extract all text from this image. Return only the extracted text without any additional commentary."
        
        # Generate content with the image
        response = model.generate_content([prompt, image])
        
        # Extract text from response
        extracted_text = response.text
        
        logger.info(f"Extracted {len(extracted_text)} chars using Gemini 1.5 Flash")
        
        # Clean up temporary files
        try:
            os.unlink(temp_path)
            os.unlink(image_path)
        except:
            pass
            
        return extracted_text
        
    except Exception as e:
        logger.error(f"Error in process_page_as_image with Gemini: {e}", exc_info=True)
        
        # Fall back to Tesseract if Gemini fails
        try:
            logger.info("Falling back to Tesseract OCR")
            import pytesseract
            from PIL import Image
            
            # Open the image (assuming image_path is still valid)
            image = Image.open(image_path)
            
            # Use pytesseract to extract text
            extracted_text = pytesseract.image_to_string(image)
            
            logger.info(f"Extracted {len(extracted_text)} chars using Tesseract OCR fallback")
            return extracted_text
            
        except Exception as fallback_error:
            logger.error(f"Fallback OCR also failed: {fallback_error}", exc_info=True)
            return f"[Error processing page: {str(e)}]"
