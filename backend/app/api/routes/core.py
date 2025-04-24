from fastapi import APIRouter, Form, UploadFile, File, Request, Depends, Header
from typing import List, Optional, Dict, Any, Set
from datetime import datetime
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

# OpenAI imports
import openai
from openai import OpenAI

# Image and PDF processing
from PIL import Image
import pytesseract
import fitz  # PyMuPDF

# Load environment variables
load_dotenv()

# Initialize OpenAI client
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Set up data directories
DATA_DIR = "data"
DOCUMENT_DIR = os.path.join(DATA_DIR, "documents")
TEXT_CONTENT_DIR = os.path.join(DATA_DIR, "text_content")
EMBEDDING_DIR = os.path.join(DATA_DIR, "embeddings")
DOCUMENT_CACHE_PATH = os.path.join(DATA_DIR, "document_cache.json")
MEMORY_PATH = os.path.join(DATA_DIR, "conversation_memory.json")

# Ensure directories exist
for directory in [DOCUMENT_DIR, TEXT_CONTENT_DIR, EMBEDDING_DIR]:
    os.makedirs(directory, exist_ok=True)
os.makedirs(os.path.dirname(DOCUMENT_CACHE_PATH), exist_ok=True)

router = APIRouter()

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
            # If page has no text, fallback to OCR on image
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
    
    # Split text into sentences (simple approach)
    sentences = [s.strip() for s in text.replace('\n', ' ').split('.') if s.strip()]
    
    chunks = []
    current_chunk = []
    current_size = 0
    
    for sentence in sentences:
        sentence_size = len(sentence)
        
        if current_size + sentence_size > chunk_size and current_chunk:
            # Store the current chunk
            chunks.append('. '.join(current_chunk) + '.')
            
            # Keep some sentences for overlap
            overlap_sentences = current_chunk[-3:] if len(current_chunk) > 3 else current_chunk
            current_chunk = overlap_sentences
            current_size = sum(len(s) for s in current_chunk)
        
        current_chunk.append(sentence)
        current_size += sentence_size
    
    # Add the last chunk if it's not empty
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

# Document storage and retrieval
class DocumentManager:
    def __init__(self):
        self.cache_path = DOCUMENT_CACHE_PATH
        self.text_dir = TEXT_CONTENT_DIR
        self.embedding_dir = EMBEDDING_DIR
        
        # Load document cache
        if os.path.exists(self.cache_path):
            with open(self.cache_path, 'r') as f:
                self.document_cache = json.load(f)
        else:
            self.document_cache = {}
    
    def save_cache(self):
        """Save document cache to disk."""
        with open(self.cache_path, 'w') as f:
            json.dump(self.document_cache, f)
    
    def process_document(self, file_path: str, filename: str) -> str:
        """Process a document and return its hash."""
        file_hash = calculate_file_hash(file_path)
        
        # Check if document is already cached
        if file_hash in self.document_cache:
            print(f"Document {filename} already cached with hash {file_hash}")
            self.document_cache[file_hash]["last_used"] = datetime.now().isoformat()
            self.save_cache()
            return file_hash
        
        # Extract text from the document
        if file_path.lower().endswith((".txt", ".md", ".docx")):
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                text_content = f.read()
        else:
            text_content = extract_text_via_ocr(file_path)
            if not text_content:
                print(f"Could not extract text from {filename}")
                return None
        
        # Save extracted text content
        text_file_path = os.path.join(self.text_dir, f"{file_hash}.txt")
        with open(text_file_path, 'w', encoding='utf-8') as f:
            f.write(text_content)
        
        # Create chunks and get embeddings
        chunks = text_to_chunks(text_content)
        chunk_data = []
        
        for i, chunk in enumerate(chunks):
            embedding = get_embedding(chunk)
            chunk_data.append({
                "chunk_id": i,
                "text": chunk,
                "embedding": embedding
            })
        
        # Save chunk embeddings
        embeddings_path = os.path.join(self.embedding_dir, f"{file_hash}.pkl")
        with open(embeddings_path, 'wb') as f:
            pickle.dump(chunk_data, f)
        
        # Update document cache
        self.document_cache[file_hash] = {
            "filename": filename,
            "created_at": datetime.now().isoformat(),
            "last_used": datetime.now().isoformat(),
            "num_chunks": len(chunks)
        }
        self.save_cache()
        
        return file_hash
    
    def get_document_text(self, file_hash: str) -> Optional[str]:
        """Get full text content for a document."""
        text_path = os.path.join(self.text_dir, f"{file_hash}.txt")
        if os.path.exists(text_path):
            with open(text_path, 'r', encoding='utf-8') as f:
                return f.read()
        return None
    
    def get_document_chunks(self, file_hash: str) -> List[Dict]:
        """Get chunks and embeddings for a document."""
        embeddings_path = os.path.join(self.embedding_dir, f"{file_hash}.pkl")
        if os.path.exists(embeddings_path):
            with open(embeddings_path, 'rb') as f:
                return pickle.load(f)
        return []
    
    def search_document(self, file_hash: str, query: str, top_k: int = 3) -> List[str]:
        """Search for relevant chunks in a specific document."""
        if file_hash not in self.document_cache:
            return []
        
        # Get query embedding
        query_embedding = get_embedding(query)
        
        # Get document chunks
        chunks = self.get_document_chunks(file_hash)
        if not chunks:
            return []
        
        # Calculate similarity for each chunk
        similarities = []
        for chunk in chunks:
            chunk_embedding = chunk["embedding"]
            similarity = cosine_similarity(query_embedding, chunk_embedding)
            similarities.append((similarity, chunk["text"]))
        
        # Sort by similarity and return top_k chunks
        similarities.sort(reverse=True, key=lambda x: x[0])
        return [text for _, text in similarities[:top_k]]
    
    def list_documents(self) -> Dict:
        """List all cached documents."""
        return self.document_cache
    
    def delete_document(self, file_hash: str) -> bool:
        """Delete a document and its associated files."""
        if file_hash not in self.document_cache:
            return False
        
        # Remove from cache
        del self.document_cache[file_hash]
        self.save_cache()
        
        # Delete text file
        text_path = os.path.join(self.text_dir, f"{file_hash}.txt")
        if os.path.exists(text_path):
            os.remove(text_path)
        
        # Delete embeddings file
        embeddings_path = os.path.join(self.embedding_dir, f"{file_hash}.pkl")
        if os.path.exists(embeddings_path):
            os.remove(embeddings_path)
        
        return True

