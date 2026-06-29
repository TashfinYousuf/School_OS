from pydantic_settings import BaseSettings
from pydantic import ConfigDict

class Settings(BaseSettings):
    """
    Application configuration settings.
    Reads from environment variables or .env file automatically.
    """
    PROJECT_NAME: str = "SchoolOS - AI-Powered Education SaaS"
    API_V1_STR: str = "/api/v1"
    
    # Database Configurations
    # Default is a local postgres database for development
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/schoolos_db"
    
    # JWT Configs (Will be used in Step 2)
    SECRET_KEY: str = "super-secret-key-change-this-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8 # 8 Days

    model_config = ConfigDict(env_file=".env", case_sensitive=True)

# Instantiate the settings so it can be imported across the app
settings = Settings()