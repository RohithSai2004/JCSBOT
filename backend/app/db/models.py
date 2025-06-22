from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from bson import ObjectId

class DeletedDocument(BaseModel):
    """Model for tracking deleted documents for billing purposes"""
    id: Optional[str] = Field(default_factory=lambda: str(ObjectId()), alias="_id")
    user_id: str
    file_hash: str
    filename: str
    doc_type: str  # 'ocr' or 'text'
    page_count: int
    token_count: int
    deleted_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        allow_population_by_field_name = True
        json_encoders = {ObjectId: str}

class ChatSessionMetrics(BaseModel):
    """Model for tracking chat session metrics"""
    id: Optional[str] = Field(default_factory=lambda: str(ObjectId()), alias="_id")
    user_id: str
    session_id: str
    message_count: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_updated: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        allow_population_by_field_name = True
        json_encoders = {ObjectId: str}
