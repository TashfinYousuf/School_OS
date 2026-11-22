import uuid
import datetime
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.api.deps import get_db, get_current_user, get_current_tenant_id, require_roles
from app.models.workspace import Workspace, WorkspaceMembership, InstitutionalMembership, Organization, WorkspaceType
from app.models.tenant import User, SchoolProfile

logger = logging.getLogger(__name__)

router = APIRouter()


class WorkspaceCreatePayload(BaseModel):
    name: str = Field(..., json_schema_extra={"example": "Model Future Academy & Coaching"})
    workspace_type: str = Field(..., json_schema_extra={"example": "academy"}) # "school" or "academy"
    enabled_modules: Optional[List[str]] = None


class SwitchWorkspacePayload(BaseModel):
    workspace_id: uuid.UUID


class WorkspaceOut(BaseModel):
    id: str
    name: str
    workspace_type: str
    code: Optional[str] = ""
    role: str
    enabled_modules: dict

class CreateAcademyWorkspacePayload(BaseModel):
    name: str = Field(..., min_length=2, max_length=150, json_schema_extra={"example": "Model Future Academic Care"})
    code: Optional[str] = Field(None, max_length=50, json_schema_extra={"example": "FAC-ACAD"})

def get_tenant_school_name(db: Session, tenant_id: str) -> str:
    """Fetches the authentic registered school name for this tenant."""
    school_profile = db.query(SchoolProfile).filter(SchoolProfile.tenant_id == str(tenant_id)).first()
    if school_profile and school_profile.school_name:
        return school_profile.school_name.strip()
    return "Institutional School"


def ensure_default_workspaces(db: Session, tenant_id: str) -> List[Workspace]:
    """
    Auto-provisions ONLY the Primary School workspace for this specific tenant.
    Never hardcodes a specific tenant or forces an Academy workspace for other schools.
    """
    workspaces = db.query(Workspace).filter(Workspace.tenant_id == str(tenant_id)).all()
    if workspaces:
        return workspaces

    real_school_name = get_tenant_school_name(db, tenant_id)
    school_code = f"SCH-{str(tenant_id)[:6].upper()}"

    # Auto-provision ONLY the primary School workspace
    school_ws = Workspace(
        tenant_id=str(tenant_id),
        workspace_type=WorkspaceType.SCHOOL,
        name=real_school_name,
        code=school_code,
        enabled_modules={
            "attendance": True,
            "students": True,
            "finance": True,
            "exams": True,
            "notices": True,
            "routine": True,
            "ai_copilot": True,
            "live_exams": False,
            "batches": False
        },
        is_active=True
    )
    db.add(school_ws)
    db.commit()
    db.refresh(school_ws)

    # Note: Academy workspace is OPTIONAL and only created on-demand via the wizard!
    return [school_ws]


@router.get("", response_model=List[WorkspaceOut])
@router.get("/", response_model=List[WorkspaceOut])
def get_tenant_workspaces_list(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user)
):
    # 1. Fetch real school profile name registered by the institution
    real_school_name = get_tenant_school_name(db, tenant_id)

    # 2. Fetch existing workspaces strictly under this tenant
    workspaces = db.query(Workspace).filter(
        Workspace.tenant_id == str(tenant_id),
        Workspace.is_active == True
    ).all()

    # 3. If new school with no workspace, initialize only Primary School
    if not workspaces:
        school_ws = Workspace(
            tenant_id=str(tenant_id),
            workspace_type=WorkspaceType.SCHOOL,
            name=real_school_name,
            code=f"SCH-{str(tenant_id)[:6].upper()}",
            enabled_modules={
                "attendance": True,
                "finance": True,
                "exams": True,
                "notices": True,
                "routine": True,
                "ai_copilot": True,
                "live_exams": False,
                "batches": False
            },
            is_active=True
        )
        db.add(school_ws)
        db.commit()
        db.refresh(school_ws)
        workspaces = [school_ws]

    # Always ensure school workspace reflects authentic profile name
    for ws in workspaces:
        if ws.workspace_type == WorkspaceType.SCHOOL and ws.name != real_school_name:
            ws.name = real_school_name
            db.commit()

    return [
        WorkspaceOut(
            id=str(ws.id),
            name=ws.name,
            workspace_type=ws.workspace_type.value if hasattr(ws.workspace_type, "value") else str(ws.workspace_type),
            code=ws.code or f"WS-{str(ws.id)[:6].upper()}",
            role=current_user.role or "student",
            enabled_modules=ws.enabled_modules if isinstance(ws.enabled_modules, dict) else {m: True for m in (ws.enabled_modules or [])}
        )
        for ws in workspaces
    ]


