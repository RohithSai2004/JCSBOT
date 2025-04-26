import motor.motor_asyncio
import os
from dotenv import load_dotenv
import asyncio
from urllib.parse import quote_plus

# Load environment variables
load_dotenv()

# Get MongoDB connection string
username = os.getenv("MONGODB_USERNAME", "rohith")
password = os.getenv("MONGODB_PASSWORD", "Rohith9030@")
cluster = os.getenv("MONGODB_CLUSTER", "cluster0.dyvzuvw.mongodb.net")

# URL encode username and password
username = quote_plus(username)
password = quote_plus(password)

# Construct connection string
MONGODB_URL = f"mongodb+srv://{username}:{password}@{cluster}/?retryWrites=true&w=majority&appName=Cluster0"

async def test_connection():
    try:
        # Initialize MongoDB client
        client = motor.motor_asyncio.AsyncIOMotorClient(MONGODB_URL)
        
        # Test connection
        print("Testing MongoDB connection...")
        await client.admin.command('ping')
        print("✓ Successfully connected to MongoDB!")
        
        # List databases
        print("\nAvailable databases:")
        databases = await client.list_database_names()
        for db in databases:
            print(f"- {db}")
        
        # Create a test document
        db = client["test_db"]
        collection = db["test_collection"]
        await collection.insert_one({"test": "connection"})
        print("\n✓ Successfully created test document")
        
        # Clean up
        await collection.drop()
        print("✓ Cleaned up test data")
        
    except Exception as e:
        print(f"Error: {str(e)}")
    finally:
        client.close()

if __name__ == "__main__":
    asyncio.run(test_connection()) 