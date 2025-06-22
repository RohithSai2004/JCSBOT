from fastapi import APIRouter, Depends, HTTPException, status, Body, Query, UploadFile, File
from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
import asyncio
import os
import tempfile
import shutil
from datetime import datetime
from bson.objectid import ObjectId
import logging

# MongoDB and models
from app.db.mongodb import (
    users_collection, 
    documents_collection, 
    chat_history_collection,
    get_user,
    knowledge_base_collection,
    usage_collection,
    deleted_documents_collection,
    embeddings_collection,
    client,
    Document,
    save_document_embedding
)
from app.models.schemas import User

# Utils and services
from app.utils.embeddings import get_embedding, get_embeddings_batch, cosine_similarity
from app.api.routes.core import process_large_document, generate_and_store_embeddings, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])

# --- Pricing Constants for Accurate Recalculation ---
PRICE_GPT4O_MINI_INPUT_PER_MILLION_TOKENS = 0.15
PRICE_GPT4O_MINI_OUTPUT_PER_MILLION_TOKENS = 0.60
PRICE_EMBEDDING_PER_MILLION_TOKENS = 0.13
PRICE_GEMINI_FLASH_OCR_PER_PAGE = 0.0025

# --- Middleware to check for Admin Privileges ---
async def admin_required(current_user: User = Depends(get_current_user)):
    """Dependency to ensure the user is an admin."""
    is_admin = getattr(current_user, "is_admin", False) or current_user.username == "admin"
    if not is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges are required for this operation."
        )
    return current_user

# --- Pydantic Response Models ---

class UsageOut(BaseModel):
    """Defines the structure for the user usage statistics response."""
    user_id: str
    username: str
    
    ocr_docs: int = 0
    text_docs: int = 0
    total_pages: int = 0
    total_tokens: int = 0
    
    deleted_ocr_docs: int = 0
    deleted_text_docs: int = 0
    deleted_pages: int = 0
    deleted_tokens: int = 0
    
    chat_sessions: int = 0
    chat_messages: int = 0
    chat_input_tokens: int = 0
    chat_output_tokens: int = 0
    
    ocr_cost: float = 0.0
    text_processing_cost: float = 0.0
    embedding_cost: float = 0.0
    chat_cost: float = 0.0
    total_cost: float = 0.0
    
    last_activity: Optional[datetime] = None
    account_created: Optional[datetime] = None
    
    usage_by_operation: Dict[str, Dict[str, Any]] = Field(default_factory=dict)

    class Config:
        from_attributes = True

# --- Admin API Endpoints ---

@router.get("/users", response_model=List[Dict[str, Any]])
async def get_all_users(admin_user: User = Depends(admin_required)):
    """Get all users in the system."""
    try:
        cursor = users_collection.find({}, {"_id": 0, "hashed_password": 0})
        return await cursor.to_list(length=None)
    except Exception as e:
        logger.error(f"Failed to fetch users: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")

@router.post("/reset-user-data", response_model=Dict[str, Any])
async def reset_user_data(
    payload: Dict[str, List[str]] = Body(...),
    admin_user: User = Depends(admin_required)
):
    """
    Reset all data for specified users. This is a destructive, irreversible operation.
    Returns a detailed report of deleted items.
    """
    usernames = payload.get("usernames", [])
    if not usernames:
        raise HTTPException(status_code=400, detail="Usernames list is required.")
    
    delete_query = {"user_id": {"$in": usernames}}
    deleted_counts = {}

    try:
        # Sequentially delete and log counts for better debugging and confirmation
        
        docs_res = await documents_collection.delete_many(delete_query)
        deleted_counts["active_documents"] = docs_res.deleted_count

        deleted_docs_res = await deleted_documents_collection.delete_many(delete_query)
        deleted_counts["deleted_documents_archive"] = deleted_docs_res.deleted_count

        chat_res = await chat_history_collection.delete_many(delete_query)
        deleted_counts["chat_history_records"] = chat_res.deleted_count

        embeddings_res = await embeddings_collection.delete_many(delete_query)
        deleted_counts["embedding_records"] = embeddings_res.deleted_count

        usage_res = await usage_collection.delete_many(delete_query)
        deleted_counts["usage_logs"] = usage_res.deleted_count

        log_message = f"Admin '{admin_user.username}' reset data for users: {usernames}. Deleted counts: {deleted_counts}"
        logger.info(log_message)
        
        return {
            "message": f"Successfully reset data for {len(usernames)} user(s).",
            "deleted_items": deleted_counts
        }
        
    except Exception as e:
        logger.error(f"Error resetting user data for {usernames}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred while resetting user data.")