# Memory management
class MemoryManager:
    def __init__(self):
        self.memory_path = MEMORY_PATH
        
        # Load memory
        if os.path.exists(self.memory_path):
            with open(self.memory_path, 'r') as f:
                self.memory = json.load(f)
        else:
            self.memory = []
    
    def save_memory(self):
        """Save memory to disk."""
        with open(self.memory_path, 'w') as f:
            json.dump(self.memory, f)
    
    def add_memory(self, user_id: str, prompt: str, response: str, 
                  task: Optional[str] = None, 
                  document_hashes: Optional[List[str]] = None):
        """Add a conversation to memory."""
        self.memory.append({
            "user_id": user_id,
            "prompt": prompt,
            "response": response,
            "task": task,
            "document_hashes": document_hashes or [],
            "timestamp": datetime.now().isoformat()
        })
        
        # Keep only recent memories
        if len(self.memory) > 100:
            self.memory = self.memory[-100:]
        
        self.save_memory()
    
    def get_user_memory(self, user_id: str, limit: int = 5, 
                       document_hashes: Optional[List[str]] = None) -> List[Dict]:
        """Get memories for a user, optionally filtered by document."""
        user_memories = [m for m in self.memory if m["user_id"] == user_id]
        
        if document_hashes:
            # Filter by document hashes
            relevant_memories = []
            for memory in user_memories:
                if any(h in memory.get("document_hashes", []) for h in document_hashes):
                    relevant_memories.append(memory)
            
            # If we have enough relevant memories, return those
            if len(relevant_memories) >= limit:
                return relevant_memories[-limit:]
            
            # Otherwise, include some general memories
            return relevant_memories + [m for m in user_memories if m not in relevant_memories][-limit:]
        
        # If no document filter, return most recent memories
        return user_memories[-limit:]
    
    def clear_user_memory(self, user_id: str) -> int:
        """Clear memories for a user. Returns number of memories cleared."""
        original_count = len(self.memory)
        self.memory = [m for m in self.memory if m["user_id"] != user_id]
        self.save_memory()
        return original_count - len(self.memory)

# Initialize managers
document_manager = DocumentManager()
memory_manager = MemoryManager()

@router.get("/")
def read_root():
    return WelcomeResponse(
        message="Welcome to the JCS Bot!",
        time=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    )

