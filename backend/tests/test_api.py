"""
Unit and integration tests for Hacktoberfest Copilot FastAPI backend.
"""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check_endpoint():
    """Verify that the health check endpoint returns 200, healthy status, uptime, and cache stats."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data.get("status") == "healthy"
    assert data.get("service") == "hacktoberfest-copilot-api"
    assert "version" in data
    assert "uptime_seconds" in data
    assert "cache" in data
    assert "active_entries" in data["cache"]


def test_root_endpoint():
    """Verify root endpoint returns welcome banner and documentation links."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "🎃 Hacktoberfest Copilot API" in data.get("message", "")
    assert "/docs" in data.get("docs", "")
    assert "/api/health" in data.get("health", "")


def test_not_found_endpoint():
    """Verify 404 response for unknown routes."""
    response = client.get("/api/unknown-route-12345")
    assert response.status_code == 404


def test_analyze_repo_invalid_payload():
    """Verify 422 Unprocessable Entity when request body is missing required fields."""
    response = client.post("/api/analyze-repo", json={})
    assert response.status_code == 422


def test_suggest_tests_invalid_payload():
    """Verify 422 Unprocessable Entity when suggest-tests payload is invalid."""
    response = client.post("/api/suggest-tests", json={})
    assert response.status_code == 422


def test_generate_pr_invalid_payload():
    """Verify 422 Unprocessable Entity when generate-pr payload is invalid."""
    response = client.post("/api/generate-pr", json={})
    assert response.status_code == 422


def test_suggest_tests_invalid_url():
    """Verify error status when repository URL is malformed."""
    response = client.post(
        "/api/suggest-tests",
        json={"repo_url": "invalid-url", "issue_number": 1, "plan": "test plan"},
    )
    assert response.status_code in [400, 404, 500, 502]


def test_generate_pr_invalid_url():
    """Verify error status when repository URL is malformed."""
    response = client.post(
        "/api/generate-pr",
        json={"repo_url": "invalid-url", "issue_number": 1, "changes_summary": "test"},
    )
    assert response.status_code in [400, 404, 500, 502]


def test_explain_issue_invalid_payload():
    """Verify 422 Unprocessable Entity when explain-issue payload is invalid."""
    response = client.post("/api/explain-issue", json={})
    assert response.status_code == 422


def test_explain_issue_invalid_url():
    """Verify error status when explain-issue URL is malformed."""
    response = client.post(
        "/api/explain-issue",
        json={"repo_url": "invalid-url", "issue_number": 1},
    )
    assert response.status_code in [400, 404, 500, 502]


def test_generate_plan_invalid_payload():
    """Verify 422 Unprocessable Entity when generate-plan payload is invalid."""
    response = client.post("/api/generate-plan", json={})
    assert response.status_code == 422


def test_generate_plan_invalid_url():
    """Verify error status when generate-plan URL is malformed."""
    response = client.post(
        "/api/generate-plan",
        json={"repo_url": "invalid-url", "issue_number": 1},
    )
    assert response.status_code in [400, 404, 500, 502]


def test_ttl_cache_lifecycle():
    """Verify SimpleTTLCache set, get, expiration, and clear operations."""
    import time
    from app.services.github_client import SimpleTTLCache

    cache = SimpleTTLCache(ttl_seconds=1)
    cache.set("key1", "value1")
    assert cache.get("key1") == "value1"
    assert cache.size() == 1

    # Test custom ttl expiration
    cache.set("short", "expire_fast", ttl=0)
    time.sleep(0.01)
    assert cache.get("short") is None

    cache.clear()
    assert cache.size() == 0
    assert cache.get("key1") is None


