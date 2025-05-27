from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import uuid
import numpy as np
from app.db.mongodb import (
    chat_history_collection,
    documents_collection,
    get_document,
    get_document_embeddings
)
from app.utils.embeddings import get_embedding, cosine_similarity

class ChatSession:
    def __init__(self, user_id: str, session_id: Optional[str] = None):
        self.session_id = session_id if session_id else str(uuid.uuid4())
        self.user_id = user_id
        self.created_at = datetime.now()
        self.last_activity = datetime.now()
        self.active_documents: List[str] = []  # List of document hashes
        self.chat_history: List[Dict] = []

    async def add_message(self, prompt: str, response: str, document_hashes: Optional[List[str]] = None, document_metadata: Optional[Dict] = None):
        """Add a message to the chat history."""
        # Only add message if prompt or response is not empty
        if not prompt.strip() and not response.strip():
            return
            
        timestamp = datetime.now().isoformat()
        message = {
            "prompt": prompt,
            "response": response,
            "timestamp": timestamp,
            "document_hashes": document_hashes or [],
            "document_metadata": document_metadata or {}
        }
        self.chat_history.append(message)
        self.last_activity = timestamp
        
        # If documents were referenced, add them to active documents
        if document_hashes:
            for doc_hash in document_hashes:
                if doc_hash not in self.active_documents:
                    self.active_documents.append(doc_hash)
                    
        await self.save_to_db()

    async def get_context(self, limit: int = 5) -> str:
        """Get recent chat context."""
        recent_messages = self.chat_history[-limit:]
        return "\n".join([
            f"User: {msg['prompt']}\nBot: {msg['response']}"
            for msg in recent_messages
        ])

    async def get_document_context_with_sources(self, prompt: str) -> Tuple[str, List[str]]:
        """Get relevant document context based on the prompt and return used document hashes."""
        if not self.active_documents:
            return "", []
        
        # Get embedding for the prompt
        prompt_embedding = get_embedding(prompt)
        
        # Get all document embeddings for active documents
        document_contexts = []
        used_documents = set()
        
        for doc_hash in self.active_documents:
            # Get document embeddings
            embeddings = await get_document_embeddings(doc_hash, self.user_id)
            
            if not embeddings:
                continue
            
            # Find most similar chunks
            similarities = []
            for embedding in embeddings:
                similarity = cosine_similarity(prompt_embedding, embedding.embedding)
                similarities.append((similarity, embedding))
            
            # Sort by similarity and take top 3
            similarities.sort(reverse=True, key=lambda x: x[0])
            top_chunks = similarities[:3]
            
            # If any chunk is relevant enough (similarity > 0.7), add it to context
            relevant_chunks = [chunk for sim, chunk in top_chunks if sim > 0.7]
            
            if relevant_chunks:
                for chunk in relevant_chunks:
                    document_contexts.append(f"Document {doc_hash} (Chunk {chunk.chunk_id}):\n{chunk.text}\n")
                    used_documents.add(doc_hash)
            
            # If no chunks are relevant enough but this is the only document, include top chunk anyway
            elif len(self.active_documents) == 1 and top_chunks:
                top_chunk = top_chunks[0][1]
                document_contexts.append(f"Document {doc_hash} (Chunk {top_chunk.chunk_id}):\n{top_chunk.text}\n")
                used_documents.add(doc_hash)
        
        # Combine all contexts
        combined_context = "\n".join(document_contexts)
        
        return combined_context, list(used_documents)

    async def save_to_db(self):
        """Save the session to the database."""
        # Skip saving if there's no chat history
        if not self.chat_history:
            return
            
        session_data = {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "created_at": self.created_at,
            "last_activity": self.last_activity,
            "chat_history": self.chat_history,
            "active_documents": self.active_documents
        }
        
        # Use upsert to create or update
        await chat_history_collection.update_one(
            {"session_id": self.session_id},
            {"$set": session_data},
            upsert=True
        )

    @classmethod
    async def load_from_db(cls, session_id: str, user_id: str) -> Optional['ChatSession']:
        """Load chat session from database."""
        session_data = await chat_history_collection.find_one({
            "session_id": session_id,
            "user_id": user_id
        })
        
        if session_data:
            session = cls(user_id)
            session.session_id = session_data["session_id"]
            session.created_at = session_data["created_at"]
            session.last_activity = session_data["last_activity"]
            session.active_documents = session_data["active_documents"]
            session.chat_history = session_data["chat_history"]
            return session
        return None

class ChatSessionManager:
    def __init__(self):
        self.sessions: Dict[str, ChatSession] = {}

    async def get_or_create_session(self, user_id: str, session_id: Optional[str] = None) -> ChatSession:
        """Get existing session or create new one."""
        # If session_id is provided, try to load existing session
        if session_id and session_id.strip():
            # First check in-memory sessions
            if session_id in self.sessions:
                session = self.sessions[session_id]
                session.last_activity = datetime.now()
                return session
            
            # Then try to load from database
            session = await ChatSession.load_from_db(session_id, user_id)
            if session:
                self.sessions[session_id] = session
                return session

        # Create new session only if no valid session_id was provided
        session = ChatSession(user_id, session_id)
        self.sessions[session.session_id] = session
        await session.save_to_db()
        return session

    async def get_user_sessions(self, user_id: str, days: int = 15) -> List[Dict]:
        """Get all sessions for a user within the specified number of days."""
        cutoff_date = datetime.now() - timedelta(days=days)
        
        cursor = chat_history_collection.find({
            "user_id": user_id,
            "last_activity": {"$gte": cutoff_date}
        }).sort("last_activity", -1)  # Sort by most recent first
        
        sessions = await cursor.to_list(length=None)
        return sessions

    async def end_session(self, session_id: str):
        """End a chat session."""
        if session_id in self.sessions:
            session = self.sessions[session_id]
            await session.save_to_db()
            del self.sessions[session_id]
            
            # Also remove from database
            await chat_history_collection.delete_one({
                "session_id": session_id
            })

# Global session manager
chat_session_manager = ChatSessionManager() 