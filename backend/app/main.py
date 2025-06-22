from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.api.routes import users, core
from app.config import create_app
from app.api.routes import admin

# Create FastAPI app with configuration
app = create_app()

# Include routers
app.include_router(users.router)
app.include_router(core.router)
app.include_router(admin.router)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print(f"Validation error: {exc.errors()}")
    return JSONResponse(
        status_code=400,
        content={"error": "Invalid request format. Please ensure all required fields are provided correctly."}
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"Unexpected error: {str(exc)}")
    return JSONResponse(
        status_code=500,
        content={"error": "An unexpected error occurred. Please try again later."}
    )
