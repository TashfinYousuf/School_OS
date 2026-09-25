from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import ConfigDict

class Settings(BaseSettings):
    """
    Application configuration settings.
    Reads from environment variables or .env file automatically.
    """
    PROJECT_NAME: str = "SchoolOS - AI-Powered Education SaaS"
    ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours, adjust to your needs
    API_V1_STR: str = "/api/v1"
    
    # Database Configurations
    # Default is a local postgres database for development
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/schoolos_db"
    
    # JWT Configs (Will be used in Step 2)
    SECRET_KEY: str = "super-secret-key-change-this-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8 # 8 Days

    GEMINI_API_KEY: str 

    # Pydantic v2 এর সঠিক কনফিগারেশন:
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")

# Instantiate the settings so it can be imported across the app
settings = Settings()