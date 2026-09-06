from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import uuid

from app.core.database import get_db
from app.api.deps import get_current_tenant_id, require_roles
from app.models.result import StudentResult
from app.models.student import Student

router = APIRouter()

class MarkEntryItem(BaseModel):
    student_id: uuid.UUID
    marks_obtained: float
    remarks: Optional[str] = None

class BulkMarksPayload(BaseModel):
    exam_term: str
    class_name: str
    subject: str
    entries: List[MarkEntryItem]

def calculate_nctb_grade(marks: float):
    if marks >= 80:
        return "A+", 5.0
    elif marks >= 70:
        return "A", 4.0
    elif marks >= 60:
        return "A-", 3.5
    elif marks >= 50:
        return "B", 3.0
    elif marks >= 40:
        return "C", 2.0
    elif marks >= 33:
        return "D", 1.0
    else:
        return "F", 0.0


# শিক্ষক ও অ্যাডমিন উভয়েই নম্বর ও হাজিরা ইনপুট দিতে পারবে:
@router.post("/bulk-submit")
def submit_class_marks(
    payload: BulkMarksPayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher"]))
):
    """
    Saves subject marks for an entire class and auto-computes NCTB grades.
    """
    for entry in payload.entries:
        grade, gpa = calculate_nctb_grade(entry.marks_obtained)
        
        # Check existing result row
        existing = db.query(StudentResult).filter(
            StudentResult.tenant_id == tenant_id,
            StudentResult.student_id == entry.student_id,
            StudentResult.exam_term == payload.exam_term,
            StudentResult.subject == payload.subject
        ).first()

        if existing:
            existing.marks_obtained = entry.marks_obtained
            existing.grade = grade
            existing.grade_point = gpa
            existing.remarks = entry.remarks
        else:
            new_res = StudentResult(
                tenant_id=tenant_id,
                student_id=entry.student_id,
                exam_term=payload.exam_term,
                class_name=payload.class_name,
                subject=payload.subject,
                marks_obtained=entry.marks_obtained,
                grade=grade,
                grade_point=gpa,
                remarks=entry.remarks
            )
            db.add(new_res)

    db.commit()
    return {"message": "Marks recorded and grades calculated successfully."}

@router.get("/progress-card/{student_id}")
def get_student_progress_card(
    student_id: uuid.UUID,
    exam_term: str,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin", "teacher", "guardian"]))
):
    """
    Generates data for printing official A4 Academic Progress Report Card.
    """
    student = db.query(Student).filter(Student.id == student_id, Student.tenant_id == tenant_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    results = db.query(StudentResult).filter(
        StudentResult.tenant_id == tenant_id,
        StudentResult.student_id == student_id,
        StudentResult.exam_term == exam_term
    ).all()

    total_marks = sum(r.marks_obtained for r in results)
    avg_gpa = (sum(r.grade_point for r in results) / len(results)) if results else 0.0

    return {
        "student": {
            "name": f"{student.first_name} {student.last_name}",
            "admission_number": student.admission_number,
            "roll_number": student.roll_number,
            "class_name": student.class_name
        },
        "exam_term": exam_term,
        "results": [
            {
                "subject": r.subject,
                "marks_obtained": r.marks_obtained,
                "grade": r.grade,
                "grade_point": r.grade_point
            }
            for r in results
        ],
        "total_marks": total_marks,
        "gpa": round(avg_gpa, 2)
    }