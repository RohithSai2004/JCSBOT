from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import secrets # Import secrets for token generation
from passlib.context import CryptContext # Import CryptContext for password hashing

from app.db.mongodb import get_user_by_email, update_user, User # Import necessary DB functions and User model

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto") # Initialize CryptContext

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)

# Pydantic model for the reset password request
class ForgotPasswordRequest(BaseModel):
    email: str

# Pydantic model for the reset password confirm
class ResetPasswordConfirm(BaseModel):
    token: str
    new_password: str

@router.get("/")
def get_users():
    return [{"id": 1, "name": "Alice"}]

@router.get("/{user_id}")
def get_user(user_id: int):
    return {"id": user_id, "name": "Bob"}

@router.post("/forgot-password")
async def request_password_reset(request: ForgotPasswordRequest):
    user = await get_user_by_email(request.email)
    
    # Always return success to prevent email enumeration
    if not user:
        # Log or handle the case where the user doesn't exist, but return success to the frontend
        print(f"Password reset requested for non-existent email: {request.email}")
        return {"message": "If a user with that email exists, a password reset link has been sent."}

    # Generate a unique reset token and set expiry time (e.g., 1 hour)
    reset_token = secrets.token_urlsafe(32)
    reset_token_expiry = datetime.utcnow() + timedelta(hours=1)
    
    # Update user with the reset token and expiry
    user.reset_token = reset_token
    user.reset_token_expiry = reset_token_expiry
    await update_user(user)
    
    # In a real application, send an email here.
    # For now, we'll just print the reset link.
    # You should replace 'YOUR_FRONTEND_RESET_PASSWORD_URL' with the actual URL of your reset password page
    reset_link = f"YOUR_FRONTEND_RESET_PASSWORD_URL?token={reset_token}"
    print(f"Password reset link for {user.email}: {reset_link}")
    
    return {"message": "If a user with that email exists, a password reset link has been sent."}

@router.post("/reset-password")
async def reset_password(request: ResetPasswordConfirm):
    # Find user by reset token
    user = await users_collection.find_one({
        "reset_token": request.token,
        "reset_token_expiry": {"$gt": datetime.utcnow()}
    })
    
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")

    # Convert the user dictionary to a User model instance
    user_obj = User(**user)

    # Hash the new password and update the user
    user_obj.hashed_password = pwd_context.get_password_hash(request.new_password)
    user_obj.reset_token = None  # Clear the reset token
    user_obj.reset_token_expiry = None # Clear the expiry time
    
    # Update the user in the database
    await update_user(user_obj)

    return {"message": "Password reset successfully"}
