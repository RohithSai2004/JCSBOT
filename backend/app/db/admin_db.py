from app.models.admin_user import AdminUser
from passlib.context import CryptContext
from app.db.mongodb import mongodb

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
admin_collection = mongodb.get_collection("admin_users")

async def create_admin(username: str, password: str):
    hashed_password = pwd_context.hash(password)
    admin_user = AdminUser(username=username, hashed_password=hashed_password)
    await admin_collection.insert_one(admin_user.dict())

async def authenticate_admin(username: str, password: str):
    admin_data = await admin_collection.find_one({"username": username})
    if not admin_data:
        return None
    if not pwd_context.verify(password, admin_data["hashed_password"]):
        return None
    return admin_data
