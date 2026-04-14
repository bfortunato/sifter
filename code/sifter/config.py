from pydantic_settings import BaseSettings
from pydantic import Field


class SifterConfig(BaseSettings):
    # MongoDB
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_database: str = "sifter"

    # AI Provider (via LiteLLM)
    llm_model: str = "openai/gpt-4o"
    llm_api_key: str = ""
    pipeline_model: str = "openai/gpt-4o-mini"

    # Sift defaults
    extraction_temperature: float = 0.2
    max_concurrent_extractions: int = 5

    # Auth — API key optional
    api_key: str = "sk-dev"  # Set SIFTER_API_KEY in production
    require_api_key: bool = False  # If True, requests without X-API-Key get 401

    # File storage
    upload_dir: str = "./uploads"
    storage_path: str = "./uploads"
    storage_backend: str = "filesystem"
    max_file_size_mb: int = 50

    # Background workers
    max_workers: int = 4

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # CORS
    cors_origins: list[str] = Field(default=["http://localhost:3000", "http://localhost:5173"])

    model_config = {"env_prefix": "SIFTER_"}


config = SifterConfig()
