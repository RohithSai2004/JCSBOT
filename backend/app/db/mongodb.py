import motor.motor_asyncio
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

import os
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

# MongoDB connection setup
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
DATABASE_NAME = os.getenv("DATABASE_NAME", "jcsbot")

# Initialize MongoDB client
client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URL)
db = client[DATABASE_NAME]

# Collections
users_collection = db["users"]
documents_collection = db["documents"]
chat_history_collection = db["chat_history"]
embeddings_collection = db["embeddings"]
knowledge_base_collection = db["knowledge_base"]
usage_collection = db["usage"]
deleted_documents_collection = db["deleted_documents"]
chat_metrics_collection = db["chat_metrics"]

# Models
class User(BaseModel):
    username: str
    email: str
    full_name: str
    hashed_password: str
    disabled: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_login: Optional[datetime] = None
    reset_token: Optional[str] = None
    reset_token_expiry: Optional[datetime] = None
    is_admin: bool = False


class Document(BaseModel):
    file_hash: str
    filename: str
    user_id: str
    content: str
    doc_type: Optional[str] = "text"
    is_knowledge_base: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)
    # Add page_count for OCR cost calculation
    page_count: Optional[int] = 0
    # Add token_count for embedding cost calculation
    token_count: Optional[int] = 0
    embeddings: List[float] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_knowledge_base: bool = False 

class ChatMessage(BaseModel):
    user_id: str
    # Add session_id if it's not already there
    session_id: str
    prompt: str
    response: str
    document_hashes: List[str] = []
    # Add document_metadata if it's not already there
    document_metadata: Dict = {}
    task: Optional[str] = None
    # Add token counts for precise chat cost calculation
    input_tokens: Optional[int] = 0
    output_tokens: Optional[int] = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
class DocumentEmbedding(BaseModel):
    document_hash: str
    chunk_id: int
    text: str
    embedding: List[float]
    user_id: str
    created_at: datetime = Field(default_factory=datetime.utcnow)

# Database operations
async def get_user(username: str) -> Optional[User]:
    user_data = await users_collection.find_one({"username": username})
    return User(**user_data) if user_data else None

async def get_user_by_email(email: str) -> Optional[User]:
    user_data = await users_collection.find_one({"email": email})
    return User(**user_data) if user_data else None

async def create_user(user: User) -> None:
    await users_collection.insert_one(user.dict())

async def update_user(user: User) -> None:
    await users_collection.replace_one({"_id": user.dict().get('_id')}, user.dict(by_alias=True))

async def update_user_last_login(username: str) -> None:
    await users_collection.update_one(
        {"username": username},
        {"$set": {"last_login": datetime.utcnow()}}
    )

async def save_document(document: Document) -> None:
    # Check if document already exists
    existing_doc = await documents_collection.find_one({
        "file_hash": document.file_hash,
        "user_id": document.user_id
    })
    
    if existing_doc:
        # Update existing document
        await documents_collection.update_one(
            {"file_hash": document.file_hash, "user_id": document.user_id},
            {"$set": document.dict()}
        )
    else:
        # Insert new document
        await documents_collection.insert_one(document.dict())

async def get_document(file_hash: str, user_id: str) -> Optional[Document]:
    doc_data = await documents_collection.find_one({
        "file_hash": file_hash,
        "user_id": user_id
    })
    return Document(**doc_data) if doc_data else None

async def save_chat_message(message: ChatMessage) -> None:
    await chat_history_collection.insert_one(message.dict())

async def get_user_chat_history(user_id: str, limit: int = 10) -> List[ChatMessage]:
    cursor = chat_history_collection.find(
        {"user_id": user_id}
    ).sort("created_at", -1).limit(limit)
    messages = await cursor.to_list(length=limit)
    return [ChatMessage(**msg) for msg in messages]

async def save_document_embedding(embedding: DocumentEmbedding) -> None:
    await embeddings_collection.insert_one(embedding.dict())

