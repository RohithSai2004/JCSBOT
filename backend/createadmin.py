import asyncio
import motor.motor_asyncio
from passlib.context import CryptContext
from datetime import datetime
import os
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# Setup MongoDB connection
MONGODB_URL = os.getenv("MONGODB_URL", "your-mongodb-url")
DATABASE_NAME = os.getenv("DATABASE_NAME", "jcsbot")

client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URL)
db = client[DATABASE_NAME]
users_collection = db["users"]

# Password hasher
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_admin_user():
    username = "admin"
    email = "admin@jcsbot.com"
    full_name = "Jai JCS"
    plain_password = "admin123@"  # <-- Change this to your desired admin password

    hashed_password = pwd_context.hash(plain_password)

    admin_user = {
        "username": username,
        "email": email,
        "full_name": full_name,
        "hashed_password": hashed_password,
        "disabled": False,
        "created_at": datetime.utcnow(),
        "last_login": None,
        "reset_token": None,
        "reset_token_expiry": None,
        "is_admin": True  # <-- This is important flag to recognize admin
    }

    existing = await users_collection.find_one({"username": username})
    if existing:
        print("Admin user already exists.")
    else:
        await users_collection.insert_one(admin_user)
        print("Admin user created successfully!")

if __name__ == "__main__":
    asyncio.run(create_admin_user())
