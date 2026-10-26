"""
VeriScope Core Configuration.
Loads environment variables safely with sensible defaults for local development.
"""

import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_NAME: str = "VeriScope"
    APP_ENV: str = "development"
    ASSESSMENT_DATE_DEFAULT: str = "2026-10-26"
    PORT: int = 8000
    WEB_PORT: int = 3000

    DATABASE_URL: str = "sqlite:///./veriscope.db"

    JWT_SECRET_KEY: str = "dev-insecure-secret-key-change-in-production-must-be-32-chars-min!"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    STORAGE_LOCAL_DIR: str = "./storage/documents"

    MOCK_CONNECTOR_ENABLED: bool = True
    MOCK_CONNECTOR_LATENCY_MS: int = 150

    LLM_PROVIDER_ENABLED: bool = False
    LLM_PROVIDER_TYPE: str = "none"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()
