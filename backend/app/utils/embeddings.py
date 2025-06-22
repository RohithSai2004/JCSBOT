import numpy as np
from openai import AsyncOpenAI
import os
from dotenv import load_dotenv
import asyncio
from typing import List, Dict, Any
import time
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Initialize OpenAI clients
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
openai_client = client  # Alias for backward compatibility

async def get_embedding(text: str, model: str = "text-embedding-ada-002") -> list[float]:
    """Get embedding for a text using OpenAI's embedding model asynchronously."""
    try:
        # Ensure text is not empty
        if not text or text.strip() == "":
            logger.warning("Empty text provided to get_embedding")
            return []
        
        # Truncate text if it's too long (OpenAI has token limits)
        max_tokens = 8000  # Adjust based on model limits
        if len(text) > max_tokens * 4:  # Rough estimate: 4 chars per token
            text = text[:max_tokens * 4]
        
        # Get embedding from OpenAI asynchronously
        response = await openai_client.embeddings.create(
            model=model,
            input=text
        )
        
        # Extract embedding from response
        if not response or not response.data or not response.data[0].embedding:
            logger.error("Invalid response format from OpenAI embeddings API")
            return []
            
        return response.data[0].embedding
        
    except Exception as e:
        logger.error(f"Error getting embedding: {e}", exc_info=True)
        return []

def cosine_similarity(vec1: list[float], vec2: list[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    vec1 = np.array(vec1)
    vec2 = np.array(vec2)
    return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

async def get_embeddings_batch(texts: List[str], batch_size: int = 20) -> List[List[float]]:
    """Get embeddings for a batch of texts in parallel."""
    start_time = time.time()
    logger.info(f"Starting batch embedding generation for {len(texts)} chunks")
    
    # Process in batches to avoid rate limits
    all_embeddings = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i+batch_size]
        # Create and run tasks for each text in the batch
        tasks = [get_embedding(text) for text in batch]
        # Run all tasks concurrently with error handling
        batch_embeddings = await asyncio.gather(*tasks, return_exceptions=True)
        # Filter out any failed embeddings
        valid_embeddings = [e for e in batch_embeddings if isinstance(e, list) and len(e) > 0]
        all_embeddings.extend(valid_embeddings)
        
        logger.info(f"Processed batch {i//batch_size + 1}/{(len(texts) + batch_size - 1)//batch_size}")
    
    total_time = time.time() - start_time
    logger.info(f"Generated {len(all_embeddings)} embeddings in {total_time:.2f} seconds")
    
    return all_embeddings

async def get_embeddings_batch_parallel(texts: List[str], max_workers: int = 10) -> List[List[float]]:
    """Generate embeddings for multiple text chunks in parallel with optimized performance."""
    if not texts:
        return []
    
    logger.info(f"Generating embeddings for {len(texts)} chunks in parallel (max_workers={max_workers})")
    start_time = time.time()
    
    # Create a client with optimized settings for parallel requests
    client = AsyncOpenAI(
        api_key=os.getenv("OPENAI_API_KEY"),
        max_retries=1,
        timeout=10.0
    )
    
    # Create tasks for parallel processing
    tasks = []
    for i, text in enumerate(texts):
        if not text or not text.strip():
            tasks.append(None)
            continue
        
        # Create task for this chunk
        task = asyncio.create_task(
            get_single_embedding_ultra_fast(text, client, i)
        )
        tasks.append(task)
    
    # Process in batches to avoid overwhelming the API
    results = []
    batch_size = max_workers
    
    for i in range(0, len(tasks), batch_size):
        batch = tasks[i:i+batch_size]
        batch = [t for t in batch if t is not None]
        
        if not batch:
            continue
        
        try:
            # Wait for this batch with timeout
            batch_results = await asyncio.gather(*batch, return_exceptions=True)
            
            # Process results
            for result in batch_results:
                if isinstance(result, Exception):
                    logger.warning(f"Error in parallel embedding: {result}")
                    results.append(None)
                else:
                    results.append(result)
                    
        except Exception as e:
            logger.error(f"Batch embedding error: {e}", exc_info=True)
            # Add None for each failed embedding in this batch
            results.extend([None] * len(batch))
    
    # Fill in any missing results (from skipped empty texts)
    final_results = []
    result_index = 0
    
    for task in tasks:
        if task is None:
            final_results.append(None)
        else:
            if result_index < len(results):
                final_results.append(results[result_index])
                result_index += 1
            else:
                final_results.append(None)
    
    elapsed = time.time() - start_time
    success_count = sum(1 for r in final_results if r is not None)
    logger.info(f"Generated {success_count}/{len(texts)} embeddings in {elapsed:.2f} seconds")
    
    return final_results

async def get_single_embedding_ultra_fast(text: str, client: AsyncOpenAI, chunk_id: int = 0) -> List[float]:
    """Get a single embedding with optimized performance and error handling."""
    try:
        # Skip empty text
        if not text or not text.strip():
            logger.warning(f"Empty text provided for chunk {chunk_id}")
            return None
        
        # Truncate text if it's too long (OpenAI has token limits)
        max_tokens = 8000  # Adjust based on model limits
        if len(text) > max_tokens * 4:  # Rough estimate: 4 chars per token
            text = text[:max_tokens * 4]
            logger.info(f"Truncated chunk {chunk_id} to {len(text)} chars")
        
        # Get embedding with optimized client
        response = await client.embeddings.create(
            model="text-embedding-3-small",  # Using the smaller, faster model
            input=text
        )
        
        # Extract embedding from response
        if not response or not response.data or not response.data[0].embedding:
            logger.error(f"Invalid response format from OpenAI embeddings API for chunk {chunk_id}")
            return None
            
        return response.data[0].embedding
        
    except Exception as e:
        logger.error(f"Error getting embedding for chunk {chunk_id}: {str(e)}")
        return None