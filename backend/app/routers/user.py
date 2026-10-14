"""
User profile and Pull Request Live Sync Router.

Endpoints:
- GET /api/user/profile: Fetch GitHub public profile for connected user.
- GET /api/user/prs: Live sync and categorize user's PRs (Merged, In Review, Pushed, Working On).
"""

from typing import Optional
from fastapi import APIRouter, Query, HTTPException

from app.models.schemas import UserProfileResponse, UserPRsResponse
from app.exceptions import AppException, ResourceNotFoundError, RateLimitError
from app.services.github_client import github_client

router = APIRouter()


@router.get("/user/profile", response_model=UserProfileResponse)
async def get_user_profile(
    username: str = Query(..., description="GitHub username to fetch"),
    token: Optional[str] = Query(None, description="Optional personal access token for authenticated requests"),
):
    """Fetch GitHub user profile info."""
    try:
        profile = await github_client.get_user_profile(username=username, token=token)
        return UserProfileResponse(**profile)
    except ValueError as e:
        raise ResourceNotFoundError(str(e))
    except Exception as e:
        raise AppException(
            message=f"Failed to fetch profile for user '{username}': {str(e)}",
            status_code=500,
            error_code="USER_PROFILE_ERROR",
        )


@router.get("/user/prs", response_model=UserPRsResponse)
async def get_user_prs(
    username: str = Query(..., description="GitHub username to inspect"),
    token: Optional[str] = Query(None, description="Optional personal access token for higher rate limits"),
):
    """
    Live sync and categorize all pull requests for a GitHub user.
    Statuses include: MERGED, IN_REVIEW, PUSHED, WORKING_ON, and CLOSED.
    """
    try:
        result = await github_client.get_user_prs(username=username, token=token)
        return UserPRsResponse(**result)
    except ValueError as e:
        if "rate limit" in str(e).lower():
            raise RateLimitError(str(e))
        raise ResourceNotFoundError(str(e))
    except AppException:
        raise
    except Exception as e:
        raise AppException(
            message=f"Failed to sync pull requests for user '{username}': {str(e)}",
            status_code=500,
            error_code="USER_PRS_SYNC_ERROR",
        )