@router.get("/usage", response_model=List[UsageOut])
async def get_usage_stats(
    include_historical: bool = Query(False, description="Include deleted/archived documents in counts"),
    admin_user: User = Depends(admin_required)
):
    """
    Get detailed usage and cost statistics for all users.
    This endpoint performs a full recalculation of costs from raw metrics
    to ensure accuracy, including all active and deleted documents.
    """
    try:
        users = await users_collection.find({}, {"_id": 1, "username": 1, "created_at": 1}).to_list(None)
        if not users: return []
        usernames = [user["username"] for user in users]

        # --- Aggregation Pipelines ---
        pipeline_active_docs = [
            {"$match": {"user_id": {"$in": usernames}}},
            {"$group": {"_id": "$user_id", "ocr_docs": {"$sum": {"$cond": [{"$eq": ["$doc_type", "ocr"]}, 1, 0]}}, "text_docs": {"$sum": {"$cond": [{"$eq": ["$doc_type", "text"]}, 1, 0]}}, "total_docs": {"$sum": 1}, "pages": {"$sum": "$page_count"}, "tokens": {"$sum": "$token_count"}}}
        ]
        pipeline_deleted_docs = [
            {"$match": {"user_id": {"$in": usernames}}},
            {"$group": {"_id": "$user_id", "deleted_ocr_docs": {"$sum": {"$cond": [{"$eq": ["$doc_type", "ocr"]}, 1, 0]}}, "deleted_text_docs": {"$sum": {"$cond": [{"$eq": ["$doc_type", "text"]}, 1, 0]}}, "total_deleted_docs": {"$sum": 1}, "deleted_pages": {"$sum": "$page_count"}, "deleted_tokens": {"$sum": "$token_count"}}}
        ]
        pipeline_chat = [
            {"$match": {"user_id": {"$in": usernames}}},
            {"$group": {"_id": "$user_id", "chat_sessions": {"$addToSet": "$session_id"}, "chat_messages": {"$sum": 1}, "input_tokens": {"$sum": "$input_tokens"}, "output_tokens": {"$sum": "$output_tokens"}, "last_activity": {"$max": "$timestamp"}}}
        ]

        active_docs, deleted_docs, chat_data = await asyncio.gather(
            documents_collection.aggregate(pipeline_active_docs).to_list(None),
            deleted_documents_collection.aggregate(pipeline_deleted_docs).to_list(None),
            chat_history_collection.aggregate(pipeline_chat).to_list(None)
        )

        # --- Process and Combine Results ---
        result_map = {user["username"]: UsageOut(user_id=str(user["_id"]), username=user["username"], account_created=user.get("created_at")) for user in users}
        active_docs_map = {doc["_id"]: doc for doc in active_docs}
        deleted_docs_map = {doc["_id"]: doc for doc in deleted_docs}
        chat_map = {chat["_id"]: chat for chat in chat_data}

        for username, user_data in result_map.items():
            active = active_docs_map.get(username, {})
            deleted = deleted_docs_map.get(username, {})
            chat = chat_map.get(username, {})

            # Document Counts
            user_data.ocr_docs = active.get("ocr_docs", 0)
            user_data.text_docs = active.get("total_docs", 0) - user_data.ocr_docs
            user_data.deleted_ocr_docs = deleted.get("deleted_ocr_docs", 0)
            user_data.deleted_text_docs = deleted.get("total_deleted_docs", 0) - user_data.deleted_ocr_docs

            # Chat Metrics
            user_data.chat_sessions = len(chat.get("chat_sessions", []))
            user_data.chat_messages = chat.get("chat_messages", 0)
            user_data.chat_input_tokens = chat.get("input_tokens", 0)
            user_data.chat_output_tokens = chat.get("output_tokens", 0)

            # Page and Token Counts
            total_pages = active.get("pages", 0) + deleted.get("deleted_pages", 0)
            total_tokens = active.get("tokens", 0) + deleted.get("deleted_tokens", 0)
            user_data.total_pages = total_pages if include_historical else active.get("pages", 0)
            user_data.total_tokens = total_tokens if include_historical else active.get("tokens", 0)
            
            # --- Accurate Cost Recalculation ---
            user_data.ocr_cost = total_pages * PRICE_GEMINI_FLASH_OCR_PER_PAGE
            user_data.embedding_cost = (total_tokens / 1_000_000) * PRICE_EMBEDDING_PER_MILLION_TOKENS
            
            chat_input_cost = (user_data.chat_input_tokens / 1_000_000) * PRICE_GPT4O_MINI_INPUT_PER_MILLION_TOKENS
            chat_output_cost = (user_data.chat_output_tokens / 1_000_000) * PRICE_GPT4O_MINI_OUTPUT_PER_MILLION_TOKENS
            user_data.chat_cost = chat_input_cost + chat_output_cost
            
            user_data.total_cost = user_data.ocr_cost + user_data.embedding_cost + user_data.chat_cost
            
            user_data.last_activity = chat.get("last_activity")

        return list(result_map.values())

    except Exception as e:
        logger.error(f"Error in get_usage_stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred while generating usage statistics.")
