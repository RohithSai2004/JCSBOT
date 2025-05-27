import motor.motor_asyncio
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

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

class Document(BaseModel):
    file_hash: str
    filename: str
    user_id: str
    content: str
    embeddings: List[float] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ChatMessage(BaseModel):
    user_id: str
    prompt: str
    response: str
    document_hashes: List[str] = []
    task: Optional[str] = None
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

async def get_document_embeddings(document_hash: str, user_id: str) -> List[DocumentEmbedding]:
    cursor = embeddings_collection.find({
        "document_hash": document_hash,
        "user_id": user_id
    }).sort("chunk_id", 1)
    embeddings = await cursor.to_list(length=None)
    return [DocumentEmbedding(**emb) for emb in embeddings]

async def setup_mongodb_indexes():
    """Set up MongoDB indexes for optimal performance and data management."""
    # User collection indexes
    await users_collection.create_index("username", unique=True)
    await users_collection.create_index("email", unique=True)
    
    # Document collection indexes
    await documents_collection.create_index([("file_hash", 1), ("user_id", 1)], unique=True)
    await documents_collection.create_index("user_id")
    await documents_collection.create_index("created_at")
    
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