from fastapi import APIRouter, Form, UploadFile, File, Request, HTTPException, Depends, status, Response
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import hashlib
import json
import tempfile
import shutil
import os
import pickle
import numpy as np
import asyncio
import fitz  # PyMuPDF for PDF processing
from dotenv import load_dotenv
from app.models.schemas import WelcomeResponse
from app.utils.guardrails import validate_user_input
from app.services.ocr_service import OCRService
from app.services.chat_session import chat_session_manager
from app.utils.embeddings import get_embedding, cosine_similarity
from app.db.mongodb import (
    get_user, create_user, update_user_last_login,
    save_document, get_document, save_chat_message,
    get_user_chat_history, save_document_embedding,
    get_document_embeddings, User, Document, ChatMessage,
    DocumentEmbedding, documents_collection, chat_history_collection,
    embeddings_collection
)
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any, Optional # Ensure all are imported
from datetime import datetime, timedelta
import traceback
import logging
from openai import AsyncOpenAI

# Correctly import User Pydantic model and get_current_user
# Adjust path if your User model or get_current_user are elsewhere
from app.db.mongodb import User as PydanticUser 
 # Assuming get_current_user is defined here or imported appropriately

from app.services.chat_session import chat_session_manager
# from app.models.schemas import WelcomeResponse # Keep if you have a / route

logger = logging.getLogger(__name__)
router = APIRouter()
# JWT imports
import jwt
import secrets
from passlib.context import CryptContext

# OpenAI imports
from openai import OpenAI

# Load environment variables
load_dotenv()

# Initialize OpenAI client

openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
# Update model name to a valid one
MODEL_NAME = "gpt-4o-mini"  # or "gpt-4" if you have access

router = APIRouter()