# --- Knowledge Base Endpoints ---


@router.post("/knowledge/upload")
async def upload_knowledge_document(
    file: UploadFile = File(...),
    admin_user: User = Depends(admin_required)
):
    """
    Upload a document to the knowledge base (admin only).
    The document will be processed and stored with embeddings for semantic search.
    
    Supported formats: PDF, TXT
    """
    try:
        # Validate file type
        filename = file.filename.lower()
        if not (filename.endswith('.pdf') or filename.endswith('.txt')):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PDF and TXT files are supported"
            )
            
        # Read the file content first to validate
        try:
            content = await file.read()
            if not content:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Uploaded file is empty"
                )
                
            # Reset file pointer after reading
            await file.seek(0)
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Error reading file: {str(e)}"
            )

        # Save the uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(filename)[1]) as temp_file:
            temp_file.write(content)
            temp_path = temp_file.name

        try:
            # Process the document - this returns a file hash
            file_hash = await process_large_document(temp_path, file.filename, "admin_knowledge_base")
            
            if not file_hash:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to process document"
                )
            
            # Get the document from the database
            document_dict = await documents_collection.find_one({
                "file_hash": file_hash, 
                "user_id": "admin_knowledge_base"
            })
            
            if not document_dict:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Document not found after processing"
                )
            
            # Update the document to mark it as a knowledge base document
            update_result = await documents_collection.update_one(
                {"file_hash": file_hash, "user_id": "admin_knowledge_base"},
                {"$set": {"is_knowledge_base": True}}
            )
            
            if update_result.modified_count == 0:
                logger.warning(f"Document {file_hash} was not updated as a knowledge base document")
            
            # Get the updated document
            updated_doc = await documents_collection.find_one({
                "file_hash": file_hash, 
                "user_id": "admin_knowledge_base"
            })
            
            if not updated_doc:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to retrieve updated document"
                )
                
            # Convert to Document object for generate_and_store_embeddings
            document_obj = Document(**updated_doc)
            
            # Generate and store embeddings
            try:
                await generate_and_store_embeddings(document_obj)
            except Exception as e:
                logger.error(f"Error generating embeddings: {e}", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to generate document embeddings: {str(e)}"
                )
            
            return {
                "filename": file.filename, 
                "file_hash": file_hash,
                "message": "Document uploaded and processed successfully"
            }
            
        except HTTPException:
            raise
            
        except Exception as e:
            logger.error(f"Error processing document {file.filename}: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error processing document: {str(e)}"
            )
            
        finally:
            # Clean up temp file
            try:
                if os.path.exists(temp_path):
                    os.unlink(temp_path)
            except Exception as e:
                logger.error(f"Error cleaning up temp file {temp_path}: {e}")
                
    except HTTPException:
        raise
        
    except Exception as e:
        logger.error(f"Unexpected error in upload_knowledge_document: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred while processing your request"
        )

