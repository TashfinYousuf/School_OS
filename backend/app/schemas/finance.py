# backend/app/schemas/finance.py
from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, Optional, List
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.finance import PaymentMethod, PaymentStatus, InvoiceStatus


class InvoiceLineItemCreate(BaseModel):
    description: str = Field(..., min_length=2, max_length=255)
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    quantity: int = Field(default=1, ge=1)
    unit_price: Optional[Decimal] = Field(None, decimal_places=2)


class InvoiceLineItemResponse(BaseModel):
    id: UUID
    invoice_id: UUID
    description: str
    quantity: int
    unit_price: Decimal
    amount: Decimal

    model_config = ConfigDict(from_attributes=True)


class InvoiceCreate(BaseModel):
    student_id: UUID
    billing_month: str = Field(..., min_length=2, max_length=50)
    title: Optional[str] = Field("Monthly Tuition Invoice", max_length=150)
    due_date: Optional[datetime] = None
    discount_amount: Optional[Decimal] = Field(default=Decimal("0.00"), ge=0, decimal_places=2)
    currency: Optional[str] = Field(default="BDT", max_length=3)
    items: List[InvoiceLineItemCreate] = Field(..., min_length=1)


class InvoiceResponse(BaseModel):
    id: UUID
    tenant_id: str
    student_id: str
    invoice_number: str
    title: str
    billing_month: str
    total_amount: Decimal
    paid_amount: Decimal
    discount_amount: Decimal
    currency: str
    status: str
    due_date: Optional[datetime]
    issued_at: datetime
    created_at: datetime
    items: List[InvoiceLineItemResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


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