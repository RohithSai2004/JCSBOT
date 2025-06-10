# backend/app/services/chat_session.py

from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import uuid
import logging
# import numpy as np # Only if you are using numpy for cosine_similarity directly

# Make sure these are correctly imported
from app.db.mongodb import (
    chat_history_collection,
    get_document_embeddings,  # Crucial for fetching chunk text
    get_document_embeddings_for_document  # Added for fetching embeddings for a specific document
)
from app.utils.embeddings import get_embedding

logger = logging.getLogger(__name__)

def cosine_similarity(vec1, vec2):
    """Calculate cosine similarity between two vectors."""
    dot_product = sum(a * b for a, b in zip(vec1, vec2))
    magnitude1 = sum(a * a for a in vec1) ** 0.5
    magnitude2 = sum(b * b for b in vec2) ** 0.5
    if magnitude1 * magnitude2 == 0:
        return 0
    return dot_product / (magnitude1 * magnitude2)

class ChatSession:
    # ... (keep __init__, add_message, save_to_db, load_from_db, get_context as previously corrected) ...
    def __init__(self, user_id: str, session_id: Optional[str] = None):
        self.session_id = session_id if session_id and session_id.strip() else str(uuid.uuid4())
        self.user_id = user_id
        self.created_at: datetime = datetime.now()
        self.last_activity: datetime = datetime.now()
        self.active_documents: List[str] = []
        self.chat_history: List[Dict] = []

    async def add_message(self, prompt: str, response: str, document_hashes: Optional[List[str]] = None, document_metadata: Optional[Dict] = None):
        if not prompt.strip() and not response.strip():
            logger.debug(f"Skipping empty message for session {self.session_id}")
            return
            
        message_timestamp = datetime.now() 
        message = {
            "prompt": prompt,
            "response": response,
            "timestamp": message_timestamp.isoformat(),
            "document_hashes": document_hashes or [],
            "document_metadata": document_metadata or {}
        }
        self.chat_history.append(message)
        self.last_activity = message_timestamp 
        
        if document_hashes:
            for doc_hash in document_hashes:
                if doc_hash not in self.active_documents:
                    self.active_documents.append(doc_hash)
                    
        await self.save_to_db()
        logger.info(f"Message added and session {self.session_id} saved.")


    async def save_to_db(self):
        session_data = {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "created_at": self.created_at, 
            "last_activity": self.last_activity, 
            "chat_history": self.chat_history,
            "active_documents": self.active_documents
        }
        
        if not isinstance(session_data["created_at"], datetime):
            try:
                parsed_date = datetime.fromisoformat(str(session_data["created_at"]).replace("Z", "+00:00"))
                session_data["created_at"] = parsed_date
            except (TypeError, ValueError):
                logger.warning(f"Could not parse created_at for session {self.session_id} ('{session_data['created_at']}'), defaulting to now.", exc_info=False)
                session_data["created_at"] = datetime.now() 

        if not isinstance(session_data["last_activity"], datetime):
            try:
                parsed_date = datetime.fromisoformat(str(session_data["last_activity"]).replace("Z", "+00:00"))
                session_data["last_activity"] = parsed_date
            except (TypeError, ValueError):
                 logger.warning(f"Could not parse last_activity for session {self.session_id} ('{session_data['last_activity']}'), defaulting to now.", exc_info=False)
                 session_data["last_activity"] = datetime.now()
        
        try:
            await chat_history_collection.update_one(
                {"session_id": self.session_id, "user_id": self.user_id}, 
                {"$set": session_data},
                upsert=True
            )
            logger.debug(f"Session {self.session_id} upserted to DB.")
        except Exception as e:
            logger.error(f"Failed to save session {self.session_id} to DB: {e}", exc_info=True)
            raise

    @classmethod
    async def load_from_db(cls, session_id: str, user_id: str) -> Optional['ChatSession']:
        try:
            session_data = await chat_history_collection.find_one({
                "session_id": session_id,
                "user_id": user_id
            })
        except Exception as e:
            logger.error(f"DB error loading session {session_id} for user {user_id}: {e}", exc_info=True)
            return None
        
        if session_data:
            session = cls(user_id, session_id)
            session.created_at = session_data.get("created_at") 
            session.last_activity = session_data.get("last_activity")
            
            if not isinstance(session.created_at, datetime):
                try:
                    session.created_at = datetime.fromisoformat(str(session.created_at).replace("Z", "+00:00"))
                except (TypeError, ValueError):
                    logger.warning(f"Loaded session {session_id} with invalid created_at ('{session.created_at}'), defaulting.", exc_info=False)
                    # Defaults to __init__ time
            
            if not isinstance(session.last_activity, datetime):
                try:
                    session.last_activity = datetime.fromisoformat(str(session.last_activity).replace("Z", "+00:00"))
                except (TypeError, ValueError):
                    logger.warning(f"Loaded session {session_id} with invalid last_activity ('{session.last_activity}'), defaulting.", exc_info=False)
                    # Defaults to __init__ time

            session.active_documents = session_data.get("active_documents", [])
            session.chat_history = session_data.get("chat_history", [])
            logger.debug(f"Session {session_id} loaded from DB for user {user_id}.")
            return session
        logger.debug(f"Session {session_id} not found in DB for user {user_id}.")
        return None
    
    async def get_context(self, limit: int = 5) -> str:
        if not self.chat_history: return ""
        recent_messages = self.chat_history[-limit:]
        return "\n".join([
             f"User: {msg.get('prompt', '[No Prompt]')}\nBot: {msg.get('response', '[No Response]')}"
            for msg in recent_messages if isinstance(msg, dict)
        ])

    async def get_document_context_with_sources(self, prompt: str, top_k_chunks: int = 3, similarity_threshold: float = 0.70) -> Tuple[str, List[str]]:
        """
        Get relevant document context based on the prompt by fetching document chunks,
        calculating similarity, and returning the text of the most relevant chunks.
        Returns the combined text and a list of document hashes from which context was derived.
        """
        if not self.active_documents:
            logger.debug(f"Session {self.session_id}: No active documents to fetch context from.")
            return "", []
        
        logger.info(f"Session {self.session_id}: Getting document context for prompt. Active docs: {self.active_documents}")
        prompt_embedding = get_embedding(prompt)
        if not prompt_embedding:
            logger.warning(f"Session {self.session_id}: Could not generate embedding for prompt: '{prompt[:100]}...'")
            return "", []

        document_contexts_parts = []
        used_document_hashes = set()
        all_relevant_chunk_texts = []

        for doc_hash in self.active_documents:
            logger.debug(f"Session {self.session_id}: Fetching embeddings for doc_hash: {doc_hash}")
            chunk_embeddings_data = await get_document_embeddings(doc_hash, self.user_id) 
            
            if not chunk_embeddings_data:
                logger.warning(f"Session {self.session_id}: No embeddings found for doc_hash: {doc_hash}")
                continue
            
            similarities = []
            for chunk_data in chunk_embeddings_data:
                if hasattr(chunk_data, 'embedding') and hasattr(chunk_data, 'text') and chunk_data.embedding:
                    try:
                        similarity = cosine_similarity(prompt_embedding, chunk_data.embedding)
                        similarities.append((similarity, chunk_data.text, chunk_data.chunk_id)) # Store text and chunk_id
                    except Exception as e:
                        logger.error(f"Session {self.session_id}: Error calculating similarity for chunk {chunk_data.chunk_id} in doc {doc_hash}: {e}", exc_info=False)
                else:
                    logger.warning(f"Session {self.session_id}: Skipping chunk in doc {doc_hash} due to missing text or embedding.")
            
            if not similarities:
                logger.debug(f"Session {self.session_id}: No valid similarities calculated for doc_hash: {doc_hash}")
                continue

            similarities.sort(reverse=True, key=lambda x: x[0])
            
            doc_relevant_texts = []
            for i, (sim, text, chunk_id) in enumerate(similarities):
                if i < top_k_chunks and sim >= similarity_threshold:
                    logger.info(f"Session {self.session_id}: Using chunk {chunk_id} from doc {doc_hash} (similarity: {sim:.4f})")
                    doc_relevant_texts.append(f"[Content from Document ID {doc_hash[:8]}..., Chunk {chunk_id}]:\n{text}")
                    used_document_hashes.add(doc_hash)
                elif i < top_k_chunks and len(self.active_documents) == 1 and i < 1: # If only one doc, take at least top one if not meeting threshold
                    logger.info(f"Session {self.session_id}: Using chunk {chunk_id} from single active doc {doc_hash} (similarity: {sim:.4f}, below threshold but top chunk)")
                    doc_relevant_texts.append(f"[Content from Document ID {doc_hash[:8]}..., Chunk {chunk_id}]:\n{text}")
                    used_document_hashes.add(doc_hash)
            
            if doc_relevant_texts:
                 all_relevant_chunk_texts.extend(doc_relevant_texts)
        
        if not all_relevant_chunk_texts:
            logger.info(f"Session {self.session_id}: No document chunks found relevant enough for the prompt.")
            return "", []
            
        combined_context = "\n\n---\n\n".join(all_relevant_chunk_texts)
        logger.info(f"Session {self.session_id}: Combined document context generated (length: {len(combined_context)}). Used {len(used_document_hashes)} documents.")
        return combined_context, list(used_document_hashes)

    async def get_document_context_for_specific_document(self, prompt: str, document_hash: str) -> Tuple[str, List[str]]:
        """Get document context from a specific document only."""
        try:
            prompt_embedding = get_embedding(prompt)
            
            document_embeddings = await get_document_embeddings_for_document(document_hash, self.user_id)
            
            if not document_embeddings:
                logger.warning(f"No embeddings found for document {document_hash}")
                return "", []
            
            similarities = []
            for embedding in document_embeddings:
                similarity = cosine_similarity(prompt_embedding, embedding.embedding)
                similarities.append((embedding, similarity))
            
            similarities.sort(key=lambda x: x[1], reverse=True)
            
            threshold = 0.7
            top_chunks = []
            used_documents = []
            
            for embedding, similarity in similarities[:5]:
                if similarity > threshold or len(top_chunks) < 1:
                    chunk_text = f"[Content from Document ID {embedding.document_hash[:6]}..., Chunk {embedding.chunk_id}]:\n{embedding.text}\n\n"
                    top_chunks.append(chunk_text)
                    if embedding.document_hash not in used_documents:
                        used_documents.append(embedding.document_hash)
                    logger.info(f"Session {self.session_id}: Using chunk {embedding.chunk_id} from doc {embedding.document_hash} (similarity: {similarity:.4f})")
                else:
                    logger.info(f"Session {self.session_id}: Skipping chunk {embedding.chunk_id} from doc {embedding.document_hash} (similarity: {similarity:.4f}, below threshold)")
            
            combined_context = "".join(top_chunks)
            logger.info(f"Session {self.session_id}: Combined document context generated (length: {len(combined_context)}). Used {len(used_documents)} documents.")
            
            return combined_context, used_documents
        except Exception as e:
            logger.error(f"Error getting document context: {e}")
            return "", []

    async def get_conversation_history(self) -> str:
        """Get formatted conversation history for context."""
        try:
            history_limit = 5
            if not self.chat_history or len(self.chat_history) == 0:
                return ""
            
            formatted_history = []
            for i, msg in enumerate(self.chat_history[-history_limit:]):
                formatted_history.append(f"User: {msg['prompt']}")
                formatted_history.append(f"Assistant: {msg['response']}")
            
            return "\n\n".join(formatted_history)
        except Exception as e:
            print(f"Error getting conversation history: {e}")
            return ""

