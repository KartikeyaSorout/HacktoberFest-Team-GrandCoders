/**
 * GitHub Live Sync Service
 * 
 * Handles connecting GitHub accounts, syncing live PRs (Merged, In Review, Pushed, Working On),
 * caching state in localStorage, and broadcasting real-time updates across components.
 */

const STORAGE_KEYS = {
  USER: 'hf_connected_user',
  TOKEN: 'hf_github_token',
  PRS: 'hf_user_prs',
  STATS: 'hf_user_stats',
  LAST_SYNCED: 'hf_last_synced',
};

export const SYNC_EVENT_NAME = 'hf_account_synced';

/**
 * Format ISO date string into readable date (e.g. "Oct 09, 2026")
 */
export function formatDate(isoString) {
  if (!isoString) return 'Recent';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}

/**
 * Get human-readable relative time string (e.g. "Just now", "5m ago")
 */
export function getTimeAgo(timestamp) {
  if (!timestamp) return 'Never';
  try {
    const now = Date.now();
    const past = new Date(timestamp).getTime();
    const diffSec = Math.floor((now - past) / 1000);

    if (diffSec < 30) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h ago`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay}d ago`;
  } catch {
    return 'Recent';
  }
}

/**
 * Retrieve the currently connected account and PR state from localStorage.
 */
export function getStoredAccount() {
  if (typeof window === 'undefined') {
    return {
      user: null,
      token: '',
      prs: [],
      stats: null,
      lastSynced: null,
      isConnected: false,
    };
  }

  try {
    const userStr = localStorage.getItem(STORAGE_KEYS.USER);
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN) || '';
    const prsStr = localStorage.getItem(STORAGE_KEYS.PRS);
    const statsStr = localStorage.getItem(STORAGE_KEYS.STATS);
    const lastSynced = localStorage.getItem(STORAGE_KEYS.LAST_SYNCED);

    const user = userStr ? JSON.parse(userStr) : null;
    const prs = prsStr ? JSON.parse(prsStr) : [];
    const stats = statsStr ? JSON.parse(statsStr) : null;

    return {
      user,
      token,
      prs: Array.isArray(prs) ? prs : [],
      stats,
      lastSynced: lastSynced ? parseInt(lastSynced, 10) : null,
      isConnected: Boolean(user && user.login),
    };
  } catch (err) {
    console.error('Failed to read stored GitHub account:', err);
    return {
      user: null,
      token: '',
      prs: [],
      stats: null,
      lastSynced: null,
      isConnected: false,
    };
  }
}

/**
 * Save account, PRs, and stats to localStorage, and broadcast update event.
 */
export function saveStoredAccount({ user, token, prs, stats, lastSynced = Date.now() }) {
  if (typeof window === 'undefined') return;

  try {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    }
    if (token !== undefined) {
      if (token) {
        localStorage.setItem(STORAGE_KEYS.TOKEN, token);
      } else {
        localStorage.removeItem(STORAGE_KEYS.TOKEN);
      }
    }
    if (Array.isArray(prs)) {
      localStorage.setItem(STORAGE_KEYS.PRS, JSON.stringify(prs));
    }
    if (stats) {
      localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
    }
    localStorage.setItem(STORAGE_KEYS.LAST_SYNCED, String(lastSynced));

    // Broadcast across windows/tabs and component trees
    window.dispatchEvent(
      new CustomEvent(SYNC_EVENT_NAME, {
        detail: { user, token, prs, stats, lastSynced, isConnected: Boolean(user?.login) },
      })
    );
  } catch (err) {
    console.error('Failed to save GitHub account to localStorage:', err);
  }
}

/**
 * Disconnect the current account and clear stored data.
 */
export function clearStoredAccount() {
  if (typeof window === 'undefined') return;

  localStorage.removeItem(STORAGE_KEYS.USER);
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  localStorage.removeItem(STORAGE_KEYS.PRS);
  localStorage.removeItem(STORAGE_KEYS.STATS);
  localStorage.removeItem(STORAGE_KEYS.LAST_SYNCED);

  window.dispatchEvent(
    new CustomEvent(SYNC_EVENT_NAME, {
      detail: { user: null, token: '', prs: [], stats: null, lastSynced: null, isConnected: false },
    })
  );
}

/**
 * Helper to fetch from backend across relative, local, and env endpoints with timeout.
 */
async function tryFetchBackend(endpoint, params = {}) {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      query.set(k, String(v));
    }
  }
  const queryStr = query.toString();
  const path = `${endpoint}${queryStr ? `?${queryStr}` : ''}`;

  const envBase = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');
  const candidates = [
    path,
    `http://127.0.0.1:8000${path}`,
    `http://localhost:8000${path}`,
    envBase ? `${envBase}${path}` : null,
  ].filter(Boolean);

  for (const url of candidates) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // Continue to next candidate
    }
  }
  return null;
}

/**
 * Fetch GitHub user profile.
 */
export async function fetchUserProfile(username, token = '') {
  const cleanUsername = username.trim().replace(/^@/, '');
  if (!cleanUsername) throw new Error('Username is required');

  // Try local or configured backend first (uses backend GITHUB_TOKEN with 5,000 req/hr)
  const backendData = await tryFetchBackend('/api/user/profile', {
    username: cleanUsername,
    token,
  });
  if (backendData && backendData.login) {
    return backendData;
  }

  // Direct GitHub API fallback
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'HacktoberfestCopilot/1.0',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const ghRes = await fetch(`https://api.github.com/users/${encodeURIComponent(cleanUsername)}`, {
    headers,
  });

  if (!ghRes.ok) {
    if (ghRes.status === 404) throw new Error(`GitHub user "${cleanUsername}" not found`);
    if (ghRes.status === 403) throw new Error('GitHub rate limit reached. Add a Personal Access Token to continue.');
    throw new Error(`Failed to fetch GitHub profile (${ghRes.status})`);
  }

  const data = await ghRes.json();
  return {
    login: data.login,
    name: data.name || data.login,
    avatar_url: data.avatar_url,
    bio: data.bio || '',
    html_url: data.html_url,
    public_repos: data.public_repos || 0,
    followers: data.followers || 0,
  };
}

