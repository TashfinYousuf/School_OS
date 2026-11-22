# app/schemas/institution.py
from typing import Optional
from pydantic import BaseModel, Field

class InstitutionProfile(BaseModel):
    tenant_id: str
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    school_code: Optional[str] = None
    academic_year: Optional[str] = None
    logo_url: Optional[str] = None
    tagline: Optional[str] = None
    eiin_or_code: Optional[str] = None

class InstitutionProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    address: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    email: Optional[str] = Field(None, max_length=254)