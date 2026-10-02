import { Bell, ClipboardList, Cog, FileSearch, FileSpreadsheet, Gauge, History, LogOut, Map, PenLine, Settings, ShieldCheck, Sparkles, UploadCloud, Users } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../services/auth';

type NavItem = { to: string; label: string; icon: any; admin?: boolean };
type NavGroup = { id: string; label: string; icon: any; items: NavItem[] };

const topNav: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: Gauge },
  { to: '/documents', label: 'Danh sách văn bản', icon: FileSearch },
  { to: '/import', label: 'Tải lên tài liệu', icon: UploadCloud },
  { to: '/reports', label: 'Thống kê', icon: FileSpreadsheet },
  { to: '/assistant', label: 'Trợ lý AI', icon: Sparkles }
];

const groups: NavGroup[] = [
  {
    id: 'rules',
    label: 'Chuẩn hóa quy tắc',
    icon: Settings,
    items: [
      { to: '/rules', label: 'Quy tắc phân loại', icon: ShieldCheck, admin: true },
      { to: '/unit-mappings', label: 'Chuẩn hóa đơn vị', icon: Map, admin: true },
      { to: '/signers', label: 'Người ký chính', icon: PenLine, admin: true }
    ]
  },
  {
    id: 'info',
    label: 'Thông tin chung',
    icon: Cog,
    items: [
      { to: '/snapshots', label: 'Kết quả đã lưu', icon: ClipboardList },
      { to: '/imports', label: 'Lịch sử nhập', icon: History },
      { to: '/users', label: 'Cấu hình người dùng', icon: Users, admin: true }
    ]
  }
];

const titles: Record<string, string> = {
  '/': 'Tổng quan',
  '/import': 'Nhập file Excel',
  '/documents': 'Danh sách văn bản',
  '/reports': 'Thống kê',
  '/assistant': 'Trợ lý AI',
  '/rules': 'Quy tắc phân loại',
  '/unit-mappings': 'Chuẩn hóa đơn vị',
  '/signers': 'Danh sách người ký chính',
  '/users': 'Người dùng & phân quyền',
  '/imports': 'Lịch sử nhập',
  '/snapshots': 'Kết quả đã lưu'
};

function AgribankLogo() {
  return (
    <svg viewBox="0 0 60 60" width="44" height="44" aria-hidden="true">
      <rect width="60" height="60" fill="#fff" />
      <polygon points="0,0 60,60 0,60" fill="#0b8a3e" />
      <polygon points="0,0 60,60 60,0" fill="#c8102e" />
      <line x1="0" y1="0" x2="60" y2="60" stroke="#ffd200" strokeWidth="1.5" />
    </svg>
  );
}

function NavRow({ to, label, Icon, end }: { to: string; label: string; Icon: any; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
      <Icon size={18} />
      <span>{label}</span>
    </NavLink>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isAdmin = user?.role === 'ADMIN';
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ rules: true, info: true });

  const toggle = (id: string) => setOpenGroups((p) => ({ ...p, [id]: !p[id] }));

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <AgribankLogo />
          <div className="brand-text">
            <strong>AGRIBANK</strong>
            <small>THEO DÕI KÝ SỐ IOFFCE</small>
          </div>
        </div>
        <nav>
          {topNav.map((item) => <NavRow key={item.to} to={item.to} label={item.label} Icon={item.icon} end={item.to === '/'} />)}
          {groups.map((group) => {
            const items = group.items.filter((i) => !i.admin || isAdmin);
            if (items.length === 0) return null;
            const GroupIcon = group.icon;
            const open = openGroups[group.id];
            return (
              <div key={group.id} className="nav-group">
                <button type="button" className="nav-group-head" onClick={() => toggle(group.id)} aria-expanded={open}>
                  <GroupIcon size={18} />
                  <span>{group.label}</span>
                  <span className={'chev' + (open ? ' open' : '')}>▾</span>
                </button>
                {open && <div className="nav-group-body">
                  {items.map((item) => <NavRow key={item.to} to={item.to} label={item.label} Icon={item.icon} />)}
                </div>}
              </div>
            );
          })}
        </nav>
      </aside>
      <div className="workspace">
        <header className="header">
          <div><p>Rà soát văn bản đi</p><h1>{titles[location.pathname] || 'iOffice'}</h1></div>
          <div className="header-actions"><button aria-label="Thông báo"><Bell size={18} /></button><span>{user?.displayName}</span><button onClick={logout} aria-label="Đăng xuất"><LogOut size={18} /></button></div>
        </header>
        <main><Outlet /></main>
      </div>
    </div>
  );
}
