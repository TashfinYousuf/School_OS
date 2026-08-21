from typing import Optional
from pydantic import BaseModel
from uuid import UUID

# ১. ফ্রন্টএন্ড ঠিক যে ডেটাগুলো পাঠাচ্ছে, স্কিমা ঠিক সেটাই রিসিভ করবে
class TeacherCreate(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str
    designation: str

# ২. ডাটাবেস থেকে ঠিক যে ডেটাগুলো আসবে, রেসপন্স সেভাবেই সাজানো হলো
class TeacherResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    first_name: str
    last_name: str
    designation: Optional[str] = None
    
    # SchoolOS Vision 2030 (Optional Fallbacks)
    # ডাটাবেসে এই ফিল্ডগুলো না থাকলেও API ক্র্যাশ করবে না, ডিফল্ট ভ্যালু পাঠিয়ে দিবে
    ai_quality_score: float = 8.5
    skills_tags: Optional[str] = "STEM Pedagogy"

    class Config:
        from_attributes = True