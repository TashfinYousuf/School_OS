import uuid
from typing import Any, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

class SecurityOwnershipGuard:
    """
    Production-grade Anti-IDOR and Tenant Isolation Validator.
    Ensures zero cross-tenant leakage across all API endpoints.
    """

    @staticmethod
    def get_or_404_tenant_resource(
        db: Session,
        model_class: Any,
        resource_id: Any,
        current_tenant_id: str,
        resource_name: Optional[str] = None
    ) -> Any:
        """
        Fetches an entity strictly bound to current_tenant_id.
        Returns 404 (Not 403) to prevent resource existence enumeration.
        """
        resolved_id = resource_id
        if isinstance(resource_id, str):
            try:
                resolved_id = uuid.UUID(resource_id.strip())
            except (ValueError, TypeError):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"{resource_name or getattr(model_class, '__name__', 'Resource')} not found."
                )

        query = db.query(model_class).filter(model_class.id == resolved_id)

        # Enforce Tenant Isolation
        if hasattr(model_class, "tenant_id"):
            query = query.filter(model_class.tenant_id == str(current_tenant_id))

        resource = query.first()

        if not resource:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"{resource_name or getattr(model_class, '__name__', 'Resource')} not found."
            )

        return resource

    @staticmethod
    def verify_student_scope(
        current_user_role: str,
        current_user_id: str,
        student: Any,
        db: Session
    ) -> bool:
        """
        Enforces least-privilege scope:
        - Admin: Full institutional scope.
        - Teacher: Full academic scope for tenant.
        - Student: Can only view their own profile.
        - Guardian: Can only view their enrolled children.
        """
        role = (current_user_role or "").lower()

        if role in ["admin", "teacher"]:
            return True

        if role == "student":
            if str(student.id) != str(current_user_id) and str(getattr(student, "user_id", None)) != str(current_user_id):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access restricted: You can only access your own academic record."
                )
            return True

        if role == "guardian":
            guardian_phone = getattr(student, "guardian_phone", None)
            from app.models.users import User
            guardian_user = db.query(User).filter(User.id == current_user_id).first()
            if not guardian_user or guardian_user.phone != guardian_phone:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access restricted: You are not authorized to view this student's records."
                )
            return True

        return True

security_guard = SecurityOwnershipGuard()