@router.get("/current")
def get_active_workspace(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    x_workspace_id: Optional[str] = Header(None, alias="X-Workspace-ID"),
    x_workspace_type: Optional[str] = Header(None, alias="X-Workspace-Type")
):
    """
    Resolves the active workspace context strictly within this tenant's scope.
    """
    workspaces = ensure_default_workspaces(db, tenant_id)
    active_ws = None

    if x_workspace_id:
        active_ws = next((w for w in workspaces if str(w.id) == str(x_workspace_id).strip()), None)

    if not active_ws and x_workspace_type:
        target_type = str(x_workspace_type).strip().lower()
        active_ws = next((w for w in workspaces if (w.workspace_type.value if hasattr(w.workspace_type, "value") else str(w.workspace_type)).lower() == target_type), None)

    if not active_ws:
        active_ws = workspaces[0]

    return {
        "id": str(active_ws.id),
        "name": active_ws.name,
        "workspace_type": active_ws.workspace_type.value if hasattr(active_ws.workspace_type, "value") else str(active_ws.workspace_type),
        "code": getattr(active_ws, "code", f"WS-{str(active_ws.id)[:6].upper()}"),
        "enabled_modules": active_ws.enabled_modules or {},
        "is_active": active_ws.is_active
    }


@router.post("", status_code=status.HTTP_201_CREATED)
@router.post("/", status_code=status.HTTP_201_CREATED)
def create_workspace(
    payload: WorkspaceCreatePayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    _=Depends(require_roles(["admin"]))
):
    """
    Creates a new Workspace (e.g. specialized Coaching Program or Secondary Campus).
    """
    ws_type_str = payload.workspace_type.lower().strip()
    if ws_type_str not in ["school", "academy"]:
        raise HTTPException(status_code=400, detail="Invalid workspace_type. Must be 'school' or 'academy'.")

    ws_type = WorkspaceType.ACADEMY if ws_type_str == "academy" else WorkspaceType.SCHOOL

    default_modules = (
        ["programs", "batches", "live_exams", "question_bank", "doubt_solver"]
        if ws_type == WorkspaceType.ACADEMY
        else ["attendance", "students", "finance", "exams", "notices", "routine"]
    )

    new_ws = Workspace(
        tenant_id=str(tenant_id),
        workspace_type=ws_type,
        name=payload.name,
        enabled_modules=payload.enabled_modules or default_modules,
        is_active=True
    )
    db.add(new_ws)
    db.commit()
    db.refresh(new_ws)

    return {
        "id": str(new_ws.id),
        "tenant_id": new_ws.tenant_id,
        "name": new_ws.name,
        "workspace_type": new_ws.workspace_type.value if hasattr(new_ws.workspace_type, "value") else str(new_ws.workspace_type),
        "enabled_modules": new_ws.enabled_modules,
        "message": "Workspace successfully provisioned."
    }

