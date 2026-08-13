import { Bell, ClipboardList, DatabaseBackup, FileSearch, FileSpreadsheet, Gauge, History, LogOut, Map, Settings, ShieldCheck, UploadCloud } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../services/auth';

const nav = [
  { to: '/', label: 'Dashboard', icon: Gauge },
  { to: '/import', label: 'Import', icon: UploadCloud },
  { to: '/documents', label: 'Documents', icon: FileSearch },
  { to: '/reports', label: 'Reports', icon: FileSpreadsheet },
  { to: '/rules', label: 'Rules', icon: ShieldCheck, admin: true },
  { to: '/unit-mappings', label: 'Unit Mapping', icon: Map, admin: true },
  { to: '/imports', label: 'Import History', icon: History },
  { to: '/snapshots', label: 'Snapshots', icon: ClipboardList },
  { to: '/settings', label: 'Settings', icon: Settings }
];

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/import': 'Import Excel',
  '/documents': 'Documents',
  '/reports': 'Reports',
  '/rules': 'Classification Rules',
  '/unit-mappings': 'Unit Mapping',
  '/imports': 'Import History',
  '/snapshots': 'Snapshots',
  '/settings': 'Settings'
};

export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><DatabaseBackup size={22} /><span>iOffice</span></div>
      <nav>
        {nav.filter((item) => !item.admin || user?.role === 'ADMIN').map((item) => {
          const Icon = item.icon;
          return <NavLink key={item.to} to={item.to} end={item.to === '/'}><Icon size={18} /><span>{item.label}</span></NavLink>;
        })}
      </nav>
    </aside>
    <div className="workspace">
      <header className="header">
        <div><p>Rà soát văn bản đi</p><h1>{titles[location.pathname] || 'iOffice'}</h1></div>
        <div className="header-actions"><button aria-label="Notifications"><Bell size={18} /></button><span>{user?.displayName}</span><button onClick={logout} aria-label="Logout"><LogOut size={18} /></button></div>
      </header>
      <main><Outlet /></main>
    </div>
  </div>;
}
