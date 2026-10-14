'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getStoredAccount, SYNC_EVENT_NAME } from '../services/githubSync';

export default function Sidebar({ isOpen, onClose, onOpenCommandPalette, onOpenConnectAccount }) {
  const pathname = usePathname();
  const router = useRouter();
  const [userAccount, setUserAccount] = useState('Dev_pilot');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Initial load
    const stored = getStoredAccount();
    if (stored.isConnected && stored.user) {
      setUserAccount(stored.user.login);
      setAvatarUrl(stored.user.avatar_url || '');
      setIsConnected(true);
    }

    // Sync listener
    const handleSync = (e) => {
      const detail = e.detail;
      if (detail && detail.isConnected && detail.user) {
        setUserAccount(detail.user.login);
        setAvatarUrl(detail.user.avatar_url || '');
        setIsConnected(true);
      } else {
        setUserAccount('Dev_pilot');
        setAvatarUrl('');
        setIsConnected(false);
      }
    };

    window.addEventListener(SYNC_EVENT_NAME, handleSync);
    return () => window.removeEventListener(SYNC_EVENT_NAME, handleSync);
  }, []);

  const handleConnect = () => {
    if (onOpenConnectAccount) {
      onOpenConnectAccount();
    }
  };

  const navItems = [
    { number: '01', label: 'Dashboard', href: '/', icon: 'sq-red', id: 'nav-dashboard' },
    { number: '02', label: 'Analyzer', href: '/analyze', icon: 'dot-yellow', id: 'nav-analyzer' },
    { number: '03', label: 'Pipeline Flow', href: '/pipeline', icon: null, id: 'nav-pipeline' },
    { number: '04', label: 'First Issues', href: '/first-issues', icon: 'sq-red', id: 'nav-first-issues' },
    { number: '05', label: 'PR Tracker', href: '/tracker', icon: 'dot-yellow', id: 'nav-pr-tracker' },
  ];

  const isActive = (item) => {
    if (item.href === '/') return pathname === '/';
    return pathname.startsWith(item.href);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="nb-sidebar-backdrop" 
          onClick={onClose} 
          aria-hidden="true" 
        />
      )}

      <aside className={`nb-sidebar ${isOpen ? 'nb-sidebar--open' : ''}`}>
        {/* Top Header & Logo */}
        <div className="nb-sidebar__header">
          <Link href="/" className="nb-sidebar__logo" onClick={onClose}>
            <div className="nb-sidebar__logo-icon">
              <span>🔥</span>
            </div>
            <div className="nb-sidebar__logo-text">
              <span className="nb-sidebar__logo-title">HACKTOBERFEST</span>
              <span className="nb-sidebar__logo-sub">COPILOT</span>
            </div>
          </Link>
          {onClose && (
            <button 
              className="nb-sidebar__close-btn" 
              onClick={onClose}
              aria-label="Close menu"
            >
              ✕
            </button>
          )}
        </div>

        {/* Decorative Bauhaus Blueprint Graphics */}
        <div className="nb-sidebar__blueprint">
          <div className="nb-blueprint__pattern-box">
            <svg width="60" height="32" viewBox="0 0 60 32" fill="none">
              <line x1="0" y1="4" x2="60" y2="4" stroke="#000000" strokeWidth="2.5" />
              <line x1="0" y1="12" x2="60" y2="12" stroke="#000000" strokeWidth="2.5" />
              <line x1="0" y1="20" x2="60" y2="20" stroke="#000000" strokeWidth="2.5" />
              <line x1="0" y1="28" x2="60" y2="28" stroke="#000000" strokeWidth="2.5" />
              <line x1="8" y1="0" x2="8" y2="32" stroke="#000000" strokeWidth="2" strokeDasharray="3 3" />
              <line x1="28" y1="0" x2="28" y2="32" stroke="#000000" strokeWidth="2" strokeDasharray="3 3" />
              <line x1="48" y1="0" x2="48" y2="32" stroke="#000000" strokeWidth="2" strokeDasharray="3 3" />
            </svg>
          </div>
          <div className="nb-blueprint__shapes">
            <div className="nb-blueprint__sq-red" />
            <div className="nb-blueprint__dot-yellow" />
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="nb-sidebar__nav">
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.number}
                href={item.href}
                id={item.id}
                onClick={onClose}
                className={`nb-nav-item ${active ? 'nb-nav-item--active' : ''}`}
              >
                <span className="nb-nav-item__label">
                  <span className="nb-nav-item__number">{item.number}.</span> {item.label}
                </span>
                {item.icon === 'sq-red' && <span className="nb-icon-sq-red" aria-hidden="true" />}
                {item.icon === 'dot-yellow' && <span className="nb-icon-dot-yellow" aria-hidden="true" />}
              </Link>
            );
          })}

          {/* Quick Command Palette trigger in nav */}
          {onOpenCommandPalette && (
            <button 
              type="button" 
              className="nb-nav-item nb-nav-item--cmd"
              onClick={() => {
                onClose?.();
                onOpenCommandPalette();
              }}
            >
              <span className="nb-nav-item__label">
                <span className="nb-nav-item__number">⌘K</span> Quick Actions
              </span>
              <kbd className="nb-kbd">Ctrl+K</kbd>
            </button>
          )}
        </nav>

        {/* Decorative Circuit Lines */}
        <div className="nb-sidebar__circuit">
          <svg width="100%" height="45" viewBox="0 0 200 45" fill="none">
            <path d="M10 20 H70 V5 H120 V35 H180" stroke="#000000" strokeWidth="2.5" />
            <circle cx="10" cy="20" r="4.5" fill="#FFC72C" stroke="#000000" strokeWidth="2" />
            <rect x="66" y="1" width="8" height="8" fill="#FF5436" stroke="#000000" strokeWidth="1.5" />
            <circle cx="180" cy="35" r="4.5" fill="#FFC72C" stroke="#000000" strokeWidth="2" />
          </svg>
        </div>

        {/* Bottom Section */}
        <div className="nb-sidebar__footer">
          <button 
            type="button" 
            className={`nb-connect-btn ${isConnected ? 'nb-connect-btn--active' : ''}`}
            onClick={handleConnect}
            id="connect-account-btn"
            title={isConnected ? `Connected as @${userAccount}. Click to manage/sync` : 'Connect your GitHub account'}
          >
            {isConnected ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: '#059669', fontWeight: 900 }}>✓</span> @{userAccount}
              </span>
            ) : (
              'Connect Account'
            )}
          </button>
          <div className="nb-sidebar__user-badge">
            <span className={`nb-user-status-dot ${isConnected ? 'nb-user-status-dot--connected' : ''}`} />
            <span className="nb-user-text">User: <strong>{userAccount}</strong></span>
          </div>
        </div>
      </aside>
    </>
  );
}
