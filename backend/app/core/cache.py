import asyncpg
import json
from typing import Optional, Dict, Any

class KeyValueStore:
    def __init__(self, db_connection: asyncpg.Connection):
        self.conn = db_connection

    async def _ensure_table_exists(self):
        """Ensures the kv table exists."""
        await self.conn.execute("""
            CREATE TABLE IF NOT EXISTS kv (
                key TEXT PRIMARY KEY,
                value JSONB
            )
        """)

    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        """
        Retrieves a value from the KV store.
        Returns the JSONB value as a Python dictionary, or None if not found.
        """
        await self._ensure_table_exists()

        record = await self.conn.fetchrow(
            "SELECT value FROM kv WHERE key = $1",
            key
        )
        if record:
            raw_value = record['value']
            if isinstance(raw_value, str): # Defensive check: if it's a string, try to parse
                try:
                    return json.loads(raw_value)
                except json.JSONDecodeError:
                    print(f"Warning: Could not decode JSON for key '{key}'. Raw value: {raw_value[:100]}...")
                    return None
            return raw_value # Otherwise, return as is (expected to be dict from JSONB)
        return None

    async def set(self, key: str, value: Dict[str, Any]) -> None:
        """
        Sets or updates a value in the KV store.
        The value is stored as JSONB.
        """
        await self._ensure_table_exists()

        await self.conn.execute(
            """
            INSERT INTO kv (key, value)
            VALUES ($1, $2::jsonb)
            ON CONFLICT (key) DO UPDATE SET value = $2::jsonb
            """,
            key, json.dumps(value) # asyncpg expects string for JSONB insert
        )

    async def delete(self, key: str) -> None:
        """Deletes a key-value pair from the KV store."""
        await self._ensure_table_exists()

        await self.conn.execute(
            "DELETE FROM kv WHERE key = $1",
            key
        )