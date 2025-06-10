# In backend/app/services/ocr_service.py

import os
import google.generativeai as genai
from dotenv import load_dotenv
from typing import Tuple, Optional
import logging
import concurrent.futures
from io import BytesIO
import functools
import asyncio
from openai import OpenAI
import fitz  # PyMuPDF is used for rendering pages to images

try:
    from PyPDF2 import PdfReader, PdfWriter
except ImportError:
    PdfReader = None
    PdfWriter = None

logger = logging.getLogger(__name__)

def get_high_accuracy_ocr_prompt():
    """
    Creates a highly specific prompt to ensure the AI performs a thorough OCR transcription.
    """
    return """
    You are a world-class OCR (Optical Character Recognition) engine. Your sole task is to transcribe the content of the provided single image with perfect accuracy.

    **CRITICAL RULES:**
    1.  **TRANSCRIBE EVERYTHING:** You must capture every single piece of text on the page, regardless of size or location. This includes all text in headers, footers, the main body, sidebars, tables, and image captions.
    2.  **NO OMISSIONS:** Do not skip or overlook any detail, no matter how minor it may seem.
    3.  **NO SUMMARIZATION:** Do not summarize, interpret, or change the original meaning. You must perform a literal transcription.
    4.  **PRESERVE STRUCTURE:** Maintain the original structure, including paragraphs, line breaks, and lists.
    5.  **TABLES:** All tables must be perfectly formatted as Markdown.
    6.  **OUTPUT:** Your output must be ONLY the transcribed text. Do not add any conversational text, introductions, or explanations.
    """

def process_page_as_image(chunk_data, model):
    """
    Takes a single PDF page's byte data, converts it to a high-resolution image,
    and sends it to the AI model for OCR.
    """
    pdf_bytes, page_number = chunk_data
    try:
        pdf_doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page = pdf_doc[0]
        
        # Render the page to a high-resolution PNG image (300 DPI is excellent for OCR)
        pix = page.get_pixmap(dpi=300)
        img_bytes = pix.tobytes("png")
        
        image_part = {"mime_type": "image/png", "data": img_bytes}
        prompt_part = get_high_accuracy_ocr_prompt()
        
        response = model.generate_content(
            contents=[prompt_part, image_part],
            generation_config={"temperature": 0.0}
        )
        return response.text
    except Exception as e:
        logger.error(f"Error processing page {page_number + 1} as image: {str(e)}")
        return f"Error processing page {page_number + 1}"
    finally:
        if 'pdf_doc' in locals() and pdf_doc:
            pdf_doc.close()

def split_pdf_to_pages(pdf_bytes):
    if not PdfReader:
        raise ImportError("PyPDF2 is required for this function.")
    reader = PdfReader(BytesIO(pdf_bytes))
    chunks = []
    for i in range(len(reader.pages)):
        writer = PdfWriter()
        writer.add_page(reader.pages[i])
        output = BytesIO()
        writer.write(output)
        output.seek(0)
        chunks.append((output.getvalue(), i))
    return chunks

class OCRService:
    def __init__(self):
        load_dotenv()
        self.api_key = os.getenv("GOOGLE_API_KEY")
        if not self.api_key:
            raise ValueError("GOOGLE_API_KEY not set in environment variables")
        genai.configure(api_key=self.api_key)
        
        # MODEL UPGRADE FOR HIGHER QUALITY
        self.model = genai.GenerativeModel('gemini-1.5-pro')
        
        self.openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    async def extract_text_from_pdf(self, file_path: str, user_id: Optional[str] = None, document_hash: Optional[str] = None) -> Tuple[str, bool]:
        """
        High-accuracy OCR: Splits PDF, converts each page to a high-res image,
        and sends to Gemini 1.5 Pro for transcription.
        """
        try:
            with open(file_path, 'rb') as file:
                pdf_bytes = file.read()

            page_chunks = split_pdf_to_pages(pdf_bytes)
            loop = asyncio.get_event_loop()
            
            with concurrent.futures.ThreadPoolExecutor() as executor:
                tasks = [loop.run_in_executor(executor, functools.partial(process_page_as_image, model=self.model), chunk) for chunk in page_chunks]
                page_texts = await asyncio.gather(*tasks)
            
            combined_result = "\n\n--- PAGE BREAK ---\n\n".join(page_texts)
            return (combined_result, True) if "Error processing page" not in combined_result else (combined_result, False)
        except Exception as e:
            logger.error(f"Error in extract_text_from_pdf: {e}", exc_info=True)
            return "", False

    # This function is no longer needed for the primary OCR flow but can be kept for other purposes
    # or removed if you have refactored all calls to it.
    async def clean_extracted_text(self, raw_text: str) -> str:
        pass
    
    async def extract_text(self, file_path: str, user_id: Optional[str] = None, document_hash: Optional[str] = None) -> Tuple[str, bool]:
        ext = os.path.splitext(file_path)[1].lower()
        if ext == '.pdf':
            return await self.extract_text_from_pdf(file_path, user_id=user_id, document_hash=document_hash)
        # Add other file types here if needed
        return "", False