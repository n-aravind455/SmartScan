"""Smart Scan — Application configuration via environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # PostgreSQL
    POSTGRES_USER: str = "smartscan"
    POSTGRES_PASSWORD: str = "smartscan_secret"
    POSTGRES_DB: str = "smartscan"
    POSTGRES_HOST: str = "postgres"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: str = "postgresql+asyncpg://smartscan:smartscan_secret@postgres:5432/smartscan"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # MinIO
    MINIO_ROOT_USER: str = "minioadmin"
    MINIO_ROOT_PASSWORD: str = "minioadmin"
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_BUCKET: str = "smartscan"

    # Gemini AI
    GEMINI_API_KEY: str = ""

    # App
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
