from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# Create the SQLAlchemy engine
# pool_pre_ping checks if the connection is alive before using it
engine = create_engine(
    settings.DATABASE_URL, 
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)

# Create a configured "Session" class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Dependency to get a database session in our FastAPI routes
def get_db():
    """
    Provides a transactional scope around a series of operations.
    Yields a database session and closes it automatically after the request.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()