import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Play,
  Clock,
  FileText,
  Zap,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import './Layout.css';

const NAV_ITEMS = [
  { to: '/dashboard', Icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/test',      Icon: Play,            label: 'New Test'  },
  { to: '/history',   Icon: Clock,           label: 'History'   },
  { to: '/reports',   Icon: FileText,        label: 'Reports'   },
  { to: '/cucumber', Icon: FileText,         label: 'Cucumber'  },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`layout ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <Zap size={22} className="logo-icon-svg" aria-hidden="true" />
          {sidebarOpen && <span className="logo-text">WebTestIQ</span>}
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen
              ? <ChevronLeft size={14} aria-hidden="true" />
              : <ChevronRight size={14} aria-hidden="true" />}
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {NAV_ITEMS.map(({ to, Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              title={label}
            >
              <Icon size={18} className="nav-icon-svg" aria-hidden="true" />
              {sidebarOpen && <span className="nav-label">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {sidebarOpen && (
            <div className="user-info">
              <span className="user-avatar" aria-hidden="true">
                {user?.username?.[0]?.toUpperCase()}
              </span>
              <span className="user-name">{user?.username}</span>
            </div>
          )}
          <button
            className="logout-btn"
            onClick={handleLogout}
            title="Logout"
            aria-label="Logout"
          >
            <LogOut size={16} aria-hidden="true" />
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="main-content" id="main-content">
        {children}
      </main>
    </div>
  );
}
