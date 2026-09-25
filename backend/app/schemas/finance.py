# backend/app/schemas/finance.py
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.finance import PaymentMethod, PaymentStatus


class FeePaymentCreate(BaseModel):
    student_id: UUID
    invoice_id: Optional[UUID] = None
    amount: Decimal = Field(..., gt=0, decimal_places=2, description="Payment amount in BDT")
    payment_method: PaymentMethod
    idempotency_key: str = Field(..., min_length=16, max_length=128)
    bank_reference: Optional[str] = Field(None, max_length=128)
    notes: Optional[str] = Field(None, max_length=500)
    metadata_payload: Optional[Dict[str, Any]] = Field(default_factory=dict)

    @field_validator("bank_reference")
    @classmethod
    def validate_bank_reference(cls, v: Optional[str], info) -> Optional[str]:
        method = info.data.get("payment_method")
        if method == PaymentMethod.BANK_TRANSFER and not v:
            raise ValueError("bank_reference is mandatory for BANK_TRANSFER payments.")
        return v

    model_config = ConfigDict(from_attributes=True)


class FeePaymentResponse(BaseModel):
    id: UUID
    tenant_id: str
    student_id: UUID
    invoice_id: Optional[UUID]
    amount: Decimal
    currency: str
    payment_method: PaymentMethod
    payment_status: PaymentStatus
    receipt_number: str
    provider_transaction_id: Optional[str]
    bank_reference: Optional[str]
    collected_by_user_id: Optional[UUID]
    is_reconciled: bool
    reconciled_at: Optional[datetime]
    created_at: datetime
    metadata_payload: Dict[str, Any]

    model_config = ConfigDict(from_attributes=True)