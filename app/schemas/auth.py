from pydantic import BaseModel
from typing import Optional

class Token(BaseModel):
    """
    Response schema when user successfully logs in
    """
    access_token: str
    token_type: str
    
class TokenPayload(BaseModel):
    """
    Schema for decoding the JWT Token.
    sub: User ID
    tenant_id: School ID
    """
    sub: Optional[str] = None
    tenant_id: Optional[str] = None