import os
import cv2
import numpy as np
from PIL import Image
import fitz  # PyMuPDF
from paddleocr import PaddleOCR
import magic
from typing import Tuple, List, Dict, Any, Optional
import logging
import tempfile
import shutil
import concurrent.futures
import asyncio
import time
import functools
import gc
import io
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
import traceback

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

class OCRService:
    def __init__(self):
        """Initialize OCR service with PaddleOCR optimized for text accuracy and speed."""
        self.paddle_ocr = None
        self.tesseract_available = self._check_tesseract()
        self.poppler_path = os.getenv("POPPLER_PATH", r'C:\Users\rohit\Downloads\Release-24.08.0-0\poppler-24.08.0\Library\bin')
        self.initialized = False
        self.dpi = 300  # Default DPI for balanced quality and speed
        self.char_whitelist = set('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:-/')
        self.executor = ThreadPoolExecutor(max_workers=os.cpu_count())
        self.process_executor = ProcessPoolExecutor(max_workers=max(1, os.cpu_count() // 2))
        self.max_retries = 3  # Maximum number of retries for OCR operations
        
        # Initialize OCR engine in background thread
        self._initialize_in_background()

    def _check_tesseract(self):
        """Check if Tesseract OCR is available as a fallback."""
        try:
            import pytesseract
            pytesseract.get_tesseract_version()
            return True
        except (ImportError, Exception):
            return False

    def _initialize_in_background(self):
        """Initialize OCR engine in background thread."""
        import threading
        thread = threading.Thread(target=self._initialize_ocr_engine)
        thread.daemon = True
        thread.start()

    def _initialize_ocr_engine(self):
        """Initialize PaddleOCR with settings optimized for accuracy and speed."""
        try:
            if self.paddle_ocr is not None:
                return

            logger.info("Initializing PaddleOCR for maximum accuracy with optimized speed...")
            
            # Initialize PaddleOCR with settings optimized for accuracy and speed
            self.paddle_ocr = PaddleOCR(
                use_gpu=False,
                lang='en',
                use_angle_cls=True,
                show_log=False,
                enable_mkldnn=True,
                rec_algorithm='SVTR_LCNet',    # Better algorithm for text recognition
                rec_image_shape='3,48,320',    # Optimized size for speed/quality balance
                max_text_length=512,           # Increased for capturing more text
                det_db_thresh=0.3,             # Balanced threshold for speed and accuracy
                det_db_box_thresh=0.3,         # Balanced threshold for speed and accuracy
                det_db_unclip_ratio=1.8,       # Optimized for speed while maintaining accuracy
                det_limit_side_len=2048,       # Optimized for memory usage and detail
                rec_batch_num=8                # Batch processing for faster results
            )
            
            self.initialized = True
            logger.info("PaddleOCR initialized successfully")
            
        except Exception as e:
            logger.error(f"Failed to initialize PaddleOCR: {str(e)}")
            self.paddle_ocr = None
            self.initialized = False

    def _wait_for_initialization(self, timeout=30):
        """Wait for OCR engine to initialize with reasonable timeout."""
        start_time = time.time()
        while not self.initialized and time.time() - start_time < timeout:
            time.sleep(0.5)
        
        # If not initialized within timeout, try initializing now
        if not self.initialized:
            self._initialize_ocr_engine()
            
        return self.initialized

    def _verify_poppler_installation(self) -> bool:
        """Verify Poppler installation."""
        try:
            if not os.path.exists(self.poppler_path):
                logger.error(f"Poppler directory not found at: {self.poppler_path}")
                return False
            
            required_files = ['pdftoppm.exe', 'pdftotext.exe']
            for file in required_files:
                file_path = os.path.join(self.poppler_path, file)
                if not os.path.exists(file_path):
                    logger.error(f"Required Poppler executable not found: {file}")
                    return False
            
            return True
        except Exception as e:
            logger.error(f"Error verifying Poppler installation: {str(e)}")
            return False

    async def _enhance_image_for_ocr(self, image: np.ndarray) -> List[np.ndarray]:
        """Enhanced image processing pipeline for better OCR quality."""
        try:
            if image is None or image.size == 0:
                logger.error("Received empty image for enhancement")
                return []
                
            enhanced_versions = []
            
            # Original image (resized for processing speed if too large)
            height, width = image.shape[:2]
            max_dimension = 3000  # Increased for better quality
            
            if max(height, width) > max_dimension:
                scale = max_dimension / max(height, width)
                new_width = int(width * scale)
                new_height = int(height * scale)
                resized_image = cv2.resize(image, (new_width, new_height), interpolation=cv2.INTER_AREA)
                enhanced_versions.append(resized_image)
            else:
                enhanced_versions.append(image.copy())
            
            # Process enhancements in parallel
            loop = asyncio.get_event_loop()
            enhancement_tasks = [
                loop.run_in_executor(self.executor, self._apply_enhancement, image, enhancement_type)
                for enhancement_type in ["gray", "clahe", "binary", "sharpen", "denoise", "threshold"]
            ]
            
            # Add the results as they complete
            enhanced_results = await asyncio.gather(*enhancement_tasks)
            for result in enhanced_results:
                if result is not None:
                    enhanced_versions.append(result)
            
            return enhanced_versions
            
        except Exception as e:
            logger.error(f"Error in image enhancement: {str(e)}")
            return [image] if image is not None and image.size > 0 else []

    def _apply_enhancement(self, image: np.ndarray, enhancement_type: str) -> Optional[np.ndarray]:
        """Apply more advanced image enhancements for better OCR quality."""
        try:
            if image is None or image.size == 0:
                return None
                
            if enhancement_type == "gray":
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
                return cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
                
            elif enhancement_type == "clahe":
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
                enhanced_gray = clahe.apply(gray)
                return cv2.cvtColor(enhanced_gray, cv2.COLOR_GRAY2BGR)
                
            elif enhancement_type == "binary":
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
                # Try both global and adaptive thresholding
                ret, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
                return cv2.cvtColor(binary, cv2.COLOR_GRAY2BGR)
                
            elif enhancement_type == "sharpen":
                # Apply sharpening filter
                kernel = np.array([[0, -1, 0], [-1, 5, -1], [0, -1, 0]])
                sharpened = cv2.filter2D(image, -1, kernel)
                return sharpened
            
            elif enhancement_type == "denoise":
                # Apply non-local means denoising
                denoised = cv2.fastNlMeansDenoisingColored(image, None, 10, 10, 7, 21)
                return denoised
                
            elif enhancement_type == "threshold":
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
                # Adaptive thresholding with different parameters
                adaptive = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 5)
                return cv2.cvtColor(adaptive, cv2.COLOR_GRAY2BGR)
                
            else:
                return None
        except Exception as e:
            logger.error(f"Error applying {enhancement_type} enhancement: {str(e)}")
            return None

    def _post_process_text(self, text: str) -> str:
        """Advanced post-processing of OCR text for better quality."""
        try:
            if not text or len(text) < 5:
                return text
                
            # Remove non-printable characters
            text = ''.join(char for char in text if char.isprintable())
            
            # Fix common OCR errors using regex
            import re
            
            # Fix common patterns
            replacements = [
                # Character replacements
                (r'\b1(?=[a-zA-Z])', 'I'),  # 1 followed by letters is likely an I
                (r'(?<=[a-zA-Z])0(?=[a-zA-Z])', 'O'),  # 0 between letters is likely an O
                (r'\b5(?=[a-zA-Z])', 'S'),  # 5 at start of word likely S
                (r'\|', 'I'),  # | is likely I
                (r'l(?=\d)', '1'),  # l before numbers is likely 1
                (r'(?<!\w)lI(?!\w)', 'II'),  # lI not within words is likely II
                
                # Fix common symbols
                (r'＆', '&'),
                (r'，', ','),
                (r'；', ';'),
                (r'：', ':'),
                
                # Fix spacing issues
                (r'(?<=[a-zA-Z])\.(?=[a-zA-Z])', '. '),  # Add space after period between words
                (r'\s+', ' '),  # Normalize whitespace
                
                # Fix broken paragraphs
                (r'(\w)\-\s*\n\s*(\w)', r'\1\2'),  # Fix hyphenation at line breaks
                
                # PAN Card specific formats (if needed)
                (r'([A-Z]{5})[\s\-_]?(\d{4})[\s\-_]?([A-Z])', r'\1\2\3'),  # PAN format
            ]
            
            for pattern, replacement in replacements:
                text = re.sub(pattern, replacement, text)
            
            # Fix line breaks
            lines = text.split('\n')
            cleaned_lines = []
            for line in lines:
                line = line.strip()
                if line:
                    cleaned_lines.append(line)
            
            text = '\n'.join(cleaned_lines)
            
            return text.strip()
            
        except Exception as e:
            logger.error(f"Error in text post-processing: {str(e)}")
            return text if text else ""

    async def _try_tesseract_ocr(self, img_path: str) -> str:
        """Try using Tesseract OCR as a fallback."""
        try:
            if not self.tesseract_available:
                return ""
                
            import pytesseract
            from PIL import Image
            
            # Load image
            with Image.open(img_path) as img:
                # Convert to RGB if needed
                if img.mode != 'RGB':
                    img = img.convert('RGB')
                
                # Run OCR with default configuration
                text = await asyncio.get_event_loop().run_in_executor(
                    self.executor,
                    functools.partial(
                        pytesseract.image_to_string,
                        img,
                        config='--psm 6 --oem 3'  # Assume a single uniform block of text
                    )
                )
                
                return text
        except Exception as e:
            logger.error(f"Error in Tesseract OCR fallback: {str(e)}")
            return ""

    async def _ocr_image_chunk(self, img_version: np.ndarray, retry_count=0) -> List[str]:
        """Process a single image with OCR with retry capability."""
        try:
            if img_version is None or img_version.size == 0:
                logger.error("Received empty image for OCR")
                return []
                
            result = await asyncio.get_event_loop().run_in_executor(
                self.executor, 
                functools.partial(self.paddle_ocr.ocr, img_version, cls=True)
            )
            
            texts = []
            if result and len(result) > 0:
                for item in result[0]:
                    if len(item) >= 2 and isinstance(item[1], (list, tuple)) and len(item[1]) >= 2:
                        text = item[1][0]
                        confidence = item[1][1]
                        
                        # Include results with reasonable confidence
                        if confidence > 0.5 and text and text.strip():
                            texts.append(text)
            
            return texts
        except Exception as e:
            logger.error(f"Error in OCR processing (attempt {retry_count+1}): {str(e)}")
            # Retry logic for transient errors
            if retry_count < self.max_retries:
                await asyncio.sleep(1)  # Wait before retry
                return await self._ocr_image_chunk(img_version, retry_count + 1)
            return []

    async def extract_text_from_image(self, file_path: str) -> Tuple[str, bool]:
        """Extract text from image with optimized speed and accuracy."""
        try:
            logger.info(f"Processing image: {file_path}")
            
            if not self._wait_for_initialization():
                logger.error("OCR engine failed to initialize within timeout")
                return "", False
            
            # Try to get file size for analysis
            try:
                file_size = os.path.getsize(file_path)
                is_large_image = file_size > 5 * 1024 * 1024  # 5MB threshold
            except:
                is_large_image = False
            
            # Load image with optimized approach
            try:
                # First try PIL for more memory-efficient loading
                with Image.open(file_path) as pil_image:
                    # Convert to RGB if needed
                    if pil_image.mode not in ["RGB", "L"]:
                        pil_image = pil_image.convert("RGB")
                    
                    # Get image dimensions
                    width, height = pil_image.size
                    
                    # Check if image is very large
                    if is_large_image or (width * height > 12000000):  # ~12MP threshold
                        # Resize to manageable size while preserving aspect ratio
                        max_dimension = 3000
                        if width > height:
                            new_width = max_dimension
                            new_height = int(max_dimension * height / width)
                        else:
                            new_height = max_dimension
                            new_width = int(max_dimension * width / height)
                        
                        pil_image = pil_image.resize((new_width, new_height), Image.LANCZOS)
                    
                    # Convert to numpy array
                    image = np.array(pil_image)
                    
                    # Convert grayscale to BGR if needed
                    if len(image.shape) == 2:
                        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)
            except Exception as e:
                logger.error(f"Error loading image with PIL: {str(e)}")
                # Fallback to OpenCV
                image = cv2.imread(file_path)
                
                # Check if image was loaded properly
                if image is None or image.size == 0:
                    logger.error(f"Failed to load image with OpenCV: {file_path}")
                    return "", False
            
            # Get enhanced versions (optimized and in parallel)
            enhanced_versions = await self._enhance_image_for_ocr(image)
            
            if not enhanced_versions:
                logger.error(f"No valid enhanced image versions created")
                return "", False
            
            # Process each version in parallel and collect all text
            ocr_tasks = []
            for img_version in enhanced_versions:
                ocr_tasks.append(self._ocr_image_chunk(img_version))
            
            # Gather all results
            all_texts_lists = await asyncio.gather(*ocr_tasks)
            
            # Flatten the list of lists
            all_texts = []
            for text_list in all_texts_lists:
                all_texts.extend(text_list)
            
            # Clean up large images to free memory
            del enhanced_versions
            del image
            gc.collect()
            
            if all_texts:
                # Remove duplicates while preserving order
                seen = set()
                unique_texts = [x for x in all_texts if not (x in seen or seen.add(x))]
                
                # Combine unique detected text
                combined_text = '\n'.join(unique_texts)
                
                # Post-process the text
                processed_text = self._post_process_text(combined_text)
                return processed_text, True
            
            # If PaddleOCR failed, try Tesseract as fallback
            tesseract_text = await self._try_tesseract_ocr(file_path)
            if tesseract_text:
                processed_text = self._post_process_text(tesseract_text)
                return processed_text, True
            
            return "", False
            
        except Exception as e:
            logger.error(f"Error in extract_text_from_image: {str(e)}")
            logger.error(traceback.format_exc())
            return "", False

    async def _process_pdf_page(self, page, page_num, temp_dir, try_ocr=True):
        """Process a single PDF page with multiple quality levels."""
        try:
            # Method 1: Direct text extraction (fast)
            direct_text = page.get_text()
            
            # If direct text extraction yields sufficient text, skip OCR
            if len(direct_text.strip().split()) > 10:
                return direct_text, True
            
            if not try_ocr:
                return direct_text, len(direct_text.strip()) > 0
            
            # Method 2: Generate optimized image and process with OCR
            # Try different DPI settings for better quality
            dpi_settings = [300, 400, 600]  # Different DPI settings
            
            # Initialize best result variables
            best_text = ""
            best_word_count = 0
            
            for dpi in dpi_settings:
                try:
                    # Generate image at this DPI
                    pix = page.get_pixmap(matrix=fitz.Matrix(dpi/72, dpi/72))
                    img_path = os.path.join(temp_dir, f"page_{page_num}_dpi{dpi}.png")
                    pix.save(img_path)
                    
                    # Process with OCR
                    ocr_text, success = await self.extract_text_from_image(img_path)
                    
                    # Check if this result is better
                    if success and ocr_text:
                        word_count = len(ocr_text.split())
                        if word_count > best_word_count:
                            best_text = ocr_text
                            best_word_count = word_count
                    
                    # Clean up
                    if os.path.exists(img_path):
                        os.unlink(img_path)
                        
                    # If we got a good result, break early
                    if best_word_count > 20:  # Sufficient text found
                        break
                        
                except Exception as e:
                    logger.error(f"Error processing PDF page {page_num} at DPI {dpi}: {str(e)}")
                    continue
            
            # Return best result
            if best_text:
                return best_text, True
            else:
                # If we couldn't get text with OCR, fall back to direct text
                return direct_text, len(direct_text.strip()) > 0
                
        except Exception as e:
            logger.error(f"Error processing PDF page {page_num}: {str(e)}")
            return "", False

    async def extract_text_from_pdf(self, file_path: str, start_page: int = 0, end_page: Optional[int] = None) -> Tuple[str, bool]:
        """Extract text from PDF with maximum speed and accuracy."""
        temp_dir = tempfile.mkdtemp()
        try:
            logger.info(f"Processing PDF: {file_path} (pages {start_page+1} to {end_page or 'end'})")
            
            # First, quickly check if the PDF is searchable
            try:
                doc = fitz.open(file_path)
                page_count = doc.page_count
                
                if end_page is None:
                    end_page = page_count
                end_page = min(end_page, page_count)
                
                # Check if the PDF is likely scanned (sample first few pages)
                sample_pages = min(3, page_count)
                text_samples = []
                
                for i in range(min(sample_pages, end_page - start_page)):
                    page_num = start_page + i
                    page = doc[page_num]
                    text = page.get_text()
                    text_samples.append(text)
                
                # If we found reasonable text in the sample pages, process all pages without OCR
                if all(len(text.strip()) > 50 for text in text_samples):
                    logger.info("PDF appears to be searchable, processing without OCR")
                    all_text_parts = []
                    
                    for page_num in range(start_page, end_page):
                        page = doc[page_num]
                        text, _ = await self._process_pdf_page(page, page_num, temp_dir, try_ocr=False)
                        if text.strip():
                            all_text_parts.append(text)
                    
                    if all_text_parts:
                        combined_text = "\n\n".join(all_text_parts)
                        processed_text = self._post_process_text(combined_text)
                        return processed_text, True
            except Exception as e:
                logger.error(f"Error checking if PDF is searchable: {str(e)}")
            
            # If we get here, either the PDF is scanned or the quick check failed
            # Reopen the document
            doc = fitz.open(file_path)
            page_count = doc.page_count
            
            if end_page is None:
                end_page = page_count
            end_page = min(end_page, page_count)
            
            # Calculate batch size based on available processors and page count
            cpu_count = os.cpu_count() or 1
            # Use at most half of available CPUs to prevent thrashing
            batch_size = min(max(1, cpu_count // 2), 4)
            
            # For very large PDFs, process fewer pages at once
            if end_page - start_page > 100:
                batch_size = 1
            
            # Process in batches
            all_text_parts = []
            
            for batch_start in range(start_page, end_page, batch_size):
                batch_end = min(batch_start + batch_size, end_page)
                logger.info(f"Processing PDF pages {batch_start + 1} to {batch_end} in parallel")
                
                # Process batch in parallel
                tasks = []
                for page_num in range(batch_start, batch_end):
                    page = doc[page_num]
                    tasks.append(self._process_pdf_page(page, page_num, temp_dir))
                
                # Wait for all pages in this batch to complete
                batch_results = await asyncio.gather(*tasks)
                
                # Add successful results to all_text_parts
                for text, success in batch_results:
                    if success and text.strip():
                        all_text_parts.append(text)
                
                # Clean up memory after each batch
                gc.collect()
            
            # Close document to free memory
            doc.close()
            
            # Combine all text
            if all_text_parts:
                combined_text = "\n\n".join(all_text_parts)
                processed_text = self._post_process_text(combined_text)
                return processed_text, True
            
            return "", False
            
        except Exception as e:
            logger.error(f"Error in extract_text_from_pdf: {str(e)}")
            logger.error(traceback.format_exc())
            return "", False
        finally:
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)

    def extract_text_from_docx(self, file_path: str) -> Tuple[str, bool]:
        """Extract text from DOCX files with optimized performance."""
        try:
            logger.info(f"Processing DOCX: {file_path}")
            import docx
            
            # Use a ThreadPoolExecutor to load document in background
            with ThreadPoolExecutor(max_workers=1) as executor:
                future = executor.submit(docx.Document, file_path)
                # Add timeout to handle corrupt documents
                doc = future.result(timeout=30)
            
            # Extract text with optimized approach
            text_parts = []
            
            # Get paragraphs
            for paragraph in doc.paragraphs:
                if paragraph.text.strip():
                    text_parts.append(paragraph.text)
            
            # Get tables
            for table in doc.tables:
                for row in table.rows:
                    row_texts = []
                    for cell in row.cells:
                        if cell.text.strip():
                            row_texts.append(cell.text)
                    if row_texts:
                        text_parts.append(" | ".join(row_texts))
            
            # Combine all text
            text = "\n".join(text_parts)
            
            if text.strip():
                normalized_text = self._post_process_text(text)
                logger.info("DOCX processing completed successfully")
                return normalized_text, True
            
            logger.warning("No text could be extracted from the DOCX file")
            return "", False
            
        except Exception as e:
            logger.error(f"Error in DOCX processing: {str(e)}")
            logger.error(traceback.format_exc())
            return "", False

    async def extract_text(self, file_path: str) -> Tuple[str, bool]:
        """Main method to extract text from any supported file type with optimized performance."""
        try:
            logger.info(f"Processing file: {file_path}")
            
            if not os.path.exists(file_path):
                logger.error(f"File not found: {file_path}")
                return "", False
                
            # Determine file type quickly without reading entire file
            try:
                with open(file_path, 'rb') as f:
                    header = f.read(4096)  # Read just the header for faster detection
                
                file_type = magic.from_buffer(header, mime=True)
            except Exception as e:
                logger.error(f"Error determining file type: {str(e)}")
                # Try to guess by extension
                ext = os.path.splitext(file_path)[1].lower()
                if ext == '.pdf':
                    file_type = 'application/pdf'
                elif ext in ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.bmp']:
                    file_type = f'image/{ext[1:]}'
                elif ext == '.docx':
                    file_type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                else:
                    file_type = None
            
            if not file_type:
                logger.error("Could not determine file type")
                return "", False

            # Process based on file type
            if file_type.startswith('image/'):
                return await self.extract_text_from_image(file_path)
            elif file_type == 'application/pdf':
                return await self.extract_text_from_pdf(file_path)
            elif file_type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                return self.extract_text_from_docx(file_path)
            else:
                logger.error(f"Unsupported file type: {file_type}")
                return "", False

        except Exception as e:
            logger.error(f"Error in extract_text: {str(e)}")
            logger.error(traceback.format_exc())
            return "", False

    def cleanup(self):
        """Clean up resources when service is no longer needed."""
        try:
            self.executor.shutdown(wait=False)
            self.process_executor.shutdown(wait=False)
        except Exception as e:
            logger.error(f"Error during cleanup: {str(e)}")