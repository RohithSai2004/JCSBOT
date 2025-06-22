from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class AdminUser(BaseModel):
    username: str
    hashed_password: str
    created_at: datetime = datetime.utcnow()
