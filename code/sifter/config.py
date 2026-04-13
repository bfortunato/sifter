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

    # Extraction defaults
    extraction_temperature: float = 0.2
    max_concurrent_extractions: int = 5

    # File storage
    upload_dir: str = "./uploads"
    max_file_size_mb: int = 50

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # CORS
    cors_origins: list[str] = Field(default=["http://localhost:3000", "http://localhost:5173"])

    model_config = {"env_prefix": "SIFTER_"}


config = SifterConfig()
