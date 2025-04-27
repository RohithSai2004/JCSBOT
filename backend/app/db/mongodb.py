import motor.motor_asyncio
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
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
    user = await users_collection.find_one({"username": username})
    return User(**user) if user else None

async def create_user(user: User) -> None:
    await users_collection.insert_one(user.dict())

async def update_user_last_login(username: str) -> None:
    await users_collection.update_one(
        {"username": username},
        {"$set": {"last_login": datetime.utcnow()}}
    )

async def save_document(document: Document) -> None:
    await documents_collection.insert_one(document.dict())

async def get_document(file_hash: str, user_id: str) -> Optional[Document]:
    doc = await documents_collection.find_one({
        "file_hash": file_hash,
        "user_id": user_id
    })
    return Document(**doc) if doc else None

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
    })
    embeddings = await cursor.to_list(length=None)
    return [DocumentEmbedding(**emb) for emb in embeddings] 