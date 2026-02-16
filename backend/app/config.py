from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Optional


class Settings(BaseSettings):
    """
    Central application configuration.

    All secrets (DB credentials, API keys, JWT secret) are expected to be
    provided via environment variables or a local .env file that is never
    committed to version control.
    """

    # Database settings for the KV store / SQLAlchemy
    POSTGRES_SERVER: str
    POSTGRES_PORT: int
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str

    # Constructed Database URL for SQLAlchemy (asyncpg driver)
    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # Cache settings
    DASH_CACHE_KEY: str = "dash_exec_cache_v1"

    # Commerce7
    COMMERCE7_API_KEY: Optional[str] = None
    COMMERCE7_TENANT_ID: Optional[str] = None
    COMMERCE7_BASE_URL: Optional[str] = None

    # Vintrace
    VINTRACE_API_KEY: Optional[str] = None
    VINTRACE_BASE_URL: Optional[str] = None  # tenant-specific; required in production

    # Commerce7 Product/SKU heuristics
    COMMERCE7_WINE_SKU_PATTERN_PREFIXES: List[str] = ["BBV", "LIN"]
    COMMERCE7_EXCLUDE_SKUS: List[str] = ["tasting", "ice", "res", "fled", "soar"]

    # JWT Authentication settings
    SECRET_KEY: str = (
        "CHANGE_ME_IN_PRODUCTION_"
        "c42f0a4a7c4f429d9b8f1d9c9b6f4aa"  # safe placeholder, not a real secret
    )
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