/**
 * Categorize a PR item into live status and pill style.
 */
export function categorizePr(item, detail = {}) {
  const isMerged = Boolean(item.pull_request?.merged_at || detail.merged || detail.merged_at);
  const isDraft = Boolean(item.draft || detail.draft);
  const state = item.state || detail.state || 'open';
  const hasRequestedReviewers = Array.isArray(detail.requested_reviewers) && detail.requested_reviewers.length > 0;
  const hasReviews = Array.isArray(detail.reviews) && detail.reviews.length > 0;

  let status = 'PUSHED';
  let statusLabel = 'Pushed';
  let badgeClass = 'tag--tech';
  let bgPill = '#EFF6FF';
  let colorPill = '#1E40AF';

  if (isMerged) {
    status = 'MERGED';
    statusLabel = 'Merged';
    badgeClass = 'tag--beginner';
    bgPill = '#D1FAE5';
    colorPill = '#065F46';
  } else if (state === 'closed') {
    status = 'CLOSED';
    statusLabel = 'Closed';
    badgeClass = 'tag--tech';
    bgPill = '#F3F4F6';
    colorPill = '#4B5563';
  } else if (isDraft) {
    status = 'WORKING_ON';
    statusLabel = 'Working On';
    badgeClass = 'tag--advanced';
    bgPill = '#F3E8FF';
    colorPill = '#6B21A8';
  } else if (hasRequestedReviewers || hasReviews) {
    status = 'IN_REVIEW';
    statusLabel = 'In Review';
    badgeClass = 'tag--intermediate';
    bgPill = '#FEF3C7';
    colorPill = '#92400E';
  } else {
    // Open PR pushed and created
    status = 'PUSHED';
    statusLabel = 'Pushed / Created';
    badgeClass = 'tag--tech';
    bgPill = '#EFF6FF';
    colorPill = '#1E40AF';
  }

  return {
    status,
    statusLabel,
    badgeClass,
    bgPill,
    colorPill,
    isMerged,
    isDraft,
  };
}

/**
 * Fetch and live sync all Pull Requests for a user.
 */
export async function fetchUserPrs(username, token = '') {
  const cleanUsername = username.trim().replace(/^@/, '');
  if (!cleanUsername) throw new Error('Username is required');

  // Try local or configured backend first (uses backend GITHUB_TOKEN with 5,000 req/hr)
  const backendData = await tryFetchBackend('/api/user/prs', {
    username: cleanUsername,
    token,
  });
  if (backendData && Array.isArray(backendData.prs)) {
    return backendData;
  }

  // Fallback: Direct GitHub Search API
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'HacktoberfestCopilot/1.0',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const searchUrl = `https://api.github.com/search/issues?q=author:${encodeURIComponent(
    cleanUsername
  )}+type:pr&sort=updated&order=desc&per_page=50`;

  const response = await fetch(searchUrl, { headers });
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('GitHub API rate limit exceeded. Provide a personal access token for higher limits.');
    }
    throw new Error(`Failed to fetch PRs from GitHub (${response.status})`);
  }

  const data = await response.json();
  const rawItems = data.items || [];

  const prs = rawItems.map((item) => {
    const repoUrl = item.repository_url || '';
    const repoParts = repoUrl.split('/');
    const repoName = repoParts.length >= 2 ? `${repoParts[repoParts.length - 2]}/${repoParts[repoParts.length - 1]}` : 'repository';

    const cat = categorizePr(item);

    return {
      id: `PR-${item.number}`,
      number: item.number,
      repo: repoName,
      title: item.title,
      status: cat.status,
      statusLabel: cat.statusLabel,
      badgeClass: cat.badgeClass,
      bgPill: cat.bgPill,
      colorPill: cat.colorPill,
      date: formatDate(item.created_at),
      updatedDate: formatDate(item.updated_at),
      created_at: item.created_at,
      updated_at: item.updated_at,
      html_url: item.html_url,
      isMerged: cat.isMerged,
      isDraft: cat.isDraft,
      comments: item.comments || 0,
      labels: (item.labels || []).map((l) => (typeof l === 'string' ? l : l.name)),
    };
  });

  const mergedCount = prs.filter((p) => p.status === 'MERGED').length;
  const inReviewCount = prs.filter((p) => p.status === 'IN_REVIEW').length;
  const pushedCount = prs.filter((p) => p.status === 'PUSHED').length;
  const workingOnCount = prs.filter((p) => p.status === 'WORKING_ON').length;
  const closedCount = prs.filter((p) => p.status === 'CLOSED').length;

  const stats = {
    total_prs: prs.length,
    merged_count: mergedCount,
    in_review_count: inReviewCount,
    pushed_count: pushedCount,
    working_on_count: workingOnCount,
    closed_count: closedCount,
    target: 4,
    progress: Math.min(mergedCount / 4, 1),
    milestone_reached: mergedCount >= 4,
  };

  return {
    username: cleanUsername,
    prs,
    stats,
  };
}

/**
 * Complete connect and live sync action.
 */
export async function syncAccount(username, token = '') {
  const profile = await fetchUserProfile(username, token);
  const prsData = await fetchUserPrs(username, token);

  const payload = {
    user: profile,
    token: token || '',
    prs: prsData.prs,
    stats: prsData.stats,
    lastSynced: Date.now(),
  };

  saveStoredAccount(payload);
  return payload;
}
