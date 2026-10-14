'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function CommandPalette({ isOpen, onClose }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  const actions = [
    {
      category: 'Explore Repositories',
      items: [
        {
          id: 'repo-brownie',
          title: 'Brownie-Bliss (569 Issues)',
          desc: 'Bakery website with beginner & intermediate opportunities',
          icon: '🧁',
          action: () => router.push('/analyze?url=https%3A%2F%2Fgithub.com%2Fadithyan-css%2FBrownie-Bliss'),
        },
        {
          id: 'repo-fastapi',
          title: 'fastapi/fastapi',
          desc: 'High performance Python web framework',
          icon: '⚡',
          action: () => router.push('/analyze?url=https%3A%2F%2Fgithub.com%2Ffastapi%2Ffastapi'),
        },
        {
          id: 'repo-react',
          title: 'facebook/react',
          desc: 'The library for web and native user interfaces',
          icon: '⚛️',
          action: () => router.push('/analyze?url=https%3A%2F%2Fgithub.com%2Ffacebook%2Freact'),
        },
        {
          id: 'repo-nextjs',
          title: 'vercel/next.js',
          desc: 'The React Framework for the Web',
          icon: '▲',
          action: () => router.push('/analyze?url=https%3A%2F%2Fgithub.com%2Fvercel%2Fnext.js'),
        },
      ],
    },
    {
      category: 'Navigation',
      items: [
        {
          id: 'nav-home',
          title: 'Go to Dashboard',
          desc: 'Homepage & Repository Analyzer',
          icon: '🏠',
          action: () => router.push('/'),
        },
        {
          id: 'nav-analyzer',
          title: 'Repository Analyzer',
          desc: 'Search, filter and inspect GitHub issues',
          icon: '🔍',
          action: () => router.push('/analyze'),
        },
        {
          id: 'nav-tracker',
          title: 'Live PR Tracker',
          desc: 'Track merged, in review, pushed and draft PRs',
          icon: '📊',
          action: () => router.push('/tracker'),
        },
        {
          id: 'action-connect-gh',
          title: 'Connect GitHub Account',
          desc: 'Live sync your contributions and challenge progress',
          icon: '🐙',
          action: () => {
            onClose();
            window.dispatchEvent(new CustomEvent('open_connect_account_modal'));
          },
        },
        {
          id: 'nav-first-issues',
          title: 'Filter Beginner Issues',
          desc: 'Direct view of Good First Issues',
          icon: '🌱',
          action: () => router.push('/analyze?difficulty=BEGINNER'),
        },
        {
          id: 'nav-docs',
          title: 'API & Documentation',
          desc: 'Read architecture & Gemma 4 endpoints guide',
          icon: '📖',
          action: () => window.open('https://github.com/AsmitAnand/HacktoberFest-Team-GrandCoders/blob/main/docs/API.md', '_blank'),
        },
      ],
    },
  ];

  // Flatten and filter items based on search query
  const filteredItems = actions.flatMap((grp) =>
    grp.items.filter((item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.desc.toLowerCase().includes(query.toLowerCase())
    )
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(false); // handled by parent toggle
      }
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filteredItems.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % (filteredItems.length || 1));
      } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
        e.preventDefault();
        filteredItems[selectedIndex].action();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredItems, onClose]);

  if (!isOpen) return null;

  return (
    <div className="nb-cmd-modal-overlay" onClick={onClose}>
      <div className="nb-cmd-modal" onClick={(e) => e.stopPropagation()}>
        <div className="nb-cmd-header">
          <span className="nb-cmd-search-icon">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="nb-cmd-input"
            placeholder="Type a command or repository name..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
          />
          <kbd className="nb-kbd">ESC to exit</kbd>
        </div>

        <div className="nb-cmd-results">
          {filteredItems.length === 0 ? (
            <div className="nb-cmd-empty">
              No matching commands found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            filteredItems.map((item, idx) => (
              <div
                key={item.id}
                className={`nb-cmd-item ${idx === selectedIndex ? 'nb-cmd-item--selected' : ''}`}
                onClick={() => {
                  item.action();
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <span className="nb-cmd-item__icon">{item.icon}</span>
                <div className="nb-cmd-item__content">
                  <div className="nb-cmd-item__title">{item.title}</div>
                  <div className="nb-cmd-item__desc">{item.desc}</div>
                </div>
                <span className="nb-cmd-item__enter">↵</span>
              </div>
            ))
          )}
        </div>

        <div className="nb-cmd-footer">
          <span>Use <strong>↑</strong> <strong>↓</strong> to navigate</span>
          <span><strong>↵</strong> to select</span>
        </div>
      </div>
    </div>
  );
}
