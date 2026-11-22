# backend/app/models/curriculum.py
import uuid
from sqlalchemy import Column, String, Integer, Text, Boolean, DateTime, Index, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from app.models.base import Base


class CurriculumDocument(Base):
    """
    Curriculum Knowledge Document metadata for ingested files (PDF, DOCX, TXT).
    Tracks parsing lifecycle, file size, hash, and extracted chunk count.
    """
    __tablename__ = "curriculum_documents"
    __table_args__ = (
        Index("ix_curriculum_docs_tenant_status", "tenant_id", "status"),
        {"extend_existing": True}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(64), index=True, nullable=False)
    
    title = Column(String(200), nullable=False)
    class_name = Column(String(50), index=True, nullable=False)
    subject = Column(String(100), index=True, nullable=False)
    chapter = Column(String(100), nullable=True)
    academic_year = Column(String(20), default="2026", nullable=False)
    group = Column(String(50), nullable=True) # Science, Humanities, Business Studies
    
    file_name = Column(String(255), nullable=False)
    file_type = Column(String(50), nullable=False) # "pdf", "docx", "txt"
    file_size_bytes = Column(Integer, default=0, nullable=False)
    file_hash = Column(String(64), nullable=True)
    
    status = Column(String(30), default="PENDING", index=True, nullable=False) # PENDING, PARSING, INDEXED, FAILED
    error_message = Column(Text, nullable=True)
    chunks_count = Column(Integer, default=0, nullable=False)
    metadata_payload = Column(JSONB, default=dict, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class CurriculumChunk(Base):
    """
    Curriculum Knowledge Chunk for RAG-grounded pedagogical generation.
    Supports national/global curriculum (is_global_curriculum=True) and
    tenant-specific institutional curriculum (tenant_id scoped).
    """
    __tablename__ = "curriculum_chunks"
    __table_args__ = (
        Index("ix_curriculum_chunks_tenant_lookup", "tenant_id", "subject", "class_name"),
        Index("ix_curriculum_chunks_global_lookup", "is_global_curriculum", "subject", "class_name"),
        {"extend_existing": True}
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String(64), index=True, nullable=True) # Nullable for global NCTB documents
    document_id = Column(UUID(as_uuid=True), ForeignKey("curriculum_documents.id", ondelete="CASCADE"), nullable=True, index=True)
    
    title = Column(String(200), nullable=False)
    class_name = Column(String(50), index=True, nullable=False)
    subject = Column(String(100), index=True, nullable=False)
    chapter = Column(String(100), nullable=True)
    academic_year = Column(String(20), nullable=True, default="2026")
    group = Column(String(50), nullable=True)
    
    content = Column(Text, nullable=False)
    chunk_index = Column(Integer, default=0, nullable=False)
    
    is_global_curriculum = Column(Boolean, default=False, nullable=False, index=True)
    metadata_payload = Column(JSONB, default=dict, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


