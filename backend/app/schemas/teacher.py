from typing import Optional, List, Any, Dict
from pydantic import BaseModel, ConfigDict
from datetime import date
from uuid import UUID

# ১. ফ্রন্টএন্ড ঠিক যে ডেটাগুলো পাঠাচ্ছে, স্কিমা ঠিক সেটাই রিসিভ করবে
class TeacherCreate(BaseModel):
    first_name: str
    last_name: str
    name_bn: Optional[str] = None
    email: str
    password: str
    designation: str
    employee_id: Optional[str] = None
    department: Optional[str] = None
    employment_type: Optional[str] = "Permanent"
    joining_date: Optional[date] = None
    assigned_class: Optional[str] = None
    subjects_taught: Optional[str] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    qualifications: Optional[List[Dict[str, Any]]] = None
    experience: Optional[List[Dict[str, Any]]] = None
    cv_url: Optional[str] = None
    bio: Optional[str] = None

class TeacherUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    name_bn: Optional[str] = None
    designation: Optional[str] = None
    employee_id: Optional[str] = None
    department: Optional[str] = None
    employment_type: Optional[str] = None
    joining_date: Optional[date] = None
    assigned_class: Optional[str] = None
    subjects_taught: Optional[str] = None
    phone_number: Optional[str] = None
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    qualifications: Optional[List[Dict[str, Any]]] = None
    experience: Optional[List[Dict[str, Any]]] = None
    cv_url: Optional[str] = None
    bio: Optional[str] = None
    status: Optional[str] = None

# ২. ডাটাবেস থেকে ঠিক যে ডেটাগুলো আসবে, রেসপন্স সেভাবেই সাজানো হলো
class TeacherResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    first_name: str
    last_name: str
    name_bn: Optional[str] = None
    employee_id: Optional[str] = None
    designation: Optional[str] = None
    department: Optional[str] = None
    employment_type: Optional[str] = "Permanent"
    joining_date: Optional[date] = None
    assigned_class: Optional[str] = None
    subjects_taught: Optional[str] = None
    phone_number: Optional[str] = None
    email: Optional[str] = None
    status: Optional[str] = "Active"
    attendance_today: Optional[str] = "Pending"
    address: Optional[str] = None
    emergency_contact: Optional[str] = None
    qualifications: Optional[List[Dict[str, Any]]] = None
    experience: Optional[List[Dict[str, Any]]] = None
    cv_url: Optional[str] = None
    bio: Optional[str] = None
    
    # EducationOS Vision 2030 (Optional Fallbacks)
    ai_quality_score: float = 8.5
    skills_tags: Optional[str] = "STEM Pedagogy"

    model_config = ConfigDict(from_attributes=True)