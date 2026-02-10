from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List

class Settings(BaseSettings):
    # Database settings for the KV store
    POSTGRES_SERVER: str
    POSTGRES_PORT: int
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_DB: str

    # Cache settings
    DASH_CACHE_KEY: str = "dash_exec_cache_v1"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
