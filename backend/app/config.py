PROCESSING_THREADS = 8          # Adjust based on CPU cores
MEMORY_LIMIT_MB = 512          # Maximum memory allocation
CACHE_SIZE_PAGES = 100         # Number of cached pages
CHUNK_SIZE_PAGES = 50          # Pages per processing chunk
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

def create_app() -> FastAPI:
    app = FastAPI(
        title="My FastAPI App",
    )

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://localhost:4173",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:4173",
            "https://*.ngrok.io",
            "https://*.ngrok-free.app"
        ],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=[
            "Content-Type",
            "Authorization",
            "Accept",
            "Origin",
            "X-Requested-With",
            "Access-Control-Request-Method",
            "Access-Control-Request-Headers"
        ],
        expose_headers=["*"],
        max_age=3600
    )

    # Configure trusted hosts
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["*"]
    )

    return app 