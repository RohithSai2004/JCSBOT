from typing import Dict, List, Optional
from datetime import datetime
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

    async def add_message(self, prompt: str, response: str, document_hashes: Optional[List[str]] = None):
        """Add a message to the chat history."""
        message = {
            "prompt": prompt,
            "response": response,
            "document_hashes": document_hashes or [],
            "timestamp": datetime.now()
        }
        self.chat_history.append(message)
        self.last_activity = datetime.now()
        # Save to DB after each message
        await self.save_to_db()

    async def get_context(self, limit: int = 5) -> str:
        """Get recent chat context."""
        recent_messages = self.chat_history[-limit:]
        return "\n".join([
            f"User: {msg['prompt']}\nBot: {msg['response']}"
            for msg in recent_messages
        ])

    async def get_document_context(self, prompt: str) -> str:
        """Get relevant document context for the prompt."""
        if not self.active_documents:
            return ""

        # Get query embedding
        query_embedding = get_embedding(prompt)
        
        # Check if the prompt is asking for a specific document
        document_specific = False
        target_doc = None
        
        # Check for document-specific queries
        if "summary of" in prompt.lower() or "summary from" in prompt.lower():
            # Extract document name from prompt
            doc_name = prompt.lower().split("summary of")[-1].split("summary from")[-1].strip()
            if doc_name:
                # Find the document with matching name
                for doc_hash in self.active_documents:
                    doc = await get_document(doc_hash, self.user_id)
                    if doc and doc.filename.lower() in doc_name or doc_name in doc.filename.lower():
                        target_doc = doc
                        document_specific = True
                        break
        
        document_contexts = []
        if document_specific and target_doc:
            # Process only the specific document
            doc_embeddings = await get_document_embeddings(target_doc.file_hash, self.user_id)
            if doc_embeddings:
                # Calculate similarities and get relevant chunks
                similarities = []
                for emb in doc_embeddings:
                    if emb.text.strip():
                        similarity = cosine_similarity(query_embedding, emb.embedding)
                        similarities.append((similarity, emb.text))
                
                # Sort by similarity and get top chunks
                similarities.sort(reverse=True, key=lambda x: x[0])
                relevant_chunks = [text for _, text in similarities[:5]]  # Increased to 5 chunks for better context
                
                if relevant_chunks:
                    document_contexts.append(
                        f"Content from {target_doc.filename}:\n\n" + 
                        "\n\n".join(relevant_chunks)
                    )
        else:
            # Process all active documents
            for doc_hash in self.active_documents:
                doc = await get_document(doc_hash, self.user_id)
                if doc:
                    doc_embeddings = await get_document_embeddings(doc_hash, self.user_id)
                    if doc_embeddings:
                        # Calculate similarities and get relevant chunks
                        similarities = []
                        for emb in doc_embeddings:
                            if emb.text.strip():
                                similarity = cosine_similarity(query_embedding, emb.embedding)
                                similarities.append((similarity, emb.text))
                        
                        # Sort by similarity and get top chunks
                        similarities.sort(reverse=True, key=lambda x: x[0])
                        relevant_chunks = [text for _, text in similarities[:3]]
                        
                        if relevant_chunks:
                            document_contexts.append(
                                f"Content from {doc.filename}:\n\n" + 
                                "\n\n".join(relevant_chunks)
                            )

        # Combine all document contexts
        return "\n\n---\n\n".join(document_contexts)

    async def save_to_db(self):
        """Save chat session to database."""
        session_data = {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "created_at": self.created_at,
            "last_activity": self.last_activity,
            "active_documents": self.active_documents,
            "chat_history": self.chat_history
        }
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