import bcrypt
from datetime import datetime, timedelta, timezone
from jose import jwt
from app.core.config import settings

ALGORITHM = "HS256"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed one using bcrypt directly."""
    # bcrypt requires strings to be encoded to bytes before checking
    return bcrypt.checkpw(
        plain_password.encode('utf-8'), 
        hashed_password.encode('utf-8')
    )

def get_password_hash(password: str) -> str:
    """Generate a bcrypt hash for a plain password."""
    # Generate salt and hash the password
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    # Decode back to string so it can be saved in the database (VARCHAR)
    return hashed.decode('utf-8')

def create_access_token(subject: str, tenant_id: str, expires_delta: timedelta | None = None) -> str:
    """Create a JWT token combining user subject (ID) and their tenant_id."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {"exp": expire, "sub": str(subject), "tenant_id": str(tenant_id)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    
    return encoded_jwt