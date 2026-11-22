# backend/tests/test_stage01_startup.py
"""
High-Assurance Test Suite for Stage 01: Startup & Import Stability Reconstruction
Verifies deterministic application bootstrapping, lifespan context, workspace router
registration, AI client decoupling, and offline resilience.
"""
import pytest
import asyncio
from unittest.mock import patch, MagicMock
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import app, lifespan
from app.core.config import settings
from app.core.ai_client import get_genai_client, ai_client, _AIClientProxy
from app.models.workspace import (
    Workspace,
    WorkspaceMembership,
    InstitutionalMembership,
    Organization,
    WorkspaceType
)


def test_app_imported_without_live_database():
    """Verify application module imports safely without active database connectivity."""
    assert isinstance(app, FastAPI)
    assert app.title == settings.PROJECT_NAME


def test_fastapi_lifespan_registered():
    """Verify the lifespan context manager is active on the FastAPI router."""
    assert app.router.lifespan_context is not None


def test_lifespan_startup_and_shutdown_degraded_mode():
    """Verify lifespan startup executes gracefully even if database is offline in non-production."""
    async def _test():
        test_app = FastAPI(lifespan=lifespan)
        with patch("app.main.engine.connect", side_effect=Exception("Database offline in test")), \
             patch("time.sleep", return_value=None):
            async with test_app.router.lifespan_context(test_app):
                assert True

    asyncio.run(_test())


def test_lifespan_startup_database_success():
    """Verify lifespan startup executes successfully when database connection succeeds."""
    async def _test():
        test_app = FastAPI(lifespan=lifespan)
        mock_conn = MagicMock()
        mock_connect = MagicMock()
        mock_connect.__enter__.return_value = mock_conn

        with patch("app.main.engine.connect", return_value=mock_connect):
            async with test_app.router.lifespan_context(test_app):
                assert mock_conn.execute.called

    asyncio.run(_test())


def test_missing_ai_credentials_graceful_handling():
    """Verify AI client does not crash on missing credentials and raises informative errors."""
    with patch("os.getenv", return_value=""), \
         patch.object(settings, "GEMINI_API_KEY", None), \
         patch.object(settings, "GOOGLE_API_KEY", None):
        
        # Reset cached client state
        import app.core.ai_client as ai_module
        ai_module._client_initialized = False
        ai_module._cached_client = None

        client = get_genai_client()
        assert client is None
        assert bool(ai_client) is False

        # Attempting invocation raises controlled AttributeError
        with pytest.raises(AttributeError, match="Gemini AI features are unavailable"):
            _ = ai_client.chats.create(model="gemini-1.5-flash")


def test_workspace_models_import_and_aliasing():
    """Verify Workspace models, relationships, and backward-compatible aliases."""
    # InstitutionalMembership must be an alias of WorkspaceMembership
    assert InstitutionalMembership is WorkspaceMembership

    # Workspace instantiation with new and existing fields
    ws = Workspace(
        tenant_id="test-tenant-123",
        workspace_type=WorkspaceType.SCHOOL,
        name="Test International School",
        code="SCH-TEST",
        enabled_modules=["attendance", "finance"]
    )
    assert ws.tenant_id == "test-tenant-123"
    assert ws.name == "Test International School"
    assert ws.code == "SCH-TEST"

    # WorkspaceMembership instantiation
    membership = WorkspaceMembership(
        user_id="user-456",
        workspace_id=ws.id,
        role="teacher"
    )
    assert membership.user_id == "user-456"
    assert membership.role == "teacher"


def test_required_routers_mounted():
    """Verify all 28 expected router prefixes are registered on the application."""
    expected_prefixes = {
        "/api/v1/auth",
        "/api/v1/tenants",
        "/api/v1/users",
        "/api/v1/academic",
        "/api/v1/students",
        "/api/v1/guardians",
        "/api/v1/teachers",
        "/api/v1/attendance",
        "/api/v1/exams",
        "/api/v1/ai",
        "/api/v1/audit",
        "/api/v1/approvals",
        "/api/v1/communication",
        "/api/v1/government",
        "/api/v1/analytics",
        "/api/v1/dashboard",
        "/api/v1/question-papers",
        "/api/v1/notices",
        "/api/v1/results",
        "/api/v1/institution",
        "/api/v1/finance",
        "/api/v1/teacher-os",
        "/api/v1/learning-os",
        "/api/v1/academy",
        "/api/v1/campus",
        "/api/v1/notifications",
        "/api/v1/billing",
        "/api/v1/workspaces"
    }

    mounted_prefixes = set()
    for route in app.routes:
        if type(route).__name__ == "_IncludedRouter":
            mounted_prefixes.add(route.include_context.prefix)

    missing = expected_prefixes - mounted_prefixes
    assert not missing, f"Missing required router prefixes: {missing}"


def test_workspaces_router_has_routes():
    """Verify the workspaces router has active routes mounted."""
    workspace_router = None
    for route in app.routes:
        if type(route).__name__ == "_IncludedRouter" and route.include_context.prefix == "/api/v1/workspaces":
            workspace_router = route.original_router
            break

    assert workspace_router is not None, "Workspaces router was not found on app"
    route_paths = [r.path for r in workspace_router.routes]
    assert "/my-workspaces" in route_paths or "" in route_paths
    assert "/current" in route_paths
    assert "/switch" in route_paths


def test_root_and_health_endpoints():
    """Verify fundamental health check endpoints without database dependencies."""
    client = TestClient(app, raise_server_exceptions=False)
    
    # Root endpoint
    res_root = client.get("/")
    assert res_root.status_code == 200
    data = res_root.json()
    assert data["status"] == "online"

    # Healthz endpoint
    res_healthz = client.get("/healthz")
    assert res_healthz.status_code == 200
    data_healthz = res_healthz.json()
    assert data_healthz["status"] == "online"
    assert data_healthz["service"] == "EducationOS Core API"