@router.post("/chat")
async def chat(
    request: Request,
    prompt: str = Form(...),
    task: Optional[str] = Form(None),
    user_id: str = Form("default_user"),
    files: Optional[List[UploadFile]] = File(None)
):
    # Log inputs
    print(f"Task: {task}")
    print(f"Prompt: {prompt}")
    print(f"User ID: {user_id}")
    print(f"Files: {[file.filename for file in files] if files else 'No files'}")

    # Validate input
    task_info = validate_user_input(prompt, task, files)

    # General conversation without files
    if task_info.task == "general conversation" and not files:
        try:
            # Get user memories
            recent_memories = memory_manager.get_user_memory(user_id, limit=3)
            memory_context = ""
            if recent_memories:
                memory_context = "Recent conversation:\n" + "\n".join([
                    f"User: {m['prompt']}\nBot: {m['response']}" 
                    for m in recent_memories
                ])
            
            # Generate response
            messages = [
                {"role": "system", "content": "You are JCS Bot, an enterprise assistant. Be concise and informative."}
            ]
            
            if memory_context:
                messages.append({"role": "system", "content": memory_context})
            
            messages.append({"role": "user", "content": prompt})
            
            response = openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=messages
            )
            
            response_text = response.choices[0].message.content
            
            # Store in memory
            memory_manager.add_memory(user_id, prompt, response_text, task_info.task)
            
            return {"response": response_text}
        
        except Exception as e:
            print(f"Error in general conversation: {e}")
            return {"error": f"Failed to generate response: {str(e)}"}
    
    # Document-based tasks
    elif task_info.task in ["summarization", "file Q&A", "comparison"]:
        temp_dir = tempfile.mkdtemp()
        try:
            processed_file_hashes = []
            
            # Process each file
            for file in files:
                file_path = os.path.join(temp_dir, file.filename)
                with open(file_path, "wb") as f:
                    f.write(file.file.read())
                
                # Process document and get its hash
                file_hash = document_manager.process_document(file_path, file.filename)
                if file_hash:
                    processed_file_hashes.append(file_hash)
            
            if not processed_file_hashes:
                return {"error": "No valid documents were processed."}
            
            # Now process each document individually
            document_contexts = []
            
            for file_hash in processed_file_hashes:
                filename = document_manager.document_cache[file_hash]["filename"]
                
                # For summarization or file Q&A of a single document, use full text
                if len(processed_file_hashes) == 1 and task_info.task in ["summarization", "file Q&A"]:
                    document_text = document_manager.get_document_text(file_hash)
                    document_contexts.append(f"Content of {filename}:\n\n{document_text}")
                else:
                    # For comparison or multiple documents, use relevant chunks
                    relevant_chunks = document_manager.search_document(file_hash, prompt, top_k=3)
                    if relevant_chunks:
                        chunks_text = "\n\n".join(relevant_chunks)
                        document_contexts.append(f"Relevant content from {filename}:\n\n{chunks_text}")
            
            # Combine all document contexts
            combined_context = "\n\n---\n\n".join(document_contexts)
            
            # Generate task-specific instructions
            if task_info.task == "summarization":
                task_instruction = "Please provide a decent and full summary of the following document."
            elif task_info.task == "comparison":
                task_instruction = "Please compare and contrast the following documents."
            elif task_info.task == "file Q&A":
                task_instruction = "Please answer the question based on the document content."
            
            # Get recent relevant memories
            recent_memories = memory_manager.get_user_memory(
                user_id, limit=2, document_hashes=processed_file_hashes
            )
            memory_context = ""
            if recent_memories:
                memory_context = "Recent related conversations:\n" + "\n".join([
                    f"User: {m['prompt']}\nBot: {m['response']}" 
                    for m in recent_memories
                ])
            
            # Generate response
            messages = [
                {"role": "system", "content": "You are JCS Bot, an enterprise assistant. Answer based on the provided document content."}
            ]
            
            document_names = [document_manager.document_cache[h]["filename"] for h in processed_file_hashes]
            messages.append({"role": "system", "content": f"Documents being analyzed: {', '.join(document_names)}"})
            messages.append({"role": "system", "content": combined_context})
            
            if memory_context:
                messages.append({"role": "system", "content": memory_context})
            
            messages.append({"role": "user", "content": f"{task_instruction} {prompt}"})
            
            response = openai_client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=messages
            )
            
            response_text = response.choices[0].message.content
            
            # Store in memory
            memory_manager.add_memory(
                user_id, prompt, response_text, 
                task_info.task, processed_file_hashes
            )
            
            return {"response": response_text}
        
        except Exception as e:
            print(f"Error in document processing: {e}")
            return {"error": f"Failed to process documents: {str(e)}"}
        
        finally:
            shutil.rmtree(temp_dir)
    
    return {"message": "Task not recognized or unsupported."}

@router.get("/documents")
async def list_documents():
    """List all cached documents."""
    return {"documents": document_manager.list_documents()}

@router.get("/document/{file_hash}")
async def get_document_info(file_hash: str):
    """Get information about a specific document."""
    cache = document_manager.list_documents()
    if file_hash not in cache:
        return {"error": "Document not found"}
    
    # Get document info
    doc_info = cache[file_hash]
    
    # Get sample text
    text = document_manager.get_document_text(file_hash)
    doc_info["sample"] = text[:200] + "..." if text and len(text) > 200 else text
    
    return {"document": doc_info}

@router.delete("/document/{file_hash}")
async def delete_document(file_hash: str):
    """Delete a document from the cache."""
    if document_manager.delete_document(file_hash):
        return {"message": "Document deleted successfully"}
    return {"error": "Document not found"}

@router.get("/memory/{user_id}")
async def get_user_memory(user_id: str, limit: int = 10):
    """Get memory for a user."""
    memories = memory_manager.get_user_memory(user_id, limit=limit)
    return {"memories": memories}

@router.delete("/memory/{user_id}")
async def clear_user_memory(user_id: str):
    """Clear memory for a user."""
    num_cleared = memory_manager.clear_user_memory(user_id)
    return {"message": f"Cleared {num_cleared} memories for user {user_id}"}