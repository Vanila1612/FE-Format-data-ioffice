import { Bell, ClipboardList, DatabaseBackup, FileSearch, FileSpreadsheet, Gauge, History, LogOut, Map, PenLine, ShieldCheck, Sparkles, UploadCloud, Users } from 'lucide-react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../services/auth';

const nav = [
  { to: '/', label: 'Tổng quan', icon: Gauge },
  { to: '/import', label: 'Nhập dữ liệu', icon: UploadCloud },
  { to: '/documents', label: 'Văn bản', icon: FileSearch },
  { to: '/reports', label: 'Thống kê', icon: FileSpreadsheet },
  { to: '/assistant', label: 'Trợ lý AI', icon: Sparkles },
  { to: '/rules', label: 'Quy tắc phân loại', icon: ShieldCheck, admin: true },
  { to: '/unit-mappings', label: 'Chuẩn hóa đơn vị', icon: Map, admin: true },
  { to: '/signers', label: 'Người ký chính', icon: PenLine, admin: true },
  { to: '/users', label: 'Người dùng & quyền', icon: Users, admin: true },
  { to: '/imports', label: 'Lịch sử nhập', icon: History },
  { to: '/snapshots', label: 'Kết quả đã lưu', icon: ClipboardList }
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
        <div className="header-actions"><button aria-label="Thông báo"><Bell size={18} /></button><span>{user?.displayName}</span><button onClick={logout} aria-label="Đăng xuất"><LogOut size={18} /></button></div>
      </header>
      <main><Outlet /></main>
    </div>
  </div>;
}