async def get_document_embeddings(document_hash: str, user_id: str = None) -> List[DocumentEmbedding]:
    """Get embeddings for a document."""
    try:
        query = {"document_hash": document_hash}
        if user_id:
            query["user_id"] = user_id
            
        embeddings = await embeddings_collection.find(query).to_list(length=None)
        
        if not embeddings:
            logger.warning(f"No embeddings found for document {document_hash}")
            return []
            
        # Add validation to ensure required fields exist
        valid_embeddings = []
        for emb in embeddings:
            # Check if required fields exist
            if 'chunk_id' not in emb or 'text' not in emb:
                logger.warning(f"Embedding document missing required fields: {emb.get('_id')}")
                continue
                
            # Ensure embedding field exists and is properly formatted
            if 'embedding' not in emb or not emb['embedding']:
                logger.warning(f"Embedding field missing for chunk {emb.get('chunk_id')}")
                continue
                
            valid_embeddings.append(emb)
            
        if len(valid_embeddings) < len(embeddings):
            logger.warning(f"Filtered out {len(embeddings) - len(valid_embeddings)} invalid embeddings")
            
        # Only create DocumentEmbedding objects for valid embeddings
        return [DocumentEmbedding(**emb) for emb in valid_embeddings]
    except Exception as e:
        logger.error(f"Error retrieving embeddings for document {document_hash}: {e}")
        return []

async def get_document_embeddings_for_document(document_hash: str, user_id: str) -> List[DocumentEmbedding]:
    """Get document embeddings for a specific document."""
    cursor = embeddings_collection.find({
        "document_hash": document_hash,
        "user_id": user_id
    })
    embeddings = []
    async for doc in cursor:
        embedding = DocumentEmbedding(
            document_hash=doc["document_hash"],
            chunk_id=doc["chunk_id"],
            text=doc["text"],
            embedding=doc["embedding"],
            user_id=doc["user_id"]
        )
        embeddings.append(embedding)
    return embeddings

async def create_indexes():
    # Create indexes for documents collection
    await documents_collection.create_index([("file_hash", 1), ("user_id", 1)], unique=True)
    await documents_collection.create_index("user_id")
    await documents_collection.create_index("created_at")
    
    # Indexes for deleted documents
    await deleted_documents_collection.create_index("user_id")
    await deleted_documents_collection.create_index("deleted_at")
    
    # Indexes for chat metrics
    await chat_metrics_collection.create_index([("user_id", 1), ("session_id", 1)], unique=True)
    await chat_metrics_collection.create_index("created_at")

async def setup_mongodb_indexes():
    """Set up MongoDB indexes for optimal performance and data management."""
    # User collection indexes
    await users_collection.create_index("username", unique=True)
    await users_collection.create_index("email", unique=True)
    
    # Document collection indexes
    await create_indexes()
    
    # Chat history collection indexes
    await chat_history_collection.create_index([("session_id", 1), ("user_id", 1)], unique=True)
    await chat_history_collection.create_index("user_id")
    await chat_history_collection.create_index("created_at")
    
    # Add TTL index for chat history (15 days)
    await chat_history_collection.create_index(
        "last_activity", 
        expireAfterSeconds=15 * 24 * 60 * 60  # 15 days in seconds
    )
    
    # Embeddings collection indexes
    await embeddings_collection.create_index([("document_hash", 1), ("user_id", 1)])
    await embeddings_collection.create_index([("document_hash", 1), ("chunk_id", 1)])
    await embeddings_collection.create_index("user_id")

knowledge_base_collection = db["knowledge_base"]

async def get_document_with_full_content(document_hash: str, user_id: str):
    """Get a document with its full content."""
    doc = await documents_collection.find_one({
        "file_hash": document_hash,
        "user_id": user_id
    })
    
    if not doc:
        return None
    
    # Ensure content is available and not empty
    if "content" not in doc or not doc["content"]:
        logger.warning(f"Document {document_hash} has no content")
        return None
    
    return doc