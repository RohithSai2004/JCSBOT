import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo import MongoClient
from pprint import pprint

# MongoDB connection
MONGODB_URL = "mongodb+srv://rohith:Rohith9030%40@cluster0.dyvzuvw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
DB_NAME = "jcsbot"  # Update if your database name is different

async def check_documents():
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DB_NAME]
    
    # Get all documents
    cursor = db.documents.find({})
    docs = await cursor.to_list(length=100)  # Get up to 100 documents
    
    print(f"Found {len(docs)} documents in the database:")
    print("-" * 80)
    
    # Print document details
    for doc in docs:
        print(f"User: {doc.get('user_id')}")
        print(f"File: {doc.get('filename')}")
        print(f"Type: {doc.get('doc_type')}")
        print(f"Pages: {doc.get('page_count')}")
        print(f"Tokens: {doc.get('token_count')}")
        print(f"Created: {doc.get('created_at')}")
        print("-" * 40)
    
    # Get user counts
    pipeline = [
        {"$group": {
            "_id": "$user_id",
            "total_docs": {"$sum": 1},
            "ocr_docs": {"$sum": {"$cond": [{"$eq": ["$doc_type", "ocr"]}, 1, 0]}},
            "text_docs": {"$sum": {"$cond": [{"$eq": ["$doc_type", "text"]}, 1, 0]}},
            "total_pages": {"$sum": "$page_count"}
        }}
    ]
    
    print("\nDocument counts by user:")
    print("-" * 80)
    async for user in db.documents.aggregate(pipeline):
        print(f"User: {user['_id']}")
        print(f"  Total documents: {user['total_docs']}")
        print(f"  OCR documents: {user['ocr_docs']}")
        print(f"  Text documents: {user['text_docs']}")
        print(f"  Total pages: {user['total_pages']}")
        print("-" * 40)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_documents())
