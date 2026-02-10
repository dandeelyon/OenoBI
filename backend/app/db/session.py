import asyncpg
from typing import AsyncGenerator
from app.config import settings

_pool = None

async def connect_db():
    """Initializes the PostgreSQL connection pool."""
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(
            user=settings.POSTGRES_USER,
            password=settings.POSTGRES_PASSWORD,
            host=settings.POSTGRES_SERVER,
            port=settings.POSTGRES_PORT,
            database=settings.POSTGRES_DB,
            min_size=1, # Minimum connections in the pool
            max_size=10, # Maximum connections in the pool
        )
    return _pool

async def get_db_connection() -> AsyncGenerator[asyncpg.Connection, None]:
    """
    Dependency that provides a database connection from the pool
    and ensures it's released after use.
    """
    pool = await connect_db()
    async with pool.acquire() as connection:
        yield connection

async def close_db_connection_pool():
    """Closes the PostgreSQL connection pool."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
