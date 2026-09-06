import uuid
from sqlalchemy import Column, String, DateTime, Float, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from app.models.base import Base

class FeePayment(Base):
    __tablename__ = "fee_payments"
    __table_args__ = {'extend_existing': True}

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, index=True, nullable=False)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    
    receipt_no = Column(String, index=True, nullable=False) # e.g. REC-2026-A1B2C3
    fee_type = Column(String, nullable=False)              # Monthly Tuition Fee, Exam Fee, etc.
    billing_month = Column(String, nullable=False)         # e.g. "September 2026"
    
    amount_paid = Column(Float, nullable=False)
    currency = Column(String, default="BDT")               # BDT, USD, USDT
    discount = Column(Float, default=0.0)
    
    # 🚀 Multi-Gateway Real-Time Verification Fields
    payment_method = Column(String, nullable=False)        # Cash, bKash, Nagad, Bank, Crypto
    transaction_id = Column(String, index=True, nullable=False) # TrxID / Deposit Slip No / Crypto TxHash
    sender_number_or_wallet = Column(String, nullable=True)     # 017... / Bank A/C / 0x...
    verification_status = Column(String, default="Verified")    # Verified, Pending
    remarks = Column(Text, nullable=True)
    
    collected_by = Column(String, nullable=True)
    payment_date = Column(DateTime(timezone=True), default=func.now())