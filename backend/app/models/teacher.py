from sqlalchemy import Column, Integer, String, Float
from app.models.base import Base

class Teacher(Base):
    __tablename__ = "teachers"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, index=True)
    first_name = Column(String, index=True)
    last_name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    employee_id = Column(String, unique=True, index=True)
    
    # Vision 2030 Fields
    subject_expertise = Column(String)  # e.g., "Physics, Advanced Math"
    ai_quality_score = Column(Float, default=0.0)  # Continuous Teacher Assessment Score
    skills_tags = Column(String)  # e.g., "STEM, Digital Pedagogy, Problem Solving"