/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect } from 'react';
import {
  getStoredAccount,
  syncAccount,
  clearStoredAccount,
  fetchUserProfile,
  getTimeAgo,
} from '../services/githubSync';

export default function ConnectAccountModal({ isOpen, onClose }) {
  const [username, setUsername] = useState('KartikeyaSorout');
  const [token, setToken] = useState('');
  const [showTokenHelp, setShowTokenHelp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [account, setAccount] = useState({
    user: null,
    prs: [],
    stats: null,
    lastSynced: null,
    isConnected: false,
  });

  // Preview state for typing username
  const [previewUser, setPreviewUser] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredAccount();
      setAccount(stored);
      if (stored.user?.login) {
        setUsername(stored.user.login);
      }
      if (stored.token) {
        setToken(stored.token);
      }
      setError('');
      setSuccessMsg('');
    }
  }, [isOpen]);

  // Debounced profile preview when typing username
  useEffect(() => {
    if (!isOpen || account.isConnected) return;
    const clean = username.trim().replace(/^@/, '');
    if (!clean || clean.length < 2) {
      setPreviewUser(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsPreviewLoading(true);
      try {
        const profile = await fetchUserProfile(clean, token);
        setPreviewUser(profile);
      } catch {
        setPreviewUser(null);
      } finally {
        setIsPreviewLoading(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [username, token, isOpen, account.isConnected]);

  if (!isOpen) return null;

  const handleConnect = async (e) => {
    e?.preventDefault();
    if (!username.trim()) {
      setError('Please enter a GitHub username');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const synced = await syncAccount(username.trim(), token.trim());
      setAccount({
        user: synced.user,
        token: synced.token,
        prs: synced.prs,
        stats: synced.stats,
        lastSynced: synced.lastSynced,
        isConnected: true,
      });
      setSuccessMsg(`Successfully connected to @${synced.user.login}! Synced ${synced.prs.length} pull requests.`);
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err) {
      setError(err.message || 'Failed to connect GitHub account. Check username or rate limit.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    clearStoredAccount();
    setAccount({
      user: null,
      token: '',
      prs: [],
      stats: null,
      lastSynced: null,
      isConnected: false,
    });
    setPreviewUser(null);
    setSuccessMsg('Account disconnected. Reverted to default demo mode.');
  };

  const handleForceSync = async () => {
    if (!account.user?.login) return;
    setIsLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const synced = await syncAccount(account.user.login, token || account.token);
      setAccount({
        user: synced.user,
        token: synced.token,
        prs: synced.prs,
        stats: synced.stats,
        lastSynced: synced.lastSynced,
        isConnected: true,
      });
      setSuccessMsg(`Live sync complete! ${synced.prs.length} PRs up to date.`);
    } catch (err) {
      setError(err.message || 'Sync failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="nb-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div 
        className="nb-modal-box animate-modal-pop" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '580px', width: '92%' }}
      >
        {/* Modal Header */}
        <div className="nb-modal-header" style={{ background: '#0E43B9', color: '#FFFFFF' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.4rem' }}>🐙</span>
            <div>
              <h2 className="nb-modal-title" style={{ color: '#FFFFFF', margin: 0, fontSize: '1.2rem' }}>
                CONNECT GITHUB ACCOUNT
              </h2>
              <span style={{ fontSize: '0.74rem', opacity: 0.85, fontFamily: 'var(--font-mono)' }}>
                Live PR Status & Challenge Progress Sync
              </span>
            </div>
          </div>
          <button 
            type="button" 
            className="nb-modal-close" 
            onClick={onClose}
            aria-label="Close modal"
            style={{ color: '#FFFFFF', borderColor: '#FFFFFF' }}
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="nb-modal-body" style={{ padding: '24px' }}>
          {/* Notifications */}
          {error && (
            <div 
              style={{
                background: '#FEE2E2',
                border: '2px solid #DC2626',
                padding: '12px 16px',
                borderRadius: '6px',
                marginBottom: '18px',
                color: '#991B1B',
                fontSize: '0.86rem',
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div 
              style={{
                background: '#D1FAE5',
                border: '2px solid #059669',
                padding: '12px 16px',
                borderRadius: '6px',
                marginBottom: '18px',
                color: '#065F46',
                fontSize: '0.86rem',
                fontFamily: 'var(--font-mono)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span>✓</span>
              <span>{successMsg}</span>
            </div>
          )}

          {/* Condition: Connected vs Disconnected */}
          {account.isConnected && account.user ? (
            /* Connected State Card */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div 
                className="nb-card" 
                style={{ 
                  padding: '20px', 
                  background: 'var(--nb-card-alt)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '18px',
                  flexWrap: 'wrap'
                }}
              >
                {account.user.avatar_url && (
                  <img 
                    src={account.user.avatar_url} 
                    alt={account.user.login}
                    style={{
                      width: '68px',
                      height: '68px',
                      borderRadius: '50%',
                      border: '3px solid #000000',
                      boxShadow: '2px 2px 0px #000000'
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className="nb-live-pulse-dot" />
                    <span style={{ fontSize: '0.74rem', fontFamily: 'var(--font-mono)', color: '#059669', fontWeight: 700 }}>
                      CONNECTED & LIVE SYNCING
                    </span>
                  </div>
                  <h3 style={{ margin: '0 0 2px', fontFamily: 'var(--font-display)', fontSize: '1.3rem' }}>
                    {account.user.name || account.user.login}
                  </h3>
                  <a 
                    href={account.user.html_url || `https://github.com/${account.user.login}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ 
                      fontSize: '0.85rem', 
                      fontFamily: 'var(--font-mono)', 
                      color: 'var(--nb-blue)', 
                      fontWeight: 700,
                      textDecoration: 'none'
                    }}
                  >
                    @{account.user.login} ↗
                  </a>
                  {account.user.bio && (
                    <p style={{ margin: '6px 0 0', fontSize: '0.82rem', color: 'var(--nb-text-muted)' }}>
                      {account.user.bio}
                    </p>
                  )}
                </div>
              </div>

              {/* Live PR Sync Stats Breakdown */}
              <div 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(4, 1fr)', 
                  gap: '10px',
                  fontFamily: 'var(--font-mono)',
                  textAlign: 'center'
                }}
              >
                <div className="nb-card" style={{ padding: '10px 6px', background: '#FFFFFF' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--nb-text-muted)' }}>TOTAL</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{account.stats?.total_prs || 0}</div>
                </div>
                <div className="nb-card" style={{ padding: '10px 6px', background: '#D1FAE5' }}>
                  <span style={{ fontSize: '0.7rem', color: '#065F46' }}>MERGED</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#065F46' }}>
                    {account.stats?.merged_count || 0}
                  </div>
                </div>
                <div className="nb-card" style={{ padding: '10px 6px', background: '#FEF3C7' }}>
                  <span style={{ fontSize: '0.7rem', color: '#92400E' }}>REVIEW</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#92400E' }}>
                    {account.stats?.in_review_count || 0}
                  </div>
                </div>
                <div className="nb-card" style={{ padding: '10px 6px', background: '#EFF6FF' }}>
                  <span style={{ fontSize: '0.7rem', color: '#1E40AF' }}>PUSHED</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#1E40AF' }}>
                    {account.stats?.pushed_count || 0}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--nb-text-muted)', fontFamily: 'var(--font-mono)' }}>
                <span>Last live synced: <strong>{getTimeAgo(account.lastSynced)}</strong></span>
                <span>Challenge Progress: <strong>{account.stats?.merged_count || 0} / 4 Merged</strong></span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="nb-search-submit-btn"
                  onClick={handleForceSync}
                  disabled={isLoading}
                  style={{ flex: 1, padding: '12px 18px', fontSize: '0.92rem' }}
                >
                  {isLoading ? 'Syncing...' : '🔄 Sync Live Status'}
                </button>
                <button
                  type="button"
                  onClick={handleDisconnect}
                  className="nb-pill-action-btn"
                  style={{
                    padding: '12px 18px',
                    fontSize: '0.92rem',
                    background: '#FEE2E2',
                    color: '#991B1B',
                    borderColor: '#991B1B'
                  }}
                >
                  🔌 Disconnect
                </button>
              </div>
            </div>
          ) : (
            /* Disconnected / Form State */
            <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label 
                  htmlFor="github-username-input" 
                  style={{ 
                    display: 'block', 
                    fontSize: '0.85rem', 
                    fontFamily: 'var(--font-mono)', 
                    fontWeight: 700, 
                    marginBottom: '8px' 
                  }}
                >
                  GITHUB USERNAME:
                </label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    id="github-username-input"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. KartikeyaSorout"
                    required
                    style={{
                      flex: 1,
                      padding: '12px 14px',
                      border: '2.5px solid #000000',
                      borderRadius: '4px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      background: '#FFFFFF',
                      boxShadow: '2px 2px 0px #000000'
                    }}
                  />
                  {username !== 'KartikeyaSorout' && (
                    <button
                      type="button"
                      onClick={() => setUsername('KartikeyaSorout')}
                      className="nb-pill-action-btn"
                      style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}
                      title="Quick fill KartikeyaSorout"
                    >
                      Use @KartikeyaSorout
                    </button>
                  )}
                </div>
              </div>

              {/* Profile Preview Box (Live feedback as user types) */}
              {previewUser && (
                <div 
                  className="nb-card animate-fade-in" 
                  style={{ 
                    padding: '12px 16px', 
                    background: '#F0FDF4', 
                    border: '2px solid #059669',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px'
                  }}
                >
                  {previewUser.avatar_url && (
                    <img 
                      src={previewUser.avatar_url} 
                      alt={previewUser.login} 
                      style={{ width: '44px', height: '44px', borderRadius: '50%', border: '2px solid #000000' }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem' }}>{previewUser.name}</div>
                    <div style={{ fontSize: '0.78rem', fontFamily: 'var(--font-mono)', color: 'var(--nb-text-muted)' }}>
                      @{previewUser.login} • {previewUser.public_repos} public repos
                    </div>
                  </div>
                  <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                    ✓ Ready to sync
                  </span>
                </div>
              )}

              {/* Optional GitHub Token */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label 
                    htmlFor="github-token-input" 
                    style={{ 
                      fontSize: '0.85rem', 
                      fontFamily: 'var(--font-mono)', 
                      fontWeight: 700 
                    }}
                  >
                    PERSONAL ACCESS TOKEN (OPTIONAL):
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowTokenHelp(!showTokenHelp)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--nb-blue)',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    {showTokenHelp ? 'Hide info' : 'Why add a token?'}
                  </button>
                </div>

                {showTokenHelp && (
                  <div 
                    style={{ 
                      background: '#EFF6FF', 
                      border: '1.5px solid #93C5FD', 
                      padding: '10px 14px', 
                      borderRadius: '4px', 
                      fontSize: '0.78rem', 
                      marginBottom: '10px',
                      color: '#1E40AF',
                      fontFamily: 'var(--font-mono)'
                    }}
                  >
                    💡 A GitHub token increases API rate limits from 60 to <strong>5,000 requests/hour</strong> and allows live syncing private pull requests and real-time review states. It is stored exclusively in your local browser storage.
                  </div>
                )}

                <input
                  id="github-token-input"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="ghp_... or gho_... (optional)"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    border: '2.5px solid #000000',
                    borderRadius: '4px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.9rem',
                    background: '#FFFFFF',
                    boxShadow: '2px 2px 0px #000000'
                  }}
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className={`nb-search-submit-btn ${isLoading ? 'nb-search-submit-btn--loading' : ''}`}
                disabled={isLoading || !username.trim()}
                style={{ padding: '14px 20px', fontSize: '1rem', marginTop: '8px' }}
                id="modal-connect-btn"
              >
                {isLoading ? 'Connecting & Syncing...' : '⚡ Connect & Live Sync PRs'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
