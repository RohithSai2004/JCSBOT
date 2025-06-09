import numpy as np
from openai import OpenAI
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def get_embedding(text, model="text-embedding-ada-002"):
    """Get embedding for a text using OpenAI's embedding model."""
    try:
        # Ensure text is not empty
        if not text or text.strip() == "":
            return []
        
        # Truncate text if it's too long (OpenAI has token limits)
        max_tokens = 8000  # Adjust based on model limits
        if len(text) > max_tokens * 4:  # Rough estimate: 4 chars per token
            text = text[:max_tokens * 4]
        
        # Get embedding from OpenAI
        response = client.embeddings.create(
            model=model,
            input=text
        )
        
        # Extract embedding from response
        embedding = response.data[0].embedding
        return embedding
    except Exception as e:
        print(f"Error getting embedding: {e}")
        return []

def cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    vec1 = np.array(vec1)
    vec2 = np.array(vec2)
    return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))
