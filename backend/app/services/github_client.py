"""
GitHub API Client Service

Handles all communication with the GitHub REST API v3.
Fetches repository metadata, file trees, issues, README, and more.
"""

import re
import time
import base64
from datetime import datetime
import httpx
from typing import Any, Optional

from app.config import settings


class SimpleTTLCache:
    """In-memory cache with Time-To-Live (TTL) expiration."""

    def __init__(self, ttl_seconds: int = 3600):
        self.ttl = ttl_seconds
        self._cache: dict[str, tuple[float, Any]] = {}

    def get(self, key: str) -> Optional[Any]:
        if key in self._cache:
            expires_at, value = self._cache[key]
            if time.time() < expires_at:
                return value
            del self._cache[key]
        return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        duration = ttl if ttl is not None else self.ttl
        self._cache[key] = (time.time() + duration, value)

    def clear(self) -> None:
        self._cache.clear()

    def size(self) -> int:
        now = time.time()
        expired = [k for k, (exp, _) in self._cache.items() if exp <= now]
        for k in expired:
            del self._cache[k]
        return len(self._cache)


class GitHubClient:
    """Client for interacting with the GitHub REST API."""

    def __init__(self):
        self.base_url = settings.github_api_base
        self.headers = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "HacktoberfestCopilot/1.0",
        }
        if settings.github_token:
            self.headers["Authorization"] = f"Bearer {settings.github_token}"
        self.cache = SimpleTTLCache(ttl_seconds=settings.cache_ttl_seconds)

    def _parse_repo_url(self, repo_url: str) -> tuple[str, str]:
        """
        Extract owner and repo name from a GitHub URL.

        Supports formats:
        - https://github.com/owner/repo
        - https://github.com/owner/repo.git
        - github.com/owner/repo
        - owner/repo
        """
        # Remove trailing slashes and .git
        repo_url = repo_url.rstrip("/").removesuffix(".git")

        # Try full URL pattern
        match = re.search(r"github\.com/([^/]+)/([^/]+)", repo_url)
        if match:
            return match.group(1), match.group(2)

        # Try owner/repo pattern
        parts = repo_url.split("/")
        if len(parts) == 2:
            return parts[0], parts[1]

        raise ValueError(
            f"Invalid GitHub URL: {repo_url}. "
            "Expected format: https://github.com/owner/repo"
        )

    async def _get(self, endpoint: str, params: dict | None = None, use_cache: bool = True) -> Any:
        """Make a GET request to the GitHub API with caching support."""
        cache_key = f"{endpoint}:{str(sorted(params.items())) if params else ''}"
        if use_cache:
            cached_data = self.cache.get(cache_key)
            if cached_data is not None:
                return cached_data

        url = f"{self.base_url}{endpoint}"
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(url, headers=self.headers, params=params)
            response.raise_for_status()
            data = response.json()
            if use_cache:
                self.cache.set(cache_key, data)
            return data

    def get_cache_stats(self) -> dict:
        """Return cache health and utilization statistics."""
        return {
            "active_entries": self.cache.size(),
            "ttl_seconds": self.cache.ttl,
        }

    async def get_repo(self, repo_url: str) -> dict:
        """Fetch repository metadata."""
        owner, repo = self._parse_repo_url(repo_url)
        data = await self._get(f"/repos/{owner}/{repo}")
        return {
            "name": data.get("name", ""),
            "full_name": data.get("full_name", ""),
            "description": data.get("description"),
            "language": data.get("language"),
            "stars": data.get("stargazers_count", 0),
            "forks": data.get("forks_count", 0),
            "open_issues_count": data.get("open_issues_count", 0),
            "topics": data.get("topics", []),
            "html_url": data.get("html_url", ""),
            "default_branch": data.get("default_branch", "main"),
        }

    async def get_file_tree(self, repo_url: str) -> list[dict]:
        """Fetch the repository file tree (recursive)."""
        owner, repo = self._parse_repo_url(repo_url)
        try:
            data = await self._get(
                f"/repos/{owner}/{repo}/git/trees/HEAD",
                params={"recursive": "1"},
            )
            tree = data.get("tree", [])
            return [
                {
                    "path": item["path"],
                    "type": "dir" if item["type"] == "tree" else "file",
                    "size": item.get("size", 0),
                }
                for item in tree[:500]  # Limit to 500 items
            ]
        except httpx.HTTPStatusError:
            return []

    async def get_readme(self, repo_url: str) -> str:
        """Fetch and decode the repository README."""
        owner, repo = self._parse_repo_url(repo_url)
        try:
            data = await self._get(f"/repos/{owner}/{repo}/readme")
            content = data.get("content", "")
            encoding = data.get("encoding", "base64")
            if encoding == "base64" and content:
                return base64.b64decode(content).decode("utf-8", errors="replace")
            return content
        except httpx.HTTPStatusError:
            return ""

    async def get_contributing(self, repo_url: str) -> str:
        """Fetch the CONTRIBUTING.md file content if it exists."""
        owner, repo = self._parse_repo_url(repo_url)
        try:
            data = await self._get(
                f"/repos/{owner}/{repo}/contents/CONTRIBUTING.md"
            )
            content = data.get("content", "")
            encoding = data.get("encoding", "base64")
            if encoding == "base64" and content:
                return base64.b64decode(content).decode("utf-8", errors="replace")
            return content
        except httpx.HTTPStatusError:
            return ""

    async def get_issues(
        self,
        repo_url: str,
        labels: str = "",
        state: str = "open",
        per_page: int = 100,
        max_pages: int = 1,
    ) -> list[dict]:
        """Fetch issues from the repository with optional parallel pagination."""
        owner, repo = self._parse_repo_url(repo_url)

        async def _fetch_page(page_num: int) -> list[dict]:
            params = {"state": state, "per_page": per_page, "page": page_num}
            if labels:
                params["labels"] = labels
            try:
                data = await self._get(f"/repos/{owner}/{repo}/issues", params=params)
                return [
                    {
                        "number": issue["number"],
                        "title": issue["title"],
                        "body": issue.get("body", ""),
                        "labels": [label["name"] for label in issue.get("labels", [])],
                        "state": issue["state"],
                        "html_url": issue["html_url"],
                        "created_at": issue.get("created_at", ""),
                        "user": issue.get("user", {}).get("login", ""),
                        "comments": issue.get("comments", 0),
                    }
                    for issue in data
                    if "pull_request" not in issue  # Filter out PRs
                ]
            except (httpx.HTTPStatusError, httpx.RequestError):
                return []

        if max_pages <= 1:
            return await _fetch_page(1)

        import asyncio
        tasks = [_fetch_page(p) for p in range(1, max_pages + 1)]
        results = await asyncio.gather(*tasks)

        all_issues = []
        seen = set()
        for page_data in results:
            for issue in page_data:
                if issue["number"] not in seen:
                    seen.add(issue["number"])
                    all_issues.append(issue)
        return all_issues

    async def get_beginner_issues(self, repo_url: str) -> list[dict]:
        """
        Fetch beginner-friendly issues.
        Searches for common beginner labels.
        """
        beginner_labels = [
            "good first issue",
            "help wanted",
            "beginner",
            "easy",
            "starter",
            "first-timers-only",
            "good-first-issue",
        ]

        all_issues = []
        seen_numbers = set()

        import asyncio
        tasks = [self.get_issues(repo_url, labels=label) for label in beginner_labels]
        results = await asyncio.gather(*tasks)

        for issues in results:
            for issue in issues:
                if issue["number"] not in seen_numbers:
                    seen_numbers.add(issue["number"])
                    all_issues.append(issue)

        return all_issues

    async def get_issue(self, repo_url: str, issue_number: int) -> dict:
        """Fetch a single issue by number."""
        owner, repo = self._parse_repo_url(repo_url)
        data = await self._get(f"/repos/{owner}/{repo}/issues/{issue_number}")
        return {
            "number": data["number"],
            "title": data["title"],
            "body": data.get("body", ""),
            "labels": [label["name"] for label in data.get("labels", [])],
            "state": data["state"],
            "html_url": data["html_url"],
            "created_at": data.get("created_at", ""),
            "user": data.get("user", {}).get("login", ""),
            "comments": data.get("comments", 0),
        }

    async def get_file_content(self, repo_url: str, file_path: str) -> str:
        """Fetch the content of a specific file from the repository."""
        owner, repo = self._parse_repo_url(repo_url)
        try:
            data = await self._get(
                f"/repos/{owner}/{repo}/contents/{file_path}"
            )
            content = data.get("content", "")
            encoding = data.get("encoding", "base64")
            if encoding == "base64" and content:
                return base64.b64decode(content).decode("utf-8", errors="replace")
            return content
        except httpx.HTTPStatusError:
            return ""

    async def get_user_profile(self, username: str, token: Optional[str] = None) -> dict:
        """Fetch a GitHub user's public profile."""
        username = username.strip().lstrip("@")
        headers = dict(self.headers)
        if token:
            headers["Authorization"] = f"Bearer {token}"

        url = f"{self.base_url}/users/{username}"
        cache_key = f"user_profile:{username}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            resp = await client.get(url, headers=headers)
            if resp.status_code == 404:
                raise ValueError(f"GitHub user '{username}' was not found.")
            resp.raise_for_status()
            data = resp.json()

            profile = {
                "login": data.get("login", username),
                "name": data.get("name") or data.get("login", username),
                "avatar_url": data.get("avatar_url", ""),
                "bio": data.get("bio") or "",
                "html_url": data.get("html_url", f"https://github.com/{username}"),
                "public_repos": data.get("public_repos", 0),
                "followers": data.get("followers", 0),
            }
            self.cache.set(cache_key, profile, ttl=300)  # 5 min cache
            return profile

    async def get_user_prs(self, username: str, token: Optional[str] = None) -> dict:
        """Fetch and categorize all pull requests for a specific GitHub user."""
        username = username.strip().lstrip("@")
        headers = dict(self.headers)
        if token:
            headers["Authorization"] = f"Bearer {token}"

        cache_key = f"user_prs:{username}"
        cached = self.cache.get(cache_key)
        if cached:
            return cached

        search_url = f"{self.base_url}/search/issues"
        params = {
            "q": f"author:{username} type:pr",
            "sort": "updated",
            "order": "desc",
            "per_page": 50,
        }

        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            resp = await client.get(search_url, headers=headers, params=params)
            if resp.status_code == 403:
                raise ValueError("GitHub rate limit exceeded. Please provide a personal access token.")
            resp.raise_for_status()
            search_data = resp.json()

            items = search_data.get("items", [])
            prs = []

            for item in items:
                repo_url = item.get("repository_url", "")
                repo_parts = repo_url.split("/")
                repo_name = f"{repo_parts[-2]}/{repo_parts[-1]}" if len(repo_parts) >= 2 else "repository"
                number = item.get("number")

                pr_meta = item.get("pull_request", {})
                is_merged = pr_meta.get("merged_at") is not None
                is_draft = item.get("draft", False)
                state = item.get("state", "open")

                # Try to fetch additional PR details for draft, reviews, and requested reviewers
                requested_reviewers = []
                reviews_count = 0
                if state == "open" and not is_merged:
                    try:
                        pull_resp = await client.get(f"{self.base_url}/repos/{repo_name}/pulls/{number}", headers=headers)
                        if pull_resp.status_code == 200:
                            pull_data = pull_resp.json()
                            is_draft = pull_data.get("draft", is_draft)
                            is_merged = pull_data.get("merged", is_merged)
                            req_revs = pull_data.get("requested_reviewers", [])
                            requested_reviewers = [r.get("login") for r in req_revs if isinstance(r, dict)]

                            # Check reviews
                            rev_resp = await client.get(f"{self.base_url}/repos/{repo_name}/pulls/{number}/reviews", headers=headers)
                            if rev_resp.status_code == 200:
                                reviews_count = len(rev_resp.json())
                    except Exception:
                        pass

                # Categorize Status: MERGED, IN_REVIEW, PUSHED, WORKING_ON, CLOSED
                if is_merged:
                    status = "MERGED"
                    status_label = "Merged"
                    badge_class = "tag--beginner"
                    bg_pill = "#D1FAE5"
                    color_pill = "#065F46"
                elif state == "closed":
                    status = "CLOSED"
                    status_label = "Closed"
                    badge_class = "tag--tech"
                    bg_pill = "#F3F4F6"
                    color_pill = "#4B5563"
                elif is_draft:
                    status = "WORKING_ON"
                    status_label = "Working On"
                    badge_class = "tag--advanced"
                    bg_pill = "#F3E8FF"
                    color_pill = "#6B21A8"
                elif requested_reviewers or reviews_count > 0:
                    status = "IN_REVIEW"
                    status_label = "In Review"
                    badge_class = "tag--intermediate"
                    bg_pill = "#FEF3C7"
                    color_pill = "#92400E"
                else:
                    status = "PUSHED"
                    status_label = "Pushed / Created"
                    badge_class = "tag--tech"
                    bg_pill = "#EFF6FF"
                    color_pill = "#1E40AF"

                # Parse created_at and updated_at
                created_raw = item.get("created_at", "")
                date_str = "Recent"
                if created_raw:
                    try:
                        dt = datetime.fromisoformat(created_raw.replace("Z", "+00:00"))
                        date_str = dt.strftime("%b %d, %Y")
                    except Exception:
                        date_str = created_raw[:10]

                prs.append({
                    "id": f"PR-{number}",
                    "number": number,
                    "repo": repo_name,
                    "title": item.get("title", ""),
                    "status": status,
                    "status_label": status_label,
                    "badge_class": badge_class,
                    "bg_pill": bg_pill,
                    "color_pill": color_pill,
                    "date": date_str,
                    "created_at": created_raw,
                    "updated_at": item.get("updated_at", ""),
                    "html_url": item.get("html_url", ""),
                    "is_merged": is_merged,
                    "is_draft": is_draft,
                    "comments": item.get("comments", 0),
                    "labels": [l.get("name") if isinstance(l, dict) else str(l) for l in item.get("labels", [])],
                    "requested_reviewers": requested_reviewers,
                    "reviews_count": reviews_count,
                })

            merged_count = sum(1 for p in prs if p["status"] == "MERGED")
            in_review_count = sum(1 for p in prs if p["status"] == "IN_REVIEW")
            pushed_count = sum(1 for p in prs if p["status"] == "PUSHED")
            working_on_count = sum(1 for p in prs if p["status"] == "WORKING_ON")
            closed_count = sum(1 for p in prs if p["status"] == "CLOSED")

            stats = {
                "total_prs": len(prs),
                "merged_count": merged_count,
                "in_review_count": in_review_count,
                "pushed_count": pushed_count,
                "working_on_count": working_on_count,
                "closed_count": closed_count,
                "target": 4,
                "progress": min(merged_count / 4.0, 1.0),
                "milestone_reached": merged_count >= 4,
            }

            result = {
                "username": username,
                "prs": prs,
                "stats": stats,
            }
            self.cache.set(cache_key, result, ttl=180)  # 3 min cache
            return result


# Singleton instance
github_client = GitHubClient()
