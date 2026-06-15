'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '⬛', section: 'Overview' },
  { href: '/customers', label: 'Customers', icon: '👥', section: 'CRM' },
  { href: '/segments', label: 'Segments', icon: '🎯', section: 'CRM' },
  { href: '/campaigns', label: 'Campaigns', icon: '📣', section: 'Marketing' },
  { href: '/campaigns/new', label: 'New Campaign', icon: '✨', section: 'Marketing' },
];

interface SidebarProps {
  onAiToggle: () => void;
  aiOpen: boolean;
}

export default function Sidebar({ onAiToggle, aiOpen }: SidebarProps) {
  const pathname = usePathname();

  const sections = [...new Set(navItems.map(n => n.section))];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-icon">⚡</div>
          <div>
            <div className="logo-text">ReachIQ</div>
            <div className="logo-sub">AI Marketing CRM</div>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {sections.map(section => (
          <div key={section}>
            <div className="nav-section-label">{section}</div>
            {navItems.filter(n => n.section === section).map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${pathname === item.href ? 'active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </Link>
            ))}
          </div>
        ))}

      </nav>

      <div className="sidebar-footer">
        <div className="brand-chip">
          <div className="brand-avatar">S</div>
          <div className="brand-info">
            <div className="brand-name">StyleHub</div>
            <div className="brand-type">Fashion Brand</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
