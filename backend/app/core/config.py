from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import ConfigDict, field_validator
from typing import Optional, List

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
_ENV_FILE = _BACKEND_DIR / ".env"

class Settings(BaseSettings):
    """
    Application configuration settings.
    Reads from environment variables or .env file automatically.
    """
    PROJECT_NAME: str = "EducationOS - AI-Powered Education SaaS"
    ENVIRONMENT: str = "development"
    API_V1_STR: str = "/api/v1"
    
    # Database Configurations
    DATABASE_URL: str
    # ALEMBIC_DATABASE_URL: str
    AUTO_CREATE_TABLES: bool = False
    
    # JWT Configs
    SECRET_KEY: str
    JWT_SECRET_KEY: Optional[str] = None
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 # 60 Minutes
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7 # 7 Days

    # CORS Allowed Origins
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://schoolos.app"
    ]

    # Core API Keys
    GEMINI_API_KEY: Optional[str] = None
    GOOGLE_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    OPENROUTER_API_KEY: Optional[str] = None

    # Object Storage Configurations
    STORAGE_BACKEND: str = "local"
    STORAGE_BUCKET: str = "educationos-assets"
    STORAGE_BUCKET_NAME: str = "educationos-assets"
    STORAGE_ENDPOINT_URL: Optional[str] = None
    STORAGE_ACCESS_KEY_ID: Optional[str] = None
    STORAGE_SECRET_ACCESS_KEY: Optional[str] = None
    STORAGE_REGION: str = "auto"
    STORAGE_LOCAL_PATH: str = "uploads"

    # Communication Configurations
    EMAIL_PROVIDER: str = "mock"
    RESEND_API_KEY: Optional[str] = None
    BREVO_API_KEY: Optional[str] = None
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None
    SMS_GATEWAY_PROVIDER: str = "mock"
    GREENWEB_API_KEY: Optional[str] = None
    OSEL_API_KEY: Optional[str] = None
    SMS_API_KEY: Optional[str] = None

    PAYMENT_WEBHOOK_SECRET: Optional[str] = None      # python -c "import secrets; print(secrets.token_hex(32))"
    PAYMENT_CHECKOUT_BASE_URL: Optional[str] = None

    @field_validator("SECRET_KEY")
    @classmethod
    def enforce_strong_secret(cls, v: str) -> str:
        if len(v) < 32 or "educationos_secret_key_2026" in v:
            raise ValueError(
                "CRITICAL SECURITY FAILURE: SECRET_KEY must be a cryptographically random string of at least 32 characters."
            )
        return v

    # Pydantic v2 configuration:
    model_config = SettingsConfigDict(
        env_file=(str(_ENV_FILE), ".env"),
        case_sensitive=True,
        extra="ignore"
    )

# Instantiate the settings so it can be imported across the app
settings = Settings()