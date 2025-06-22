from fastapi import HTTPException
from app.models.schemas import UserInput, SecurityCheck, TaskCategoryResponseFormat
from openai import OpenAI
from app.logger import logger
import os
from dotenv import load_dotenv
import json

# Load from the specific path
load_dotenv()
client = OpenAI()
model = "gpt-3.5-turbo"

def check_security(user_input: str) -> SecurityCheck:
    """Check for harmful patterns with relaxed security"""

    # VERY MINIMAL SECURITY, only blocking very dangerous patterns
    system_prompt = """
    You're a security auditor. ONLY flag the prompt if it contains ANY of these:
    1. CODE EXECUTION: Requests to run system code, access files outside user scope.
    2. SYSTEM ACCESS: Attempts to access credentials, passwords, server files.

    General conversation, long lists, questions, jokes, interview preparation etc. are SAFE.

    Output strictly JSON:
    { "is_safe": true/false, "reason": "..." }
    """
    
    completion = client.chat.completions.create(
        model=model,
        messages=[
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": user_input },
        ],
        response_format={"type": "json_object"}
    )

    response_text = completion.choices[0].message.content
    try:
        result = json.loads(response_text)
        return SecurityCheck(
            is_safe=result.get("is_safe", True),
            reason=result.get("reason", "No issues detected")
        )
    except:
        return SecurityCheck(is_safe=True, reason="Error parsing response")

def classify_task_category(prompt, task, files) -> TaskCategoryResponseFormat:
    """Classify the user prompt into a task category"""
    completion = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "system",
                "content": (
                    "Classify user prompt into one of: general conversation, summarization, comparison, data analysis, file Q&A."
                    " Use context: task and files if needed."
                    " Respond JSON: { 'task': ..., 'confidence_score': ... }"
                )
            },
            { "role": "user", "content": f"Prompt: {prompt}\nTask hint: {task}\nFiles: {files}" }
        ],
        response_format={"type": "json_object"}
    )

    response_text = completion.choices[0].message.content
    try:
        result = json.loads(response_text)
        return TaskCategoryResponseFormat(
            task=result.get("task", "general conversation"),
            confidence_score=result.get("confidence_score", 1.0)
        )
    except:
        return TaskCategoryResponseFormat(task="general conversation", confidence_score=1.0)


async def validate_user_input(prompt, task, files) -> TaskCategoryResponseFormat:
    """Guardrail validations (relaxed)"""
    if not prompt or not prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")

    if files:
        for file in files:
            if not file.filename:
                continue
                
            filename = file.filename.lower()
            allowed_extensions = (
                '.pdf', '.docx', '.txt', '.md',
                '.png', '.jpg', '.jpeg', '.tiff', '.bmp',
                '.csv', '.xlsx', '.xls'
            )
            
            if not filename.endswith(allowed_extensions):
                raise HTTPException(
                    status_code=400, 
                    detail=f"Unsupported file format: {filename}. Allowed: {', '.join(allowed_extensions)}"
                )
            
            # Relaxed file size: allow up to 50MB
            try:
                file_size = 0
                chunk_size = 1024 * 1024  # 1MB
                while chunk := await file.read(chunk_size):
                    file_size += len(chunk)
                await file.seek(0)  # Reset file pointer
                
                if file_size > 50 * 1024 * 1024:  # 50MB
                    raise HTTPException(
                        status_code=400,
                        detail=f"File {filename} is too large. Max allowed size: 50MB."
                    )
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Error reading file {filename}: {str(e)}"
                )

    security_result = check_security(prompt)
    logger.info(f"Security: {'SAFE' if security_result.is_safe else 'UNSAFE'}")

    if not security_result.is_safe:
        logger.warning(f"Security risk: {security_result.reason}")
        raise HTTPException(
            status_code=400,
            detail=f"Security issue detected: {security_result.reason}"
        )

    task_result = classify_task_category(prompt, task, files)
    logger.info(f"Task: {task_result.task}, Confidence: {task_result.confidence_score:.2f}")

    return task_result