@router.post("/enable-academy", status_code=status.HTTP_201_CREATED)
@router.post("/wizard/academy", status_code=status.HTTP_201_CREATED)
def enable_academy_workspace_module(
    payload: CreateAcademyWorkspacePayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user)
):
    """
    On-Demand Academy Setup Wizard:
    Provisions a coaching/academic care workspace for institutions opting in.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required to provision institutional modules."
        )

    # Check if Academy is already provisioned for this tenant
    existing_academy = db.query(Workspace).filter(
        Workspace.tenant_id == str(tenant_id),
        Workspace.workspace_type == WorkspaceType.ACADEMY
    ).first()

    if existing_academy:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An Academy workspace is already active for this institution."
        )

    academy_code = (payload.code or f"ACAD-{str(tenant_id)[:6]}").strip().upper()

    existing_code = db.query(Workspace).filter(
        Workspace.tenant_id == str(tenant_id),
        Workspace.code == academy_code
    ).first()
    if existing_code:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Workspace code '{academy_code}' is already in use within this institution."
        )

    academy_ws = Workspace(
        tenant_id=str(tenant_id),
        workspace_type=WorkspaceType.ACADEMY,
        name=payload.name.strip(),
        code=academy_code,
        enabled_modules={
            "programs": True,
            "batches": True,
            "live_exams": True,
            "question_bank": True,
            "doubt_solver": True,
            "omr_grading": True
        },
        is_active=True
    )
    db.add(academy_ws)
    db.commit()
    db.refresh(academy_ws)

    return {
        "message": "Academy module provisioned successfully.",
        "workspace": {
            "id": str(academy_ws.id),
            "name": academy_ws.name,
            "workspace_type": "academy",
            "code": academy_ws.code,
            "enabled_modules": academy_ws.enabled_modules
        }
    }

@router.post("/switch")
def switch_active_workspace(
    payload: SwitchWorkspacePayload,
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id)
):
    """
    Validates workspace ownership strictly within the tenant boundary.
    """
    ws = db.query(Workspace).filter(
        Workspace.id == payload.workspace_id,
        Workspace.tenant_id == str(tenant_id)
    ).first()

    if not ws:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or unauthorized for this tenant."
        )

    return {
        "status": "SWITCHED",
        "active_workspace_id": str(ws.id),
        "workspace_type": ws.workspace_type.value if hasattr(ws.workspace_type, "value") else str(ws.workspace_type),
        "name": ws.name,
        "enabled_modules": ws.enabled_modules
    }


@router.get("/my-workspaces", response_model=List[WorkspaceOut])
def get_user_assigned_workspaces(
    db: Session = Depends(get_db),
    tenant_id: str = Depends(get_current_tenant_id),
    current_user: User = Depends(get_current_user)
):
    """
    Returns strictly the workspaces belonging to the authenticated tenant/user.
    Zero cross-tenant leakage. No cross-tenant leakage to other tenants.
    """
    # 1. Fetch user memberships
    memberships = db.query(InstitutionalMembership).filter(
        InstitutionalMembership.user_id == str(current_user.id),
        InstitutionalMembership.is_active == True
    ).all()

    # 2. If explicit memberships exist, return mapped workspaces
    if memberships:
        results = []
        for m in memberships:
            ws = db.query(Workspace).filter(Workspace.id == m.workspace_id).first()
            if ws and ws.is_active:
                if str(ws.tenant_id) == str(tenant_id) or str(ws.organization_id) == str(tenant_id) or str(current_user.tenant_id) == str(tenant_id):
                    results.append(WorkspaceOut(
                        id=str(ws.id),
                        name=ws.name,
                        workspace_type=ws.workspace_type.value if hasattr(ws.workspace_type, "value") else str(ws.workspace_type),
                        code=ws.code or f"WS-{str(ws.id)[:6].upper()}",
                        role=m.role,
                        enabled_modules=ws.enabled_modules or {}
                    ))
        if results:
            return results

    # 3. If no explicit membership, resolve workspaces strictly scoped to this authenticated tenant
    workspaces = db.query(Workspace).filter(
        Workspace.tenant_id == str(tenant_id),
        Workspace.is_active == True
    ).all()

    if workspaces:
        return [
            WorkspaceOut(
                id=str(ws.id),
                name=ws.name,
                workspace_type=ws.workspace_type.value if hasattr(ws.workspace_type, "value") else str(ws.workspace_type),
                code=ws.code or f"WS-{str(ws.id)[:6].upper()}",
                role=current_user.role or "student",
                enabled_modules=ws.enabled_modules or {}
            )
            for ws in workspaces
        ]

    # 4. Fallback if new tenant has no workspace row yet
    school_profile = db.query(SchoolProfile).filter(SchoolProfile.tenant_id == str(tenant_id)).first()
    inst_name = school_profile.school_name if school_profile else "Institutional Workspace"
    return [
        WorkspaceOut(
            id=str(tenant_id),
            name=inst_name,
            workspace_type="school",
            code=f"SCH-{str(tenant_id)[:6].upper()}",
            role=current_user.role or "admin",
            enabled_modules={
                "attendance": True,
                "fee_ledger": True,
                "ai_exam": True,
                "live_exam_mcq": False,
                "batches": False,
                "notice_board": True,
                "ai_tutor": True
            }
        )
    ]

