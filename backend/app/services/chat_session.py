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
        """Get relevant document context for the prompt. Supports page-specific queries and full-document extraction of all personal details, followed by a brief summary."""
        if not self.active_documents:
            return ""

        # Get query embedding
        query_embedding = get_embedding(prompt)

        # Check for page-specific queries
        import re
        page_match = re.search(r'(?:page|pg|pg\\.|pgs\\.|pages)\\s*(\\d+)', prompt, re.IGNORECASE)
        if page_match:
            page_number = int(page_match.group(1)) - 1  # 0-based index
            for doc_hash in self.active_documents:
                doc = await get_document(doc_hash, self.user_id)
                if doc:
                    doc_embeddings = await get_document_embeddings(doc_hash, self.user_id)
                    for emb in doc_embeddings:
                        if emb.chunk_id == page_number:
                            return f"Content from page {page_number+1} of {doc.filename}:\n\n{emb.text}"
            return f"No content found for page {page_number+1}."

        # Check for summary/extraction request
        if "summary of" in prompt.lower() or "summary from" in prompt.lower():
            doc_name = prompt.lower().split("summary of")[-1].split("summary from")[-1].strip()
            for doc_hash in self.active_documents:
                doc = await get_document(doc_hash, self.user_id)
                if doc and (doc_name in doc.filename.lower() or doc.filename.lower() in doc_name):
                    doc_embeddings = await get_document_embeddings(doc.file_hash, self.user_id)
                    if doc_embeddings:
                        # Sort by page number and concatenate all page texts (no filtering)
                        doc_embeddings.sort(key=lambda x: x.chunk_id)
                        full_text = "\n\n".join([emb.text.strip() for emb in doc_embeddings if emb.text.strip()])
                        if not full_text:
                            return f"No content found in {doc.filename}."
                        # Use LLM to extract and list all personal details, then provide a brief summary
                        from openai import OpenAI
                        import os
                        openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
                        try:
                            response = openai_client.chat.completions.create(
                                model="gpt-4o-mini",
                                messages=[
                                    {"role": "system", "content": "Extract and summarize all important details, data, and information from the following document. Do not omit any significant content, including personal information such as names, addresses, identification numbers, and any other sensitive or private data present in the document. Your summary should be as comprehensive as possible, covering every section and detail present in the document."},
                                    {"role": "user", "content": full_text}
                                ]
                            )
                            summary = response.choices[0].message.content.strip()
                        except Exception as e:
                            summary = f"[Error summarizing document: {str(e)}]"
                        return f"Summary for {doc.filename}:\n\n{summary}"
            return "No summaries found for the requested document."

        # Existing logic for similarity-based context
        document_contexts = []
        for doc_hash in self.active_documents:
            doc = await get_document(doc_hash, self.user_id)
            if doc:
                doc_embeddings = await get_document_embeddings(doc_hash, self.user_id)
                if doc_embeddings:
                    similarities = []
                    for emb in doc_embeddings:
                        if emb.text.strip():
                            similarity = cosine_similarity(query_embedding, emb.embedding)
                            similarities.append((similarity, emb.text))
                    similarities.sort(reverse=True, key=lambda x: x[0])
                    relevant_chunks = [text for _, text in similarities[:3]]
                    if relevant_chunks:
                        document_contexts.append(
                            f"Content from {doc.filename}:\n\n" + "\n\n".join(relevant_chunks)
                        )
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