# Authentication setup
SECRET_KEY = os.getenv("SECRET_KEY", "your-very-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Initialize OCR service
ocr_service = OCRService()

# Constants
MAX_FILE_SIZE_MB = 500  # Increased to 500MB
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024  # Convert to bytes

# User models
class UserInDB(User):
    hashed_password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# Authentication utilities
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

async def authenticate_user(username: str, password: str):
    user = await get_user(username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except jwt.PyJWTError:
        raise credentials_exception
    user = await get_user(username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

# Utility functions
def calculate_file_hash(file_path: str) -> str:
    """Calculate a hash for a file to use as a unique identifier."""
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()

def text_to_chunks(text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
    """Split text into overlapping chunks."""
    if not text:
        return []
    
    sentences = [s.strip() for s in text.replace('\n', ' ').split('.') if s.strip()]
    
    chunks = []
    current_chunk = []
    current_size = 0
    
    for sentence in sentences:
        sentence_size = len(sentence)
        
        if current_size + sentence_size > chunk_size and current_chunk:
            chunks.append('. '.join(current_chunk) + '.')
            overlap_sentences = current_chunk[-3:] if len(current_chunk) > 3 else current_chunk
            current_chunk = overlap_sentences
            current_size = sum(len(s) for s in current_chunk)
        
        current_chunk.append(sentence)
        current_size += sentence_size
    
    if current_chunk:
        chunks.append('. '.join(current_chunk) + '.')
    
    return chunks

# Document processing
async def process_document(file_path: str, filename: str, user_id: str) -> Optional[str]:
    try:
        file_hash = calculate_file_hash(file_path)
        
        existing_doc = await documents_collection.find_one({
            "file_hash": file_hash,
            "user_id": user_id
        })
        
        if existing_doc:
            print(f"Document {filename} already exists for user {user_id} with hash {file_hash}")
            return file_hash
        
        text_content, success = await ocr_service.extract_text(file_path, user_id, file_hash)
        
        if not success:
            print(f"Could not extract text from {filename}")
            return None
        
        chunks = text_to_chunks(text_content)
        chunk_embeddings = []
        
        for i, chunk in enumerate(chunks):
            embedding = get_embedding(chunk)
            chunk_embeddings.append(embedding)
            
            doc_embedding = DocumentEmbedding(
                document_hash=file_hash,
                chunk_id=i,
                text=chunk,
                embedding=embedding,
                user_id=user_id
            )
            await save_document_embedding(doc_embedding)
        
        document = Document(
            file_hash=file_hash,
            filename=filename,
            user_id=user_id,
            content=text_content,
            embeddings=chunk_embeddings[0] if chunk_embeddings else []
        )
        await save_document(document)
        
        return file_hash
    except Exception as e:
        print(f"Error processing document: {e}")
        return None


# API Endpoints
@router.get("/")
def read_root():
    return WelcomeResponse(
        message="Welcome to the JCS Bot!",
        time=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    )

@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    user = await authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    await update_user_last_login(user.username)
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/register")
async def register_user(
    username: str = Form(...),
    password: str = Form(...),
    email: str = Form(...),
    full_name: str = Form(...)
):
    """
    Handles user registration. Expects data as 'multipart/form-data' or 
    'application/x-www-form-urlencoded', which is what HTML forms (and FormData objects) send.
    """
    existing_user = await get_user(username)
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    # Optional: Check for existing email if it should be unique
    # from app.db.mongodb import get_user_by_email
    # if await get_user_by_email(email):
    #     raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(password)
    # Ensure you import User as PydanticUser or use the correct name
    user = PydanticUser(
        username=username,
        email=email,
        full_name=full_name,
        hashed_password=hashed_password,
        disabled=False
    )
    await create_user(user)
    return {"message": "User registered successfully"}

@router.get("/users/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

# In backend/app/api/routes/core.py

# In backend/app/api/routes/core.py

@router.post("/chat")
async def chat(
    request: Request,
    prompt: str = Form(...),
    task: Optional[str] = Form(None),
    files: List[UploadFile] = File(None),
    session_id: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user)
):
    try:
        user_id = current_user.username
        original_prompt = prompt  # Keep the original prompt for history

        logger.info(f"Task: {task}, Prompt: {original_prompt}, User ID: {user_id}")
        session = await chat_session_manager.get_or_create_session(user_id, session_id)
        task_info = await validate_user_input(prompt, task, files)

        processed_file_hashes = []
        processed_filenames = {}
        if files:
            temp_dir = tempfile.mkdtemp()
            try:
                for file in files:
                    if not file.filename: continue
                    file_path = os.path.join(temp_dir, file.filename)
                    with open(file_path, "wb") as f:
                        shutil.copyfileobj(file.file, f)
                    
                    if file.filename.lower().endswith('.pdf'):
                        file_hash = await process_large_document(file_path, file.filename, user_id)
                    else:
                        file_hash = await process_document(file_path, file.filename, user_id)
                        
                    if file_hash:
                        processed_file_hashes.append(file_hash)
                        processed_filenames[file_hash] = file.filename
                        if file_hash not in session.active_documents:
                            session.active_documents.append(file_hash)
                            await session.save_to_db()
            finally:
                shutil.rmtree(temp_dir)

        conversation_history = await session.get_conversation_history()
        document_context = ""
        used_documents = []
        
        is_focused_task = (
            (files and processed_file_hashes) and
            any(keyword in prompt.lower() for keyword in ["summary", "summarize", "summarise", "explain", "detail"])
        )

        if is_focused_task:
            doc_hash_to_focus = processed_file_hashes[-1]
            filename_to_focus = processed_filenames.get(doc_hash_to_focus, "the uploaded document")
            prompt = f"{prompt}: '{filename_to_focus}'" # Make prompt specific
            
            logger.info(f"Focused Task: Getting FULL TEXT of document: {doc_hash_to_focus}")
            document_object = await get_document(doc_hash_to_focus, user_id)
            if document_object:
                document_context = document_object.content
                used_documents = [doc_hash_to_focus]
        
        elif session.active_documents:
            logger.info("Standard context retrieval: Using similarity search across all active documents.")
            document_context, used_documents = await session.get_document_context_with_sources(prompt)

        system_prompt = ""
        if is_focused_task and any(keyword in original_prompt.lower() for keyword in ["summary", "summarize", "summarise"]):
            logger.info("Using multi-record data extraction prompt for summarization.")
            system_prompt = ""
        if is_focused_task and any(keyword in original_prompt.lower() for keyword in ["summary", "summarize", "summarise", "explain", "detail"]):
            logger.info("Using new master prompt for descriptive and structured analysis.")
            # This new "Master Prompt" handles all document types and output styles.
            system_prompt = """
            You are an expert document analyst AI. Your task is to provide a comprehensive analysis of any document provided, following a strict two-part structure. This must be applied to ALL document types, including resumes, invoices, legal affidavits, financial statements, press releases, identification cards, and more.

            **Part 1: Document Description**
            First, begin your response with a concise introductory paragraph. In this paragraph, you MUST identify:
            1. The specific type of document (e.g., "This document is a Curriculum Vitae (CV)...", "This document is a Customer Service Form (CSF)...", "This is an e-PAN Card...").
            2. The document's primary purpose.
            3. The main subject, individual, or company it concerns.

            **Part 2: Detailed Data Extraction**
            After the introductory paragraph, provide a detailed, structured breakdown of the document's contents.
            - Use clear Markdown headings (e.g., `### Personal Information`, `### Academic Qualifications`, `### Order Details`, `### Key Clauses`). Adapt the headings to be relevant to the document's content.
            - Extract all relevant data points under these headings. Be thorough and capture details from every page.
            - For documents containing records of multiple people or items, create a separate, clearly marked section for each one (e.g., `### 1. [Full Name]`, `### 2. [Full Name]`).
            - **CRITICAL:** Do not mix information between different sections or records. Ensure all data is accurately assigned.

            **Example Structure:**

            This document is a [Document Type] for [Main Subject], outlining its [Primary Purpose].

            ### [Relevant Heading 1]
            - **[Data Point A]:** [Extracted Value]
            - **[Data Point B]:** [Extracted Value]

            ### [Relevant Heading 2]
            - **[Data Point C]:** [Extracted Value]
            """
        else:
            logger.info("Using general Q&A prompt with page-awareness.")
            system_prompt = """You are JCS Bot, an advanced enterprise assistant. Your responses should be helpful, informative, and conversational.

When answering questions:
1. If asked for a summary, provide a comprehensive summary of the document content.
2. If the user asks for a PAN number or any personal or sensitive information, and it is present in the provided document context, you MUST extract and return it.
3. Do not refuse to answer if the information is present in the document context, even if it looks like sensitive or private data.
4. Only use the document context for such answers, and do not fabricate information.
5. If the user asks about something in the uploaded documents, always use the document context provided.
6. If the user asks a general question, answer from your own knowledge.
7. If you use information from the document, cite it clearly.
8. Use both document content (if provided) and your general knowledge to give comprehensive answers.
9. Be clear about what information comes from documents vs. your general knowledge.
10. If you're speculating or giving an opinion, make that clear.
11. Your tone should be friendly but professional.
12. Format your responses clearly with good structure.
13. IMPORTANT: When referencing documents, always mention the document name in your response.
14. CRITICAL: When multiple documents are available, ONLY use the context from the most recently uploaded document for summarization or detail explanation tasks, unless explicitly asked about other documents.
15. For each new request, focus ONLY on the document context provided for that specific request.
16. The document text may contain page separators like '--- PAGE BREAK ---'. If the user asks what is on a specific page (e.g., 'what is on page 2?'), use these separators to identify and answer using only the content from that specific page.
"""

        messages = [{"role": "system", "content": system_prompt}]
        
        if document_context:
            document_names = {h: processed_filenames.get(h) for h in processed_file_hashes}
            for doc_hash in session.active_documents:
                if doc_hash not in document_names:
                    doc = await get_document(doc_hash, user_id)
                    if doc: document_names[doc_hash] = doc.filename
            
            doc_names_str = "\n".join([f"- {h}: {name}" for h, name in document_names.items() if name])
            messages.append({"role": "system", "content": f"Available documents:\n{doc_names_str}\n\nHere is the relevant document context:\n\n{document_context}"})

        # Isolate focused tasks from chat history to avoid confusion
        if not is_focused_task and conversation_history:
            logger.info("Adding conversation history to the prompt.")
            messages.append({"role": "system", "content": f"Here is the recent chat history:\n\n{conversation_history}"})

        # Use the potentially modified prompt for the LLM call
        messages.append({"role": "user", "content": prompt})
        
        async def generate_response():
            full_response_text = ""
            try:
                # This is the correct async pattern for openai > 1.0
                stream = await openai_client.chat.completions.create(
                    model=MODEL_NAME,
                    messages=messages,
                    stream=True
                )
                async for chunk in stream:
                    if chunk.choices[0].delta.content:
                        content = chunk.choices[0].delta.content
                        full_response_text += content
                        yield f"data: {json.dumps({'chunk': content})}\n\n"
            except Exception as e:
                logger.error(f"OpenAI streaming error: {e}", exc_info=True)
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                full_response_text = f"Error: {str(e)}"

            try:
                document_metadata = { "used_documents": used_documents, "document_names": {h: document_names.get(h, "Unknown") for h in used_documents}}
                await session.add_message(original_prompt, full_response_text, processed_file_hashes, document_metadata)
                
                final_doc_names = {}
                for doc_hash in session.active_documents:
                    doc = await get_document(doc_hash, user_id)
                    if doc: final_doc_names[doc_hash] = doc.filename

                success_data = {'done': True, 'session_id': session.session_id, 'active_documents': session.active_documents, 'document_names': final_doc_names}
                yield f"data: {json.dumps(success_data)}\n\n"
            except Exception as e:
                logger.error(f"Error saving message or session: {e}", exc_info=True)
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        return StreamingResponse(generate_response(), media_type="text/event-stream")

    except Exception as e:
        logger.error(f"Error in chat endpoint: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to process request: {str(e)}")
async def process_large_document(file_path: str, filename: str, user_id: str) -> Optional[str]:
    """
    Processes a PDF. It attempts a fast, direct text extraction. If the PDF is
    digital and text is extracted, it proceeds directly to embedding. If the fast
    method fails or yields no text (i.e., the PDF is scanned), it falls back
    to the Gemini OCR service.
    """
    try:
        file_hash = calculate_file_hash(file_path)
        
        existing_doc = await documents_collection.find_one({
            "file_hash": file_hash,
            "user_id": user_id
        })
        
        if existing_doc:
            logger.info(f"Document {filename} already exists for user {user_id} with hash {file_hash}")
            return file_hash

        final_text = ""
        success = False
        
        # Step 1: Attempt fast, direct text extraction with PyMuPDF (fitz)
        try:
            logger.info(f"Attempting fast text extraction for {filename}...")
            fitz_text = ""
            with fitz.open(file_path) as doc:
                for page_num in range(len(doc)):
                    page = doc.load_page(page_num)
                    fitz_text += page.get_text()
            
            # Step 2: Check if the extracted text is meaningful
            if len(fitz_text.strip()) > 100:
                logger.info(f"Successfully extracted text using fast method for {filename}. Proceeding directly to embeddings.")
                final_text = fitz_text
                success = True  # Mark as successful to skip the OCR step
            else:
                logger.info("Fast extraction yielded minimal text. Falling back to full OCR.")
                
        except Exception as e:
            logger.warning(f"Fast text extraction failed for {filename}: {e}. Falling back to full OCR.")

        # Step 3: If fast extraction was not successful, fall back to Gemini OCR
        if not success:
            logger.info(f"Extracting text from {filename} using Gemini OCR service...")
            # Note: The 'clean_extracted_text' step is now removed.
            final_text, success = await ocr_service.extract_text(file_path, user_id, file_hash)
            if not success:
                logger.error(f"Full OCR process also failed for {filename}.")
                return None
        
        # Step 4: Final check before proceeding
        if not final_text:
            logger.error(f"Could not extract text from {filename} using any method.")
            return None
        
        logger.info(f"Text processing complete. Total length: {len(final_text)}. Proceeding to embeddings.")
        
        # Step 5: Chunk the final text and generate embeddings.
        text_chunks = text_to_chunks(final_text)
        
        for i, chunk in enumerate(text_chunks):
            try:
                embedding = get_embedding(chunk)
                if embedding:
                    doc_embedding = DocumentEmbedding(
                        document_hash=file_hash,
                        chunk_id=i,
                        text=chunk,
                        embedding=embedding,
                        user_id=user_id
                    )
                    await save_document_embedding(doc_embedding)
            except Exception as e:
                logger.error(f"Error getting or saving embedding for chunk {i}: {e}")
                continue
        
        # Step 6: Save the main document metadata.
        document = Document(
            file_hash=file_hash,
            filename=filename,
            user_id=user_id,
            content=final_text,
            embeddings=[] # Representative embedding can be managed as before
        )
        await save_document(document)
        
        return file_hash
        
    except Exception as e:
        logger.error(f"Error in process_large_document for {filename}: {e}", exc_info=True)
        return None
@router.get("/health")
async def health_check():
    """Check if the API is running."""
    return {
        "status": "healthy",
        "time": datetime.now().isoformat()
    }

@router.get("/session/{session_id}")
async def get_session(session_id: str, current_user: User = Depends(get_current_user)):
    """Get chat session details."""
    try:
        session = await chat_session_manager.get_or_create_session(current_user.username, session_id)
        return {
            "session_id": session.session_id,
            "active_documents": session.active_documents,
            "last_activity": session.last_activity,
            "chat_history": session.chat_history
        }
    except Exception as e:
        print(f"Error getting session: {e}")
        raise HTTPException(status_code=500, detail=str(e))



@router.get("/documents", response_model=List[Document])
async def get_user_documents(current_user: User = Depends(get_current_user)):
    """Get all documents for the current user."""
    try:
        # Get documents for the current user
        cursor = documents_collection.find({"user_id": current_user.username})
        documents = await cursor.to_list(length=None)
        
        # Convert to Document models
        return [Document(**doc) for doc in documents] if documents else []
    except Exception as e:
        print(f"Error fetching documents: {str(e)}")  # Add logging
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch documents. Please try again later."
        )

@router.delete("/documents/{file_hash}")
async def delete_document(file_hash: str, current_user: User = Depends(get_current_user)):
    """Delete a document and its associated embeddings."""
    try:
        # Verify document ownership
        doc = await get_document(file_hash, current_user.username)
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        # Delete document
        await documents_collection.delete_one({"file_hash": file_hash, "user_id": current_user.username})
        
        # Delete associated embeddings
        await embeddings_collection.delete_many({"document_hash": file_hash, "user_id": current_user.username})
        
        # Delete associated chat messages
        await chat_history_collection.delete_many({"document_hashes": file_hash, "user_id": current_user.username})
        
        return {"message": "Document and associated data deleted successfully"}
    except Exception as e:
        print(f"Error deleting document: {str(e)}")  # Add logging
        raise HTTPException(status_code=500, detail=str(e))
@router.delete("/session/{session_id}")
async def delete_chat_session_route(session_id: str, current_user: PydanticUser = Depends(get_current_user)): # Renamed for clarity
    """End and delete a specific chat session for the current user."""
    if not current_user or not current_user.username:
        logger.error("In /session/{session_id} DELETE: current_user or current_user.username is invalid.")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user.")

    logger.info(f"User {current_user.username} attempting to delete session: {session_id}")
    try:
        # --- MODIFIED HERE: Pass current_user.username ---
        await chat_session_manager.end_session(session_id, current_user.username)
        logger.info(f"Session {session_id} processed for deletion for user {current_user.username}.")
        return {"message": "Session deleted successfully"}
    except Exception as e:
        error_traceback = traceback.format_exc()
        logger.critical(
            f"CRITICAL ERROR in DELETE /session/{session_id} for user {current_user.username}. Error: {str(e)}\nTRACEBACK:\n{error_traceback}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal server error occurred while deleting the session."
        )

@router.get("/sessions", response_model=Dict[str, List[Dict[str, Any]]])
async def get_user_sessions_list_route(current_user: PydanticUser = Depends(get_current_user)):
    if not current_user or not current_user.username:
        logger.error("In /sessions endpoint: current_user or current_user.username is invalid.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user information for fetching sessions."
        )
    
    logger.info(f"Endpoint /sessions called by user: {current_user.username}")
    try:
        sessions_data = await chat_session_manager.get_user_sessions(current_user.username)
        logger.info(f"ChatSessionManager returned {len(sessions_data)} sessions for user {current_user.username} to /sessions endpoint.")
        return {"sessions": sessions_data}

    except HTTPException as he:
        logger.error(f"HTTPException in /sessions for user {current_user.username}: {he.detail}", exc_info=False)
        raise he
    except Exception as e:
        error_traceback = traceback.format_exc()
        logger.critical(
            f"CRITICAL UNHANDLED ERROR in /sessions endpoint for user {current_user.username}. Error: {str(e)}\nTRACEBACK:\n{error_traceback}"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail="An internal server error occurred while fetching your chat sessions. Please check server logs for details."
        )