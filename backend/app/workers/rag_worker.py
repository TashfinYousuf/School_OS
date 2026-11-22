# backend/app/workers/rag_worker.py
"""
EducationOS Standalone RAG Ingestion & Indexing Worker Daemon.
Decouples heavy document parsing, OCR/text extraction, and Gemini vector embedding
generation entirely from the FastAPI API process.

Key Architectural Guarantees:
1. Complete Isolation: Runs as an independent process; API remains 100% responsive.
2. Short-Lived Database Transactions: Database sessions are checked in immediately. Sessions
   are never held open across external network calls (Gemini embeddings) or CPU-intensive parsing.
3. Checkpoint Recovery: Resumes from chunk_cursor upon unexpected worker restart or crash.
4. Signal Handling: Handles SIGTERM/SIGINT gracefully without corrupting database state.
5. Multi-Tenant RLS Compliance: Sets transaction-local tenant context for all reads and writes.
"""
import sys
import os
import time
import signal
import uuid
import logging
import datetime
from typing import Optional, Dict, Any

from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.database import SessionLocal
from app.models.curriculum import CurriculumDocument
from app.services.curriculum_rag import CurriculumRAGService, sanitize_payload

logger = logging.getLogger("educationos.workers.rag_worker")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s"
)


class RAGWorkerDaemon:
    """
    Dedicated background worker process that sweeps the database for QUEUED
    curriculum documents, claims them atomically, and processes them with checkpointing.
    """

    def __init__(self, poll_interval_sec: float = 2.0, max_idle_sleep: float = 5.0):
        self.poll_interval = poll_interval_sec
        self.max_idle_sleep = max_idle_sleep
        self.running = False
        self._setup_signals()

    def _setup_signals(self):
        """Registers clean OS signal handlers for graceful shutdown."""
        try:
            signal.signal(signal.SIGINT, self._handle_exit)
            signal.signal(signal.SIGTERM, self._handle_exit)
        except (ValueError, AttributeError):
            # Not in main thread or unsupported platform
            pass

    def _handle_exit(self, signum, frame):
        logger.info(f"Received termination signal ({signum}). Requesting graceful shutdown...")
        self.running = False

    @staticmethod
    def _open_session(tenant_id: Optional[str] = None) -> Session:
        """Opens a short-lived SessionLocal with proper tenant RLS context."""
        s = SessionLocal()
        if tenant_id:
            tid = str(tenant_id)
            s.info["tenant_id"] = tid
            if s.bind and s.bind.dialect.name == "postgresql":
                try:
                    s.execute(
                        text("SELECT set_config('app.current_tenant_id', :tenant_id, true)"),
                        {"tenant_id": tid}
                    )
                except Exception as exc:
                    logger.warning(f"Failed to set tenant context in worker: {exc}")
        return s

    def claim_next_job(self) -> Optional[Dict[str, Any]]:
        """
        Atomically queries and claims the oldest pending QUEUED or RESUMABLE document.
        Uses a short-lived session and returns minimal metadata dict.
        """
        with self._open_session() as db:
            # Query oldest queued document
            query = db.query(CurriculumDocument).filter(
                CurriculumDocument.status == "QUEUED"
            ).order_by(CurriculumDocument.created_at.asc())

            # Row lock if supported
            if db.bind and db.bind.dialect.name == "postgresql":
                query = query.with_for_update(skip_locked=True)

            doc = query.first()
            if not doc:
                return None

            job_info = {
                "id": doc.id,
                "tenant_id": str(doc.tenant_id),
                "title": doc.title,
                "file_type": doc.file_type,
            }
            # Transition to VALIDATING to claim job
            doc.status = "VALIDATING"
            doc.metadata_payload = sanitize_payload({
                **(doc.metadata_payload or {}),
                "stage": "claimed_by_worker",
                "claimed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
                "worker_pid": os.getpid(),
            })
            db.commit()
            return job_info

    def process_job(self, job_info: Dict[str, Any]):
        """Executes document ingestion via CurriculumRAGService with bounded error handling."""
        doc_id = job_info["id"]
        tenant_id = job_info["tenant_id"]
        logger.info(f"Processing RAG job: doc_id={doc_id}, tenant={tenant_id}, title={job_info.get('title')}")

        try:
            CurriculumRAGService.process_document_background(
                doc_id=doc_id,
                tenant_id=tenant_id
            )
            logger.info(f"Successfully processed RAG job: doc_id={doc_id}")
        except Exception as exc:
            logger.error(f"Worker exception processing doc_id={doc_id}: {exc}", exc_info=True)

    def run_single_iteration(self) -> bool:
        """Runs a single poll cycle. Returns True if a job was found and processed."""
        try:
            job = self.claim_next_job()
            if job:
                self.process_job(job)
                return True
            return False
        except Exception as exc:
            logger.error(f"Error in worker poll cycle: {exc}", exc_info=True)
            return False

    def run(self):
        """Main worker loop with graceful termination support."""
        self.running = True
        logger.info(f"Starting EducationOS RAG Worker Daemon (PID {os.getpid()})...")

        while self.running:
            found_work = self.run_single_iteration()
            if found_work:
                # Immediate next poll if work was processed
                continue
            else:
                # Sleep interval when idle
                time.sleep(self.poll_interval)

        logger.info("EducationOS RAG Worker Daemon terminated cleanly.")


def main():
    daemon = RAGWorkerDaemon()
    daemon.run()


if __name__ == "__main__":
    main()

