from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.db.base_class import Base

# This DATABASE_URL should now come from settings.py and use `postgresql+asyncpg`
ASYNC_DATABASE_URL = settings.DATABASE_URL

engine = create_async_engine(ASYNC_DATABASE_URL, echo=True)

# Each AsyncSessionLocal instance is a database session.
# The `autocommit` is set to `False` by default, meaning changes are not committed automatically.
# `autoflush` is set to `False` to prevent SQLAlchemy from flushing changes to the database
# until explicitly told to do so.
# `bind` is the engine that this session is bound to.
AsyncSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=AsyncSession, # Use AsyncSession for async operations
    expire_on_commit=False,
)

async def get_async_db():
    """
    Dependency that provides an async database session for FastAPI routes.
    The session is created and then closed after the request is finished.
    """
    async with AsyncSessionLocal() as session:
        yield session

async def init_db():
    """
    Creates all database tables defined in Base.metadata.
    This should be called on application startup.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
