'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Breadcrumbs from '../../components/Breadcrumbs';
import PrChecklistModal from '../../components/PrChecklistModal';
import {
  getStoredAccount,
  syncAccount,
  getTimeAgo,
  SYNC_EVENT_NAME,
} from '../../services/githubSync';

export default function TrackerPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, MERGED, IN_REVIEW, PUSHED, WORKING_ON
  const [searchQuery, setSearchQuery] = useState('');
  const [syncNotice, setSyncNotice] = useState('');

  const [account, setAccount] = useState({
    user: null,
    token: '',
    prs: [],
    stats: null,
    lastSynced: null,
    isConnected: false,
  });

  const [checklist, setChecklist] = useState({
    closesIssue: true,
    testsPass: true,
    conventionalCommit: true,
    cleanDiff: false,
    syncedBranch: true,
  });

  // Default fallback demo logs when no GitHub account is connected yet
  const fallbackPrLogs = useMemo(
    () => [
      {
        id: 'PR-1024',
        number: 1024,
        repo: 'adithyan-css/Brownie-Bliss',
        title: 'fix(homepage): resolve hotlinked images and dead footer links',
        status: 'MERGED',
        statusLabel: 'Merged',
        date: 'Oct 08, 2026',
        badgeClass: 'tag--beginner',
        bgPill: '#D1FAE5',
        colorPill: '#065F46',
        html_url: 'https://github.com/adithyan-css/Brownie-Bliss/pull/1024',
        comments: 2,
        labels: ['hacktoberfest-accepted', 'bug'],
      },
      {
        id: 'PR-1025',
        number: 1025,
        repo: 'adithyan-css/Brownie-Bliss',
        title: 'fix(cart): eliminate off-by-one rounding discrepancy on checkout',
        status: 'IN_REVIEW',
        statusLabel: 'In Review',
        date: 'Oct 10, 2026',
        badgeClass: 'tag--intermediate',
        bgPill: '#FEF3C7',
        colorPill: '#92400E',
        html_url: 'https://github.com/adithyan-css/Brownie-Bliss/pull/1025',
        comments: 4,
        labels: ['under-review', 'enhancement'],
      },
      {
        id: 'PR-1026',
        number: 1026,
        repo: 'fastapi/fastapi',
        title: 'docs(api): update dependency override examples in async client',
        status: 'WORKING_ON',
        statusLabel: 'Working On',
        date: 'Oct 11, 2026',
        badgeClass: 'tag--advanced',
        bgPill: '#F3E8FF',
        colorPill: '#6B21A8',
        html_url: 'https://github.com/fastapi/fastapi/pull/1026',
        comments: 1,
        labels: ['draft', 'documentation'],
      },
      {
        id: 'PR-1027',
        number: 1027,
        repo: 'vercel/next.js',
        title: 'docs(middleware): clarify cookie header propagation',
        status: 'PUSHED',
        statusLabel: 'Pushed',
        date: 'Oct 13, 2026',
        badgeClass: 'tag--tech',
        bgPill: '#EFF6FF',
        colorPill: '#1E40AF',
        html_url: 'https://github.com/vercel/next.js/pull/1027',
        comments: 0,
        labels: ['pushed', 'docs'],
      },
    ],
    []
  );

  // Load account from storage and listen for global sync events
  useEffect(() => {
    const stored = getStoredAccount();
    setAccount(stored);

    const handleSyncEvent = (e) => {
      const detail = e.detail;
      if (detail) {
        setAccount(detail);
      }
    };

    window.addEventListener(SYNC_EVENT_NAME, handleSyncEvent);
    return () => window.removeEventListener(SYNC_EVENT_NAME, handleSyncEvent);
  }, []);

  // Determine current active PRs list
  const activePrs = account.isConnected && account.prs?.length > 0 ? account.prs : fallbackPrLogs;

  // Counts for tabs
  const counts = useMemo(() => {
    return {
      ALL: activePrs.length,
      MERGED: activePrs.filter((p) => p.status === 'MERGED').length,
      IN_REVIEW: activePrs.filter((p) => p.status === 'IN_REVIEW').length,
      PUSHED: activePrs.filter((p) => p.status === 'PUSHED').length,
      WORKING_ON: activePrs.filter((p) => p.status === 'WORKING_ON').length,
    };
  }, [activePrs]);

  // Merged PR count
  const mergedCount = account.isConnected && account.stats ? account.stats.merged_count : 2;
  const inReviewCount = account.isConnected && account.stats ? account.stats.in_review_count : 1;
  const pushedCount = account.isConnected && account.stats ? account.stats.pushed_count : 1;
  const workingOnCount = account.isConnected && account.stats ? account.stats.working_on_count : 1;

  // Filtered PR list
  const filteredPrs = useMemo(() => {
    return activePrs.filter((pr) => {
      // Status filter
      if (statusFilter !== 'ALL' && pr.status !== statusFilter) {
        return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = pr.title?.toLowerCase().includes(q);
        const matchesRepo = pr.repo?.toLowerCase().includes(q);
        const matchesId = pr.id?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesRepo && !matchesId) return false;
      }
      return true;
    });
  }, [activePrs, statusFilter, searchQuery]);

  // Milestone achievements
  const milestones = [
    {
      title: 'First Splash',
      requirement: '1 PR Merged',
      icon: '🥉',
      unlocked: mergedCount >= 1,
      desc: 'Made your first open-source contribution.',
    },
    {
      title: 'Halfway Hero',
      requirement: '2 PRs Merged',
      icon: '🥈',
      unlocked: mergedCount >= 2,
      desc: '50% toward completing the challenge!',
    },
    {
      title: 'Hat Trick',
      requirement: '3 PRs Merged',
      icon: '🥇',
      unlocked: mergedCount >= 3,
      desc: 'Only one more pull request to go.',
    },
    {
      title: 'Hacktoberfest 2026 Champ',
      requirement: '4 PRs Merged',
      icon: '🏆',
      unlocked: mergedCount >= 4,
      desc: 'Complete the official 4-PR challenge.',
    },
  ];

  const toggleChecklist = (key) => {
    setChecklist((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleOpenConnectModal = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open_connect_account_modal'));
    }
  };

  const handleLiveSync = async () => {
    if (!account.isConnected || !account.user?.login) {
      handleOpenConnectModal();
      return;
    }

    setIsSyncing(true);
    setSyncNotice('');
    try {
      const updated = await syncAccount(account.user.login, account.token);
      setAccount({
        user: updated.user,
        token: updated.token,
        prs: updated.prs,
        stats: updated.stats,
        lastSynced: updated.lastSynced,
        isConnected: true,
      });
      setSyncNotice(`Synced live with GitHub! ${updated.prs.length} PRs active.`);
      setTimeout(() => setSyncNotice(''), 4000);
    } catch (err) {
      setSyncNotice(`Sync warning: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // SVG Gauge calculations
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = Math.min(mergedCount / 4, 1);
  const strokeDashoffset = circumference - progressRatio * circumference;

  return (
    <div className="container dashboard animate-fade-in" style={{ padding: '24px 28px' }}>
      <Breadcrumbs items={[{ label: 'PR Tracker', href: null }]} />

      {/* Top Header Card */}
      <div className="nb-card" style={{ marginTop: '20px', padding: '28px' }}>
        <div className="nb-analyzer-main__header" style={{ marginBottom: '12px' }}>
          <span className="nb-tag-tech">CHALLENGE DASHBOARD</span>
          <span className="nb-label-tracked">FEATURE 05: PR TRACKER</span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '20px',
          }}
        >
          <div>
            <h1 className="nb-hero-headline" style={{ fontSize: '2.4rem', margin: '0 0 10px' }}>
              Hacktoberfest PR Tracker
            </h1>
            <p className="nb-hero-subtext" style={{ maxWidth: '680px' }}>
              Track all pull requests live from GitHub toward the official 4-PR milestone. Real-time syncing for
              merged, in-review, pushed, and working-on contributions.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="nb-search-submit-btn"
              onClick={handleLiveSync}
              disabled={isSyncing}
              id="live-sync-pr-btn"
              style={{
                padding: '12px 18px',
                fontSize: '0.92rem',
                background: account.isConnected ? '#059669' : '#0E43B9',
              }}
              title="Sync live PR status from GitHub"
            >
              {isSyncing ? 'Syncing...' : '🔄 Live Sync'}
            </button>
            <button
              type="button"
              className="nb-pill-action-btn"
              onClick={handleOpenConnectModal}
              id="manage-connected-account-btn"
              style={{ padding: '12px 18px', fontSize: '0.92rem' }}
            >
              {account.isConnected ? `👤 @${account.user?.login}` : '🐙 Connect Account'}
            </button>
            <button
              type="button"
              className="nb-pill-action-btn"
              onClick={() => setIsModalOpen(true)}
              id="open-pr-checklist-modal-btn"
              style={{ padding: '12px 18px', fontSize: '0.92rem' }}
            >
              🚀 Pre-Flight Checklist
            </button>
          </div>
        </div>

        {/* Sync Status Banner */}
        {syncNotice && (
          <div
            style={{
              marginTop: '16px',
              padding: '10px 16px',
              background: '#D1FAE5',
              border: '2px solid #059669',
              borderRadius: '4px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.85rem',
              color: '#065F46',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>✓</span>
            <span>{syncNotice}</span>
          </div>
        )}

        {/* If Not Connected, show friendly Call To Action Banner */}
        {!account.isConnected && (
          <div
            className="nb-card"
            style={{
              marginTop: '20px',
              padding: '18px 22px',
              background: '#FEF3C7',
              borderColor: '#000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ fontSize: '1.8rem' }}>🐙</span>
              <div>
                <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', display: 'block' }}>
                  Connect Your GitHub Account
                </strong>
                <span style={{ fontSize: '0.84rem', color: '#78350F' }}>
                  Live sync your real pull requests to see what’s merged, in review, pushed, or being worked on.
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenConnectModal}
              className="nb-search-submit-btn"
              style={{ padding: '10px 18px', fontSize: '0.9rem' }}
            >
              Connect GitHub →
            </button>
          </div>
        )}

        {/* Hero Progress Gauge Card */}
        <div
          className="nb-card"
          style={{
            marginTop: '24px',
            padding: '24px',
            background: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            {/* Donut Gauge with Motion */}
            <div style={{ position: 'relative', width: '115px', height: '115px' }}>
              <svg width="115" height="115" viewBox="0 0 110 110">
                <circle cx="55" cy="55" r={radius} fill="none" stroke="#0E43B9" strokeWidth="16" />
                <circle
                  cx="55"
                  cy="55"
                  r={radius}
                  fill="none"
                  stroke="#FFC72C"
                  strokeWidth="16"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="butt"
                  className="nb-gauge-progress-ring"
                  transform="rotate(-90 55 55)"
                />
                <circle cx="55" cy="55" r={radius + 8} fill="none" stroke="#000000" strokeWidth="2.5" />
                <circle cx="55" cy="55" r={radius - 8} fill="none" stroke="#000000" strokeWidth="2.5" />
              </svg>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                }}
              >
                <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{mergedCount} / 4</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--nb-text-muted)' }}>MERGED</span>
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="nb-live-pulse-dot" />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem', fontWeight: 700, color: '#059669' }}>
                  {mergedCount >= 4
                    ? '🎉 100% CHALLENGE COMPLETE!'
                    : `${Math.round(progressRatio * 100)}% MILESTONE REACHED`}
                </span>
                {account.isConnected && (
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.74rem',
                      color: 'var(--nb-text-muted)',
                      marginLeft: '6px',
                    }}
                  >
                    • Synced with @{account.user?.login} ({getTimeAgo(account.lastSynced)})
                  </span>
                )}
              </div>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800, margin: '6px 0' }}>
                {mergedCount} Merged, {inReviewCount} In Review, {pushedCount} Pushed, {workingOnCount} Working On
              </h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--nb-text-muted)', margin: 0 }}>
                {mergedCount >= 4
                  ? 'Congratulations! You have completed all 4 merged pull requests for the official Hacktoberfest challenge.'
                  : `You need ${Math.max(0, 4 - mergedCount)} more merged pull request${
                      4 - mergedCount === 1 ? '' : 's'
                    } to unlock the Hacktoberfest Champion tier.`}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <div className="nb-card" style={{ padding: '12px 18px', background: 'var(--nb-card-alt)' }}>
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--nb-text-muted)' }}>
                TOTAL PRS
              </span>
              <div style={{ fontSize: '1.4rem', fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                {activePrs.length} Submitted
              </div>
            </div>
            <div className="nb-card" style={{ padding: '12px 18px', background: 'var(--nb-card-alt)' }}>
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--nb-text-muted)' }}>
                DAYS REMAINING
              </span>
              <div style={{ fontSize: '1.4rem', fontFamily: 'var(--font-display)', fontWeight: 800, color: 'var(--nb-red)' }}>
                20 Days
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: PR Feed with Status Tabs & Quality Checklist */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginTop: '24px' }}>
        {/* Left Column: PR Filters, Search & Contributions Feed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Header Row with Title and Active Badge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>
                Tracked Pull Requests ({filteredPrs.length})
              </h3>
              {!account.isConnected && (
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.7rem',
                    background: '#FEE2E2',
                    color: '#991B1B',
                    border: '1px solid #991B1B',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    fontWeight: 700,
                  }}
                >
                  DEMO MODE
                </span>
              )}
            </div>

            {/* Live Search Input */}
            <input
              type="text"
              placeholder="Filter by repo, title, #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '6px 12px',
                border: '2px solid #000000',
                borderRadius: '4px',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.82rem',
                minWidth: '200px',
                boxShadow: '2px 2px 0px #000000',
              }}
            />
          </div>

          {/* Status Filter Tabs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: 'All PRs', count: counts.ALL },
              { id: 'MERGED', label: '✓ Merged', count: counts.MERGED, bg: '#D1FAE5', color: '#065F46' },
              { id: 'IN_REVIEW', label: '⏳ In Review', count: counts.IN_REVIEW, bg: '#FEF3C7', color: '#92400E' },
              { id: 'PUSHED', label: '🚀 Pushed', count: counts.PUSHED, bg: '#EFF6FF', color: '#1E40AF' },
              { id: 'WORKING_ON', label: '🛠️ Working On', count: counts.WORKING_ON, bg: '#F3E8FF', color: '#6B21A8' },
            ].map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: active ? 800 : 600,
                    border: '2px solid #000000',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    background: active ? '#FFC72C' : '#FFFFFF',
                    boxShadow: active ? '2px 2px 0px #000000' : 'none',
                    transform: active ? 'translate(-1px, -1px)' : 'none',
                    transition: 'all 0.1s ease',
                  }}
                >
                  {tab.label} ({tab.count})
                </button>
              );
            })}
          </div>

          {/* List of Pull Requests */}
          {filteredPrs.length === 0 ? (
            <div
              className="nb-card"
              style={{
                padding: '36px',
                textAlign: 'center',
                background: '#FFFFFF',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}>🔍</span>
              <strong>No pull requests found matching &quot;{statusFilter}&quot;</strong>
              <p style={{ fontSize: '0.84rem', color: 'var(--nb-text-muted)', margin: '8px 0 0' }}>
                Try switching filter tabs or sync latest pull requests from GitHub.
              </p>
            </div>
          ) : (
            filteredPrs.map((pr) => (
              <div
                key={pr.id}
                className="nb-card"
                style={{
                  padding: '20px',
                  background: 'var(--nb-card-bg)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <a
                    href={pr.html_url || `https://github.com/${pr.repo}/pull/${pr.number}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 800,
                      fontSize: '0.86rem',
                      color: 'var(--nb-blue)',
                      textDecoration: 'none',
                    }}
                  >
                    {pr.id} • {pr.repo} ↗
                  </a>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      fontSize: '0.76rem',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      border: '1.5px solid #000000',
                      background: pr.bgPill || '#EFF6FF',
                      color: pr.colorPill || '#1E40AF',
                    }}
                  >
                    {pr.statusLabel || pr.status}
                  </span>
                </div>

                <a
                  href={pr.html_url || `https://github.com/${pr.repo}/pull/${pr.number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: '#000000',
                    textDecoration: 'none',
                    lineHeight: 1.35,
                  }}
                >
                  {pr.title}
                </a>

                {/* Labels Chips */}
                {Array.isArray(pr.labels) && pr.labels.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                    {pr.labels.map((label, idx) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '0.68rem',
                          fontFamily: 'var(--font-mono)',
                          background: '#F3F4F6',
                          border: '1px solid #D1D5DB',
                          padding: '1px 6px',
                          borderRadius: '3px',
                          color: '#374151',
                        }}
                      >
                        🏷️ {label}
                      </span>
                    ))}
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '6px',
                    fontSize: '0.8rem',
                    color: 'var(--nb-text-muted)',
                  }}
                >
                  <span>Date: {pr.date}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--nb-blue)', fontWeight: 600 }}>
                    Verified by Copilot ✓
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Column: Quality Standards Checklist & Milestones */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Pre-Submission Quality Standards Checklist */}
          <div className="nb-card" style={{ padding: '22px', background: '#FFFFFF' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 800, marginBottom: '6px' }}>
              Quality Standards Checklist
            </h3>
            <p style={{ fontSize: '0.84rem', color: 'var(--nb-text-muted)', marginBottom: '16px' }}>
              Ensure every pull request complies with Hacktoberfest rules before maintainer review.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                { key: 'closesIssue', label: 'Reference issue number in description (e.g. Closes #1013)' },
                { key: 'testsPass', label: 'Unit and integration tests passing locally without regressions' },
                { key: 'conventionalCommit', label: 'Conventional Commit message formatted (fix:, feat:, docs:)' },
                { key: 'cleanDiff', label: 'No temporary files, console logs, or stray inline styles' },
                { key: 'syncedBranch', label: 'Branch rebased and synchronized with upstream main branch' },
              ].map((item) => (
                <label
                  key={item.key}
                  onClick={() => toggleChecklist(item.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    background: checklist[item.key] ? '#F0FDF4' : 'var(--nb-card-alt)',
                    border: '1.5px solid #000000',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checklist[item.key]}
                    onChange={() => {}}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--nb-blue)', cursor: 'pointer' }}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Achievement Milestones */}
          <div className="nb-card" style={{ padding: '22px', background: '#FFFFFF' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 800, marginBottom: '14px' }}>
              Achievement Milestones
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
              {milestones.map((m) => (
                <div
                  key={m.title}
                  className="nb-card"
                  style={{
                    padding: '14px',
                    textAlign: 'center',
                    background: m.unlocked ? '#FEF3C7' : '#F9FAFB',
                    borderColor: m.unlocked ? '#000000' : '#D1D5DB',
                    opacity: m.unlocked ? 1 : 0.65,
                  }}
                >
                  <div style={{ fontSize: '1.8rem', marginBottom: '4px' }}>{m.icon}</div>
                  <strong style={{ fontSize: '0.88rem', display: 'block', fontFamily: 'var(--font-display)' }}>
                    {m.title}
                  </strong>
                  <span style={{ fontSize: '0.72rem', color: 'var(--nb-text-muted)', display: 'block', marginTop: '2px' }}>
                    {m.requirement}
                  </span>
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: '6px',
                      fontSize: '0.68rem',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      color: m.unlocked ? '#065F46' : '#6B7280',
                    }}
                  >
                    {m.unlocked ? '✓ UNLOCKED' : 'LOCKED'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Interactive PR Modal */}
      <PrChecklistModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        prData={{
          title: 'fix(homepage): resolve hotlinked images and dead footer links',
          body: '## Description\nFixes issue #1013 by ensuring asset integrity and cleaning unclosed style tags.\n\nCloses #1013',
        }}
        issueNumber="1013"
        repoUrl="https://github.com/adithyan-css/Brownie-Bliss"
      />
    </div>
  );
}
