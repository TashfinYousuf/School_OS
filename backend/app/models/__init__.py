"""
Central models package initialization.
Exports Base and all domain models to ensure SQLAlchemy metadata completeness.
"""
from app.models.base import Base, TenantAwareModel
from app.models.tenant import Tenant, Role, User, SchoolProfile
from app.models.users import Teacher
from app.models.student import Student
from app.models.guardian import Guardian, GuardianStudentLink, GuardianRelationship, StudentGuardian
from app.models.academic import AcademicSession, ClassModel, GradeLevel, Subject, ClassRoutine, DailyLessonLog, StudentEnrollmentHistory
from app.models.workspace import Organization, Workspace, WorkspaceMembership, WorkspaceType, InstitutionalMembership
from app.models.attendance import AttendanceEvent
from app.models.approval import ApprovalTask, ApprovalRequest
from app.models.audit import AuditLog
from app.models.campus import CampusBranch
from app.models.communication import Message
from app.models.exam import Exam, ExamResult
from app.models.finance import FeePayment, Invoice, InvoiceLineItem, InvoiceStatus
from app.models.live_exam import LiveExam, ExamSubmission
from app.models.notice import Notice
from app.models.notification import PushSubscriptionRecord, NotificationOutbox
from app.models.question_paper import QuestionPaper
from app.models.result import StudentResult
from app.models.subscription import InstitutionSubscription, TenantSubscription
from app.models.subscription_payment import SubscriptionPayment
from app.models.billing import (
    SubscriptionPlan,
    PlanVersion,
    BillingInvoice,
    BillingInvoiceLineItem,
    BillingWebhookEvent,
    TenantEntitlement,
    BillingAuditLog,
)
from app.models.ai_governance import TenantAIBudget, AIUsageLog
from app.models.academy import AcademicProgram, AcademyBatch, BatchEnrollment
from app.models.auth import (
    RefreshTokenSession,
    RevokedTokenRecord,
    AccountInvitation,
    PasswordResetToken,
    EmailVerificationToken,
    UserWebAuthnCredential,
)
from app.models.storage import UploadedAsset
from app.models.admission import AdmissionApplication, AdmissionSession, AdmissionReceipt
from app.models.notice import NoticeAcknowledgement
from app.models.curriculum import CurriculumChunk, CurriculumDocument
from app.models.learning import StudySession, StudyFlashcard, PracticeAttempt, AIConversation, AIMessage

__all__ = [
    "Base",
    "TenantAwareModel",
    "Tenant",
    "Role",
    "User",
    "SchoolProfile",
    "Teacher",
    "Student",
    "Guardian",
    "GuardianStudentLink",
    "GuardianRelationship",
    "StudentGuardian",
    "AcademicSession",
    "ClassModel",
    "GradeLevel",
    "Subject",
    "ClassRoutine",
    "DailyLessonLog",
    "StudentEnrollmentHistory",
    "CurriculumDocument",
    "Organization",
    "Workspace",
    "WorkspaceMembership",
    "WorkspaceType",
    "InstitutionalMembership",
    "AttendanceEvent",
    "ApprovalTask",
    "ApprovalRequest",
    "AuditLog",
    "CampusBranch",
    "Message",
    "Exam",
    "ExamResult",
    "FeePayment",
    "Invoice",
    "InvoiceLineItem",
    "InvoiceStatus",
    "LiveExam",
    "ExamSubmission",
    "Notice",
    "NoticeAcknowledgement",
    "PushSubscriptionRecord",
    "QuestionPaper",
    "StudentResult",
    "InstitutionSubscription",
    "TenantSubscription",
    "SubscriptionPayment",
    "SubscriptionPlan",
    "PlanVersion",
    "BillingInvoice",
    "BillingInvoiceLineItem",
    "BillingWebhookEvent",
    "TenantEntitlement",
    "BillingAuditLog",
    "TenantAIBudget",
    "AIUsageLog",
    "AcademicProgram",
    "AcademyBatch",
    "BatchEnrollment",
    "RefreshTokenSession",
    "RevokedTokenRecord",
    "AccountInvitation",
    "PasswordResetToken",
    "EmailVerificationToken",
    "UserWebAuthnCredential",
    "UploadedAsset",
    "NotificationOutbox",
    "AdmissionApplication",
    "AdmissionSession",
    "AdmissionReceipt",
    "CurriculumChunk",
    "StudySession",
    "StudyFlashcard",
    "PracticeAttempt",
    "AIConversation",
    "AIMessage",
]