class ChatSessionManager:
    def __init__(self):
        self.sessions: Dict[str, ChatSession] = {}

    async def get_or_create_session(self, user_id: str, session_id: Optional[str] = None) -> ChatSession:
        if session_id and not session_id.strip(): session_id = None
        if session_id:
            if session_id in self.sessions:
                session = self.sessions[session_id]
                session.last_activity = datetime.now()
                return session
            logger.info(f"Attempting to load session {session_id} for user {user_id} from DB.")
            session = await ChatSession.load_from_db(session_id, user_id)
            if session:
                logger.info(f"Session {session_id} loaded from DB for user {user_id}.")
                session.last_activity = datetime.now()
                self.sessions[session_id] = session
                return session
            else:
                logger.warning(f"Session {session_id} (user {user_id}) not found in DB. Creating new.")
                session_id = None 
        logger.info(f"Creating new session for user {user_id} (requested SID: {session_id}).")
        new_session_instance = ChatSession(user_id, session_id)
        self.sessions[new_session_instance.session_id] = new_session_instance
        await new_session_instance.save_to_db()
        logger.info(f"New session {new_session_instance.session_id} created and saved for user {user_id}.")
        return new_session_instance

    async def get_user_sessions(self, user_id: str, days: int = 15) -> List[Dict]:
        cutoff_date = datetime.now() - timedelta(days=days)
        logger.info(f"Fetching sessions for user '{user_id}' active since {cutoff_date.isoformat()}")
        
        try:
            cursor = chat_history_collection.find(
                {"user_id": user_id, "last_activity": {"$gte": cutoff_date}},
                {"_id": 0}
            ).sort("last_activity", -1)
            sessions_from_db = await cursor.to_list(length=None)
        except Exception as e:
            logger.error(f"DB query error for user '{user_id}' sessions: {e}", exc_info=True)
            raise 

        processed_sessions = []
        for session_doc in sessions_from_db:
            session_id_val = session_doc.get("session_id", f"unknown_session_{uuid.uuid4()}")
            try:
                chat_history = session_doc.get("chat_history", [])
                active_docs = session_doc.get("active_documents", [])
                preview = "New Conversation"
                if chat_history and isinstance(chat_history, list) and len(chat_history) > 0:
                    first_message = chat_history[0]
                    if isinstance(first_message, dict):
                        prompt_text = first_message.get("prompt", "")
                        response_text = first_message.get("response", "")
                        if prompt_text and isinstance(prompt_text, str) and prompt_text.strip(): preview_text = prompt_text
                        elif response_text and isinstance(response_text, str) and response_text.strip(): preview_text = response_text
                        else: preview_text = "New Conversation"
                    else: 
                        logger.warning(f"Session {session_id_val}: First chat_history item not a dict: {type(first_message)}")
                        preview_text = "Chat started" 
                    preview = preview_text[:70] + "..." if len(preview_text) > 70 else preview_text

                def format_date_to_iso_string(date_val, field_name: str, s_id: str) -> Optional[str]:
                    if date_val is None: 
                        logger.warning(f"{field_name} for session {s_id} is None. Returning current time as ISO string.")
                        return datetime.now().isoformat() 
                    if isinstance(date_val, datetime): return date_val.isoformat()
                    if isinstance(date_val, str):
                        try: return datetime.fromisoformat(date_val.replace("Z", "+00:00").replace(" ", "T")).isoformat()
                        except ValueError: 
                            logger.warning(f"Could not parse {field_name} string '{date_val}' for session {s_id}. Defaulting to current time.", exc_info=False)
                            return datetime.now().isoformat()
                    logger.warning(f"{field_name} for session {s_id} is type {type(date_val)} ('{date_val}'). Defaulting to current time.")
                    return datetime.now().isoformat()

                last_activity_str = format_date_to_iso_string(session_doc.get("last_activity"), "last_activity", session_id_val)
                created_at_str = format_date_to_iso_string(session_doc.get("created_at"), "created_at", session_id_val)
                
                processed_sessions.append({
                    "session_id": session_id_val, "created_at": created_at_str,
                    "last_activity": last_activity_str, "preview": preview,
                    "document_count": len(active_docs) if isinstance(active_docs, list) else 0
                })
            except Exception as e:
                logger.error(f"Error processing session document (ID: {session_id_val}) for list: {e}", exc_info=True)
                continue
        
        logger.info(f"Returning {len(processed_sessions)} processed sessions for user '{user_id}'.")
        return processed_sessions

    async def end_session(self, session_id: str, user_id: str):
        if session_id in self.sessions:
            del self.sessions[session_id]
        try:
            await chat_history_collection.delete_one({"session_id": session_id, "user_id": user_id})
            logger.info(f"Session {session_id} for user {user_id} deleted from DB.")
        except Exception as e:
            logger.error(f"Error deleting session {session_id} for user {user_id} from DB: {e}", exc_info=True)

chat_session_manager = ChatSessionManager()