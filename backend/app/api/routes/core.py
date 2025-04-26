from fastapi import APIRouter, Form, UploadFile, File, Request, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
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
from dotenv import load_dotenv
from app.models.schemas import WelcomeResponse
from app.utils.guardrails import validate_user_input
import pytesseract
from app.db.mongodb import (
    get_user, create_user, update_user_last_login,
    save_document, get_document, save_chat_message,
    get_user_chat_history, save_document_embedding,
    get_document_embeddings, User, Document, ChatMessage,
    DocumentEmbedding
)

pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# JWT imports
import jwt
import secrets
from passlib.context import CryptContext

# OpenAI imports
from openai import OpenAI

# Image and PDF processing
from PIL import Image
import fitz  # PyMuPDF

# Load environment variables
load_dotenv()

# Initialize OpenAI client
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Update model name to a valid one
MODEL_NAME = "gpt-3.5-turbo"  # or "gpt-4" if you have access

router = APIRouter()

# Authentication setup
SECRET_KEY = os.getenv("SECRET_KEY", "your-very-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

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
def extract_text_from_image(file_path: str) -> str:
    """Extract text from an image using OCR."""
    image = Image.open(file_path)
    return pytesseract.image_to_string(image)

def extract_text_from_pdf(file_path: str) -> str:
    """Extract text from a PDF, with OCR fallback for scanned pages."""
    doc = fitz.open(file_path)
    full_text = ""
    for page in doc:
        text = page.get_text()
        if text.strip():
            full_text += text
        else:
            pix = page.get_pixmap(dpi=300)
            image = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            ocr_text = pytesseract.image_to_string(image)
            full_text += ocr_text
    doc.close()
    return full_text

def extract_text_via_ocr(file_path: str) -> Optional[str]:
    """Extract text from a file using OCR if needed."""
    if file_path.lower().endswith((".png", ".jpg", ".jpeg", ".tiff", ".bmp")):
        return extract_text_from_image(file_path)
    elif file_path.lower().endswith(".pdf"):
        return extract_text_from_pdf(file_path)
    return None

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

def get_embedding(text: str) -> List[float]:
    """Get embedding for text using OpenAI API."""
    response = openai_client.embeddings.create(
        input=text,
        model="text-embedding-3-small"
    )
    return response.data[0].embedding

def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    vec1 = np.array(vec1)
    vec2 = np.array(vec2)
    return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

# Document processing
async def process_document(file_path: str, filename: str, user_id: str) -> Optional[str]:
    """Process a document and return its hash."""
    try:
        file_hash = calculate_file_hash(file_path)
        
        # Check if document already exists
        existing_doc = await get_document(file_hash)
        if existing_doc:
            print(f"Document {filename} already exists with hash {file_hash}")
            return file_hash
        
        # Extract text from the document
        if file_path.lower().endswith((".txt", ".md")):
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                text_content = f.read()
        elif file_path.lower().endswith(".docx"):
            try:
                import docx
                doc = docx.Document(file_path)
                text_content = "\n".join([paragraph.text for paragraph in doc.paragraphs])
            except Exception as e:
                print(f"Error extracting text from DOCX: {e}")
                text_content = ""
        else:
            text_content = extract_text_via_ocr(file_path)
            if not text_content:
                print(f"Could not extract text from {filename}")
                return None
        
        # Create chunks and get embeddings
        chunks = text_to_chunks(text_content)
        chunk_embeddings = []
        
        for i, chunk in enumerate(chunks):
            embedding = get_embedding(chunk)
            chunk_embeddings.append(embedding)
            
            # Save chunk embedding
            doc_embedding = DocumentEmbedding(
                document_hash=file_hash,
                chunk_id=i,
                text=chunk,
                embedding=embedding
            )
            await save_document_embedding(doc_embedding)
        
        # Save document
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
    existing_user = await get_user(username)
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    hashed_password = get_password_hash(password)
    user = User(
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

@router.post("/chat")
async def chat(
    request: Request,
    prompt: str = Form(...),
    task: Optional[str] = Form(None),
    files: List[UploadFile] = File(None),
    current_user: User = Depends(get_current_user)
):
    try:
        user_id = current_user.username
        # Log inputs for debugging
        print(f"Task: {task}")
        print(f"Prompt: {prompt}")
        print(f"User ID: {user_id}")
        print(f"Files: {[file.filename for file in files] if files else 'No files'}")

        # Validate input
        task_info = await validate_user_input(prompt, task, files)

        # Process new files if any
        processed_file_hashes = []
        if files:
            temp_dir = tempfile.mkdtemp()
            try:
                for file in files:
                    if not file.filename:
                        continue
                    file_path = os.path.join(temp_dir, file.filename)
                    with open(file_path, "wb") as f:
                        content = await file.read()
                        f.write(content)
                    file_hash = await process_document(file_path, file.filename, user_id)
                    if file_hash:
                        processed_file_hashes.append(file_hash)
            finally:
                shutil.rmtree(temp_dir)
        
        # Get user's documents
        user_documents = []
        if processed_file_hashes:
            for file_hash in processed_file_hashes:
                doc = await get_document(file_hash)
                if doc:
                    user_documents.append(doc)
        
        # Get chat history
        chat_history = await get_user_chat_history(user_id, limit=5)
        
        # Prepare context
        context = ""
        if chat_history:
            context = "Recent conversation:\n" + "\n".join([
                f"User: {msg.prompt}\nBot: {msg.response}" 
                for msg in chat_history
            ])
        
        # Document-based tasks
        if task_info.task in ["summarization", "file Q&A", "comparison"] and user_documents:
            document_contexts = []
            
            for doc in user_documents:
                if task_info.task == "summarization":
                    document_contexts.append(f"Content of {doc.filename}:\n\n{doc.content}")
                else:
                    # Search for relevant chunks
                    doc_embeddings = await get_document_embeddings(doc.file_hash)
                    if doc_embeddings:
                        query_embedding = get_embedding(prompt)
                        similarities = []
                        for emb in doc_embeddings:
                            similarity = cosine_similarity(query_embedding, emb.embedding)
                            similarities.append((similarity, emb.text))
                        
                        similarities.sort(reverse=True, key=lambda x: x[0])
                        relevant_chunks = [text for _, text in similarities[:3]]
                        if relevant_chunks:
                            document_contexts.append(f"Relevant content from {doc.filename}:\n\n" + "\n\n".join(relevant_chunks))
            
            combined_context = "\n\n---\n\n".join(document_contexts)
            
            if task_info.task == "summarization":
                task_instruction = "Please provide a detailed and comprehensive summary of the following document."
            elif task_info.task == "comparison":
                task_instruction = "Please compare and contrast the following documents in detail."
            elif task_info.task == "file Q&A":
                task_instruction = "Please answer the question based on the document content. If the answer isn't in the document, clearly state that and provide your best general knowledge answer."
            
            messages = [
                {"role": "system", "content": """You are JCS Bot, an advanced enterprise assistant. Your responses should be detailed, informative, and actionable.

When answering questions about documents:
1. Always use the document content as your primary source of information.
2. If the answer isn't explicitly in the document, clearly state this but then provide helpful information based on your general knowledge.
3. Format your responses with headings, bullet points, and emphasis where appropriate.
4. For technical content, provide concrete examples and explanations.
5. Always maintain a professional, confident tone."""}
            ]
            
            if combined_context:
                messages.append({"role": "system", "content": combined_context})
            
            if context:
                messages.append({"role": "system", "content": context})
            
            messages.append({"role": "user", "content": f"{task_instruction} {prompt}"})
            
            response = openai_client.chat.completions.create(
                model=MODEL_NAME,
                messages=messages
            )
            
            response_text = response.choices[0].message.content
            
            # Save chat message
            chat_message = ChatMessage(
                user_id=user_id,
                prompt=prompt,
                response=response_text,
                document_hashes=processed_file_hashes,
                task=task_info.task
            )
            await save_chat_message(chat_message)
            
            return {"response": response_text}
        
        # General conversation
        else:
            messages = [
                {"role": "system", "content": """You are JCS Bot, an advanced enterprise assistant. Your responses should be helpful, informative, and conversational.

When answering questions:
1. Use both document content (if provided) and your general knowledge to give comprehensive answers.
2. Be clear about what information comes from documents vs. your general knowledge.
3. If you're speculating or giving an opinion, make that clear.
4. Your tone should be friendly but professional.
5. Format your responses clearly with good structure."""}
            ]
            
            if context:
                messages.append({"role": "system", "content": context})
            
            messages.append({"role": "user", "content": prompt})
            
            response = openai_client.chat.completions.create(
                model=MODEL_NAME,
                messages=messages
            )
            
            response_text = response.choices[0].message.content
            
            # Save chat message
            chat_message = ChatMessage(
                user_id=user_id,
                prompt=prompt,
                response=response_text,
                task=task_info.task
            )
            await save_chat_message(chat_message)
            
            return {"response": response_text}
            
    except Exception as e:
        print(f"Error processing request: {e}")
        return {"error": f"Failed to generate response: {str(e)}"}

@router.get("/health")
async def health_check():
    """Check if the API is running."""
    return {
        "status": "healthy",
        "time": datetime.now().isoformat()
    }
@router.get("/session/{user_id}")
async def get_session(user_id: str):
    # For now, just return an empty list of active documents
    return {"active_documents": []}