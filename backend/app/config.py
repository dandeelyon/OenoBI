from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    # Database settings for the KV store
    POSTGRES_SERVER: str
    POSTGRES_PORT: int
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str

    # Constructed Database URL for SQLAlchemy
    @property
    def DATABASE_URL(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # Cache settings
    DASH_CACHE_KEY: str = "dash_exec_cache_v1"

    # JWT Authentication settings
    SECRET_KEY: str = "Ud_frYWWa2VAAjcJDttMpXfAeEwp754Ksmb5HtzDy10" # IMPORTANT: Change this in production!
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