@router.get("/knowledge/documents", response_model=List[Dict[str, Any]])
async def get_knowledge_documents(admin_user: User = Depends(admin_required)):
    """Get all knowledge base documents (admin only)"""
    try:
        documents = await documents_collection.find({
            "user_id": "admin_knowledge_base",
            "is_knowledge_base": True
        }).to_list(length=None)
        
        # Convert ObjectId to string for JSON serialization
        for doc in documents:
            if '_id' in doc:
                doc['_id'] = str(doc['_id'])
                
        return documents
    except Exception as e:
        logger.error(f"Error fetching knowledge documents: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/knowledge/document/{file_hash}")
async def delete_knowledge_document(
    file_hash: str,
    admin_user: User = Depends(admin_required)
):
    """
    Delete a knowledge base document and its embeddings (admin only).
    This is a hard delete that removes the document and all associated data.
    """
    try:
        # Find the document first to verify it exists and is a knowledge base document
        document = await documents_collection.find_one({
            "file_hash": file_hash,
            "user_id": "admin_knowledge_base",
            "is_knowledge_base": True
        })
        
        if not document:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Document not found in knowledge base"
            )
        
        # Start a session for atomic operations
        async with await client.start_session() as session:
            async with session.start_transaction():
                # Delete the document
                await documents_collection.delete_one(
                    {"file_hash": file_hash, "user_id": "admin_knowledge_base"},
                    session=session
                )
                
                # Delete all associated embeddings
                result = await embeddings_collection.delete_many(
                    {"document_hash": file_hash, "user_id": "admin_knowledge_base"},
                    session=session
                )
                
                logger.info(f"Deleted {result.deleted_count} embeddings for document {file_hash}")
        
        return {
            "success": True,
            "message": "Document and its embeddings have been deleted successfully",
            "document_hash": file_hash
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting knowledge document {file_hash}: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete document: {str(e)}"
        )

@router.get("/knowledge-base", response_model=List[Dict[str, Any]])
async def get_knowledge_base(admin_user: User = Depends(admin_required)):
    """Get all knowledge base items (admin only)"""
    try:
        cursor = knowledge_base_collection.find({}, {"_id": 0})
        items = await cursor.to_list(length=None)
        return items
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch knowledge base: {str(e)}")

# Delete knowledge base item
@router.delete("/knowledge-base/{question_id}", response_model=Dict[str, str])
async def delete_knowledge_base_item(
    question_id: str,
    admin_user: User = Depends(admin_required)
):
    """Delete a knowledge base item (admin only)"""
    try:
        result = await knowledge_base_collection.delete_one({"_id": ObjectId(question_id)})
        
        if result.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Knowledge base item not found")
        
        return {"message": "Knowledge base item deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete knowledge base item: {str(e)}")

@router.delete("/users/{username}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(username: str, admin_user: User = Depends(admin_required)):
    """
    Deletes a user and all of their associated data from the system.
    An admin cannot delete their own account.
    """
    if admin_user.username == username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admins cannot delete their own account."
        )

    # Check if the user exists
    user_to_delete = await get_user(username)
    if not user_to_delete:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    try:
        # Perform deletions across all relevant collections
        await users_collection.delete_one({"username": username})
        await documents_collection.delete_many({"user_id": username})
        await chat_history_collection.delete_many({"user_id": username})
        await embeddings_collection.delete_many({"user_id": username})
        
        return
        
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An error occurred while deleting user: {e}")