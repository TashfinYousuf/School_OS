# backend/app/workers/outbox_worker.py
"""
EducationOS Transactional Outbox Notification Dispatcher Daemon.
Continuously sweeps the database for PENDING and retry-ready FAILED notification records
in the notification_outbox table, and dispatches them via configured external providers
(Email: Resend, Brevo, SMTP; SMS: GreenWeb, Osel, SSL Wireless).

Key Architectural Guarantees:
1. Complete Isolation: Runs as an independent process; FastAPI API process remains non-blocking.
2. Short-Lived Database Transactions: Database sessions are opened only for claiming and updating.
3. Row-Level Concurrency: Uses SELECT FOR UPDATE SKIP LOCKED on PostgreSQL so multiple daemon
   workers can run in parallel without contention or duplicate delivery.
4. Guaranteed Exponential Backoff: Schedules retries with 60s, 300s, 900s delays, dead-lettering after max_retries.
5. Signal Handling: Handles SIGTERM/SIGINT gracefully for clean zero-downtime restarts.
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
from sqlalchemy import text, or_, and_

from app.core.database import SessionLocal
from app.models.notification import NotificationOutbox
from app.services.communication_providers import dispatch_outbox_item, DeliveryResult

logger = logging.getLogger("educationos.workers.outbox_worker")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s"
)


class OutboxWorkerDaemon:
    """
    Dedicated background worker process that sweeps the database for PENDING
    or retry-ready FAILED notifications in the outbox, claiming and dispatching them.
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
        logger.info(f"Received termination signal ({signum}). Requesting graceful outbox shutdown...")
        self.running = False

    @staticmethod
    def _open_session() -> Session:
        """Opens a short-lived SessionLocal."""
        return SessionLocal()

    def claim_and_dispatch_next_job(self) -> Optional[Dict[str, Any]]:
        """
        Atomically queries and claims the oldest pending or retryable notification,
        dispatches it via the active communication provider, and records the result.
        """
        now_utc = datetime.datetime.now(datetime.timezone.utc)

        with self._open_session() as db:
            query = db.query(NotificationOutbox).filter(
                or_(
                    NotificationOutbox.status == "PENDING",
                    and_(
                        NotificationOutbox.status == "FAILED",
                        NotificationOutbox.retry_count < NotificationOutbox.max_retries,
                        or_(
                            NotificationOutbox.next_retry_at == None,
                            NotificationOutbox.next_retry_at <= now_utc
                        )
                    )
                )
            ).order_by(NotificationOutbox.created_at.asc())

            # Row lock if supported by database dialect
            if db.bind and db.bind.dialect.name == "postgresql":
                query = query.with_for_update(skip_locked=True)

            outbox_item = query.first()
            if not outbox_item:
                return None

            item_id = outbox_item.id
            recipient = outbox_item.recipient
            channel = outbox_item.channel

            logger.info(f"Claimed outbox message [{item_id}] for {channel} -> {recipient}")

            try:
                result = dispatch_outbox_item(db, item_id)
                return {
                    "id": str(item_id),
                    "channel": channel,
                    "recipient": recipient,
                    "status": result.status,
                    "delivered": result.delivered,
                    "provider": result.provider,
                    "error": result.error,
                }
            except Exception as exc:
                logger.error(f"Unexpected error dispatching outbox message {item_id}: {exc}")
                db.rollback()
                return {
                    "id": str(item_id),
                    "channel": channel,
                    "recipient": recipient,
                    "status": "ERROR",
                    "error": str(exc),
                }

    def start(self):
        """Starts the worker daemon main polling loop."""
        self.running = True
        logger.info(f"EducationOS Outbox Worker Daemon started (poll interval: {self.poll_interval}s)")

        while self.running:
            try:
                job_result = self.claim_and_dispatch_next_job()
                if job_result:
                    logger.info(f"Dispatched outbox notification: {job_result['id']} -> {job_result['status']}")
                    # If work was done, check immediately for subsequent queued notifications
                    time.sleep(0.1)
                else:
                    # Idle sleep when queue is empty
                    time.sleep(self.poll_interval)
            except Exception as exc:
                logger.error(f"Error in outbox worker main loop: {exc}", exc_info=True)
                time.sleep(self.poll_interval)

        logger.info("EducationOS Outbox Worker Daemon stopped gracefully.")


if __name__ == "__main__":
    daemon = OutboxWorkerDaemon()
    daemon.start()

