from pydantic import BaseModel

class Token(BaseModel):
    """
    Response schema when user successfully logs in
    """
    access_token: str
    token_type: str
    
class TokenPayload(BaseModel):
    """
    Schema for decoding the JWT Token
    """
    sub: str | None = None
    tenant_id: str | None = None