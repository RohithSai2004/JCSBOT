"""
Advanced PDF Processing with Gemini

Dependencies:
    - google-generativeai: For Gemini API
    - python-dotenv: Environment variable management
    - PyPDF2: For splitting PDFs into single-page chunks

Environment Setup:
    Requires:
        - GOOGLE_API_KEY in .env file
"""
import os
import google.generativeai as genai
from dotenv import load_dotenv
from typing import Tuple, Optional
import logging
import concurrent.futures
from io import BytesIO
import functools
from app.utils.embeddings import get_embedding
from app.db.mongodb import save_document_embedding, DocumentEmbedding

# Optional imports for PDF splitting
try:
    from PyPDF2 import PdfReader, PdfWriter
except ImportError:
    PdfReader = None
    PdfWriter = None

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("ocr_service.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Cache for API responses
response_cache = {}

def get_optimized_prompt():
    return ("Extract text content from this PDF page efficiently. Include all plain text and table data. "
            "Format tables as Markdown. Be comprehensive but focus on speed and accuracy. "
            "Return only the extracted content without explanations or summaries.")

def split_pdf_to_pages(pdf_bytes):
    if not PdfReader or not PdfWriter:
        raise ImportError("PyPDF2 is required for PDF splitting.")
    reader = PdfReader(BytesIO(pdf_bytes))
    total_pages = len(reader.pages)
    chunks = []
    for i in range(total_pages):
        writer = PdfWriter()
        writer.add_page(reader.pages[i])
        output = BytesIO()
        writer.write(output)
        output.seek(0)
        chunks.append((output.getvalue(), i))  # (pdf_bytes, page_number)
    return chunks

def process_pdf_page_chunk(chunk_data, model):
    pdf_bytes, page_number = chunk_data
    cache_key = hash(pdf_bytes[:1024])
    if cache_key in response_cache:
        logger.info(f"Using cached response for page {page_number+1}")
        return response_cache[cache_key]
    pdf_part = {"mime_type": "application/pdf", "data": pdf_bytes}
    text_part = get_optimized_prompt()
    try:
        response = model.generate_content(
            contents=[pdf_part, text_part],
            generation_config={
                "temperature": 0.0,
                "top_p": 0.95,
                "max_output_tokens": 8192
            }
        )
        result = response.text
        response_cache[cache_key] = result
        return result
    except Exception as e:
        logger.error(f"Error processing page {page_number+1}: {str(e)}")
        return f"Error processing page {page_number+1}: {str(e)}"

class OCRService:
    def __init__(self):
        # Load environment variables
        load_dotenv()
        self.api_key = os.getenv("GOOGLE_API_KEY")
        if not self.api_key:
            raise ValueError("GOOGLE_API_KEY not set in environment variables")
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-1.5-flash')

    def _extract_with_gemini(self, file_path: str, prompt: str) -> Tuple[str, bool]:
        try:
            with open(file_path, 'rb') as file:
                file_bytes = file.read()
            # Determine mime type
            ext = os.path.splitext(file_path)[1].lower()
            if ext == '.pdf':
                mime_type = 'application/pdf'
            elif ext in ['.jpg', '.jpeg']:
                mime_type = 'image/jpeg'
            elif ext == '.png':
                mime_type = 'image/png'
            elif ext == '.docx':
                mime_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            else:
                mime_type = 'application/octet-stream'
            file_part = {"mime_type": mime_type, "data": file_bytes}
            response = self.model.generate_content(
                contents=[file_part, prompt]
            )
            text = getattr(response, 'text', None)
            if text:
                return text, True
            return "", False
        except Exception as e:
            logger.error(f"Error extracting text with Gemini: {e}")
            return "", False

    async def extract_text_from_pdf(self, file_path: str, user_id: Optional[str] = None, document_hash: Optional[str] = None) -> Tuple[str, bool]:
        try:
            import asyncio
            with open(file_path, 'rb') as file:
                pdf_bytes = file.read()
            # Always split into single-page chunks
            chunks = split_pdf_to_pages(pdf_bytes)
            loop = asyncio.get_event_loop()
            # Process all pages in parallel using run_in_executor
            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
                tasks = [loop.run_in_executor(executor, functools.partial(process_pdf_page_chunk, model=self.model), chunk) for chunk in chunks]
                page_texts = await asyncio.gather(*tasks)
            # For each page, generate embedding and store in DB
            all_text = []
            for i, text in enumerate(page_texts):
                all_text.append(text)
                if user_id and document_hash:
                    embedding = get_embedding(text)
                    doc_embedding = DocumentEmbedding(
                        document_hash=document_hash,
                        chunk_id=i,
                        text=text,
                        embedding=embedding,
                        user_id=user_id
                    )
                    await save_document_embedding(doc_embedding)
            combined_result = "\n\n".join(all_text)
            if combined_result:
                return combined_result, True
            return "", False
        except Exception as e:
            logger.error(f"Error extracting text from PDF with Gemini: {e}")
            return "", False

    async def extract_text_from_image(self, file_path: str) -> Tuple[str, bool]:
        prompt = ("Extract all the text content from the provided image. Maintain the original structure, "
                  "including headers, paragraphs, and any content. Format tables in Markdown if present. "
                  "Ensure no text is excluded.")
        return self._extract_with_gemini(file_path, prompt)

    async def extract_text_from_docx(self, file_path: str) -> Tuple[str, bool]:
        prompt = ("Extract all the text content, including both plain text and tables, from the provided Word document. "
                  "Maintain the original structure, including headers, paragraphs, and any content preceding or following tables. "
                  "Format tables in Markdown, preserving numerical data and relationships. Ensure no text is excluded, including any introductory or explanatory text before or after the tables.")
        return self._extract_with_gemini(file_path, prompt)

    async def extract_text(self, file_path: str, user_id: Optional[str] = None, document_hash: Optional[str] = None) -> Tuple[str, bool]:
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.pdf':
            return await self.extract_text_from_pdf(file_path, user_id=user_id, document_hash=document_hash)
        elif ext in ['.jpg', '.jpeg', '.png']:
            return await self.extract_text_from_image(file_path)
        elif ext == '.docx':
            return await self.extract_text_from_docx(file_path)
        else:
            logger.error(f"Unsupported file type for Gemini OCR: {file_path}")
            return "", False

    def cleanup(self):
        pass  # No resources to clean up for Gemini API