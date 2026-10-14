'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getStoredAccount, SYNC_EVENT_NAME } from '../services/githubSync';

export default function PrTrackerWidget({ onOpenPrModal }) {
  const [account, setAccount] = useState({
    user: null,
    prs: [],
    stats: null,
    isConnected: false,
  });

  useEffect(() => {
    const stored = getStoredAccount();
    setAccount(stored);

    const handleSync = (e) => {
      if (e.detail) {
        setAccount(e.detail);
      }
    };

    window.addEventListener(SYNC_EVENT_NAME, handleSync);
    return () => window.removeEventListener(SYNC_EVENT_NAME, handleSync);
  }, []);

  const isConnected = account.isConnected && Boolean(account.user?.login);
  const prsMerged = isConnected && account.stats ? account.stats.merged_count : 2;
  const prsTarget = 4;

  // Calculate gauge dasharray
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = Math.min(prsMerged / prsTarget, 1);
  const strokeDashoffset = circumference - progressRatio * circumference;

  // Real or fallback PR entries (take first 4)
  const defaultEntries = [
    { id: '1024', status: 'merged', statusLabel: 'Merged', repo: 'Brownie-Bliss', title: 'resolve hotlinks' },
    { id: '1018', status: 'merged', statusLabel: 'Merged', repo: 'Brownie-Bliss', title: 'coupon discount logic' },
    { id: '1025', status: 'review', statusLabel: 'In Review', repo: 'Brownie-Bliss', title: 'checkout rounding' },
    { id: '1026', status: 'pending', statusLabel: 'Drafted', repo: 'FastAPI', title: 'async override docs' },
  ];

  const displayEntries = isConnected && account.prs?.length > 0
    ? account.prs.slice(0, 4).map((pr) => {
        let status = 'pending';
        let statusLabel = pr.statusLabel || pr.status;
        if (pr.status === 'MERGED') {
          status = 'merged';
        } else if (pr.status === 'IN_REVIEW') {
          status = 'review';
        } else if (pr.status === 'WORKING_ON') {
          status = 'pending';
        } else if (pr.status === 'PUSHED') {
          status = 'review';
        }

        const repoShort = pr.repo ? pr.repo.split('/')[1] || pr.repo : 'repo';

        return {
          id: String(pr.number || pr.id).replace(/^PR-/, ''),
          status,
          statusLabel,
          repo: repoShort,
          title: pr.title || '',
          url: pr.html_url,
        };
      })
    : defaultEntries;

  return (
    <div className="nb-card nb-pr-tracker" id="pr-tracker">
      <div className="nb-card__header-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 className="nb-card__title" style={{ margin: 0 }}>PR Tracker</h3>
          {isConnected && (
            <span
              style={{
                fontSize: '0.68rem',
                fontFamily: 'var(--font-mono)',
                background: '#D1FAE5',
                color: '#065F46',
                border: '1px solid #065F46',
                padding: '1px 5px',
                borderRadius: '3px',
                fontWeight: 700,
              }}
            >
              @{account.user?.login}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <Link
            href="/tracker"
            className="nb-pill-action-btn"
            title="View complete live PR challenge tracker"
            style={{ textDecoration: 'none', fontSize: '0.78rem', padding: '4px 10px' }}
          >
            Live Feed ↗
          </Link>
          {onOpenPrModal && (
            <button 
              type="button" 
              className="nb-pill-action-btn"
              onClick={onOpenPrModal}
              title="Open Interactive PR Checklist"
              style={{ fontSize: '0.78rem', padding: '4px 10px' }}
            >
              Checklist ↗
            </button>
          )}
        </div>
      </div>

      <div className="nb-pr-tracker__content">
        {/* Donut Gauge Chart */}
        <div className="nb-pr-tracker__gauge">
          <svg width="105" height="105" viewBox="0 0 100 100" className="nb-gauge-svg">
            {/* Background ring */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#0E43B9"
              strokeWidth="14"
            />
            {/* Active completed segment with continuous breathe motion */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="#FFC72C"
              strokeWidth="14"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="butt"
              className="nb-gauge-progress-ring"
              transform="rotate(-90 50 50)"
            />
            {/* Dynamic rotating energy marker on the gauge */}
            <circle
              cx="50"
              cy="12"
              r="3.5"
              fill="#FFFFFF"
              stroke="#000000"
              strokeWidth="1.5"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 50 50"
                to="180 50 50"
                dur="4s"
                repeatCount="indefinite"
                additive="sum"
              />
            </circle>
            {/* Inner & Outer Black Outlines for Neo-Brutalist Border Look */}
            <circle
              cx="50"
              cy="50"
              r={radius + 7}
              fill="none"
              stroke="#000000"
              strokeWidth="2.5"
            />
            <circle
              cx="50"
              cy="50"
              r={radius - 7}
              fill="none"
              stroke="#000000"
              strokeWidth="2.5"
            />
          </svg>
          <div className="nb-gauge-center">
            <span className="nb-gauge-count">{prsMerged} / {prsTarget}</span>
            <span className="nb-gauge-label">PRs</span>
          </div>
        </div>

        {/* Logs Feed with Explicit Done / Remaining Breakdown */}
        <div className="nb-pr-tracker__logs">
          <div className="nb-logs-title-row">
            <span className="nb-logs-title">Challenge Status:</span>
            <span className="nb-logs-badge">
              {prsMerged >= 4
                ? '🏆 4/4 Complete!'
                : `${prsMerged} Merged / ${4 - prsMerged} To Go`}
            </span>
          </div>

          {displayEntries.map((entry, idx) => (
            <div
              key={`${entry.id}-${idx}`}
              className={`nb-log-entry nb-log-entry--${entry.status}`}
              title={entry.title}
            >
              <span className={`nb-log-dot nb-log-dot--${entry.status}`} />
              <span className="nb-log-text">
                <strong>#{entry.id}:</strong> {entry.statusLabel}{' '}
                <span className="nb-log-repo">({entry.repo})</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