def test_ai_service_threadpool_execution(monkeypatch):
    """Ensure ai_service._generate delegates content generation without blocking the event loop."""
    import asyncio
    from unittest.mock import MagicMock
    from app.services.ai_service import ai_service

    monkeypatch.setenv("GOOGLE_API_KEY", "fake_test_key")
    mock_model = MagicMock()
    mock_model.generate_content.return_value = MagicMock(text="Mocked AI response")
    monkeypatch.setattr(ai_service, "_get_model", lambda *args, **kwargs: mock_model)

    res = asyncio.run(ai_service._generate("test prompt"))
    assert res == "Mocked AI response"
    mock_model.generate_content.assert_called_once_with("test prompt")


def test_user_profile_missing_username():
    """Verify 422 validation error when username query param is missing."""
    response = client.get("/api/user/profile")
    assert response.status_code == 422


def test_user_prs_missing_username():
    """Verify 422 validation error when username query param is missing."""
    response = client.get("/api/user/prs")
    assert response.status_code == 422


def test_user_profile_mocked(monkeypatch):
    """Verify user profile endpoint with mocked GitHub client response."""
    from app.services.github_client import github_client
    from unittest.mock import AsyncMock

    mock_profile = {
        "login": "octocat",
        "name": "The Octocat",
        "avatar_url": "https://avatars.githubusercontent.com/u/583231",
        "bio": "Building the world's best code.",
        "html_url": "https://github.com/octocat",
        "public_repos": 8,
        "followers": 12000,
    }

    monkeypatch.setattr(github_client, "get_user_profile", AsyncMock(return_value=mock_profile))
    response = client.get("/api/user/profile?username=octocat")
    assert response.status_code == 200
    data = response.json()
    assert data["login"] == "octocat"
    assert data["name"] == "The Octocat"
    assert data["public_repos"] == 8


def test_user_prs_mocked(monkeypatch):
    """Verify user PRs live sync endpoint with categorized statuses and stats."""
    from app.services.github_client import github_client
    from unittest.mock import AsyncMock

    mock_prs_result = {
        "username": "octocat",
        "prs": [
            {
                "id": "PR-101",
                "number": 101,
                "repo": "owner/repo",
                "title": "fix: update header typography",
                "status": "MERGED",
                "status_label": "Merged",
                "badge_class": "tag--beginner",
                "bg_pill": "#D1FAE5",
                "color_pill": "#065F46",
                "date": "Oct 10, 2026",
                "created_at": "2026-10-10T12:00:00Z",
                "updated_at": "2026-10-10T13:00:00Z",
                "html_url": "https://github.com/owner/repo/pull/101",
                "is_merged": True,
                "is_draft": False,
                "comments": 2,
                "labels": ["hacktoberfest-accepted"],
                "requested_reviewers": [],
                "reviews_count": 1,
            },
            {
                "id": "PR-102",
                "number": 102,
                "repo": "owner/repo2",
                "title": "feat: add user live sync",
                "status": "IN_REVIEW",
                "status_label": "In Review",
                "badge_class": "tag--intermediate",
                "bg_pill": "#FEF3C7",
                "color_pill": "#92400E",
                "date": "Oct 12, 2026",
                "created_at": "2026-10-12T12:00:00Z",
                "updated_at": "2026-10-12T13:00:00Z",
                "html_url": "https://github.com/owner/repo2/pull/102",
                "is_merged": False,
                "is_draft": False,
                "comments": 0,
                "labels": ["enhancement"],
                "requested_reviewers": ["reviewer1"],
                "reviews_count": 0,
            },
        ],
        "stats": {
            "total_prs": 2,
            "merged_count": 1,
            "in_review_count": 1,
            "pushed_count": 0,
            "working_on_count": 0,
            "closed_count": 0,
            "target": 4,
            "progress": 0.25,
            "milestone_reached": False,
        },
    }

    monkeypatch.setattr(github_client, "get_user_prs", AsyncMock(return_value=mock_prs_result))
    response = client.get("/api/user/prs?username=octocat")
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "octocat"
    assert len(data["prs"]) == 2
    assert data["prs"][0]["status"] == "MERGED"
    assert data["prs"][1]["status"] == "IN_REVIEW"
    assert data["stats"]["merged_count"] == 1
    assert data["stats"]["in_review_count"] == 1


