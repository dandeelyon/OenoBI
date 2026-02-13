from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.api.router import api_router
from app.config import settings
# from app.db.session import connect_db, close_db_connection_pool # Removed asyncpg specific imports
from app.db.database import init_db # Import the new init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Context manager for managing the lifespan of the FastAPI application.
    Handles startup (DB connection pool creation and table creation) and shutdown events.
    """
    print("Startup: Initializing database tables...")
    await init_db() # Call init_db to create tables
    print("Startup: Database tables initialized.")
    yield
    print("Shutdown: Application shutdown complete.")
    # Async SQLAlchemy engine manages its own connections, no explicit close needed here typically.

app = FastAPI(
    title="OenoBI Python Backend",
    description="Python backend for OenoBI dashboard, serving cached Commerce7 and Vintrace data.",
    version="0.1.0",
    lifespan=lifespan # Use the lifespan context manager
)

# Set up CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/backend-api")
