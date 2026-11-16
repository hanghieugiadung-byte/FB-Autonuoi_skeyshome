import {
  BotMessageSquare,
  CalendarClock,
  Flame,
  LayoutDashboard,
  LogOut,
  Radar,
  Settings,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import type { AdminUser, PermissionKey } from '../../shared/types';
import { canUserAccess, ROLE_LABELS } from '../utils/rbac';

export type NavTab =
  | 'dashboard'
  | 'accounts'
  | 'nurture'
  | 'auto-publisher'
  | 'group-finder'
  | 'keyword-scanner'
  | 'ai-content'
  | 'safety-optimize'
  | 'system-admin';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  runningStreamsCount: number;
  pendingAiCount: number;
  activeAccountsCount: number;
  fanpagesCount: number;
  scheduledPostsCount: number;
  currentUser: AdminUser;
  workspaceName?: string;
  onLogout: () => void;
}

const NAV_ITEMS: Array<{
  id: NavTab;
  label: string;
  sublabel: string;
  permission?: PermissionKey;
  icon: typeof LayoutDashboard;
  activeBg: string;
  activeText: string;
  iconColor: string;
}> = [
  {
    id: 'dashboard',
    label: 'Tổng quan Realtime',
    sublabel: 'Module 4 · Báo cáo',
    permission: 'view_dashboard',
    icon: LayoutDashboard,
    activeBg: 'bg-white border-2 border-blue-500 shadow-2xs',
    activeText: 'text-blue-900',
    iconColor: 'text-blue-600',
  },
  {
    id: 'accounts',
    label: 'Tài khoản Facebook',
    sublabel: 'Đa luồng · Song song',
    permission: 'manage_fb_accounts',
    icon: UserCheck,
    activeBg: 'bg-white border-2 border-indigo-500 shadow-2xs',
    activeText: 'text-indigo-900',
    iconColor: 'text-indigo-600',
  },
  {
    id: 'nurture',
    label: 'Nuôi Nick & Fanpage',
    sublabel: 'Tạo Page · Chuẩn Ads',
    permission: 'manage_nurture',
    icon: Flame,
    activeBg: 'bg-white border-2 border-rose-500 shadow-2xs',
    activeText: 'text-rose-900',
    iconColor: 'text-rose-600',
  },
  {
    id: 'auto-publisher',
    label: 'Lịch Đăng bài AI',
    sublabel: 'Auto-Post · FB & Page',
    permission: 'manage_publisher',
    icon: CalendarClock,
    activeBg: 'bg-white border-2 border-sky-500 shadow-2xs',
    activeText: 'text-sky-900',
    iconColor: 'text-sky-600',
  },
  {
    id: 'group-finder',
    label: 'Tìm kiếm Group',
    sublabel: 'Module 1 · Auto-Join',
    permission: 'run_group_finder',
    icon: Users,
    activeBg: 'bg-white border-2 border-teal-500 shadow-2xs',
    activeText: 'text-teal-900',
    iconColor: 'text-teal-600',
  },
  {
    id: 'keyword-scanner',
    label: 'Quét Nội dung',
    sublabel: 'Module 2 · Delay 3-10s',
    permission: 'run_scanner',
    icon: Radar,
    activeBg: 'bg-white border-2 border-amber-500 shadow-2xs',
    activeText: 'text-amber-900',
    iconColor: 'text-amber-600',
  },
  {
    id: 'ai-content',
    label: 'AI Content & RAG',
    sublabel: 'Module 3 · 2 Cột',
    permission: 'manage_ai_rag',
    icon: BotMessageSquare,
    activeBg: 'bg-white border-2 border-violet-500 shadow-2xs',
    activeText: 'text-violet-900',
    iconColor: 'text-violet-600',
  },
  {
    id: 'safety-optimize',
    label: 'An toàn & Tối ưu',
    sublabel: 'Module 5 · Anti-Ban',
    permission: 'manage_safety',
    icon: ShieldCheck,
    activeBg: 'bg-white border-2 border-emerald-500 shadow-2xs',
    activeText: 'text-emerald-900',
    iconColor: 'text-emerald-600',
  },
  {
    id: 'system-admin',
    label: 'Quản trị Hệ thống',
    sublabel: 'Admin · Setup & Phân quyền',
    icon: Settings,
    activeBg: 'bg-white border-2 border-slate-900 shadow-2xs',
    activeText: 'text-slate-900',
    iconColor: 'text-slate-800',
  },
];

export function Sidebar({
  activeTab,
  onSelectTab,
  mobileOpen,
  onCloseMobile,
  runningStreamsCount,
  pendingAiCount,
  activeAccountsCount,
  fanpagesCount,
  scheduledPostsCount,
  currentUser,
  workspaceName,
  onLogout,
}: SidebarProps) {
  const isAdmin = canUserAccess(currentUser, 'manage_system_admin');

  const visibleItems = NAV_ITEMS.filter((item) =>
    item.permission ? canUserAccess(currentUser, item.permission) : true
  );

  const navContent = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200">
      <div className="flex h-16 items-center justify-between px-5 border-b border-slate-200 bg-white">
        <a
          href="#dashboard"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('dashboard');
            onCloseMobile();
          }}
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 truncate"
        >
          {workspaceName || 'SocialPulse FB'}
        </a>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Đóng menu điều hướng"
          className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav aria-label="Điều hướng chính" className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 bg-white">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const sublabel =
            item.id === 'system-admin' && !isAdmin
              ? 'Tài khoản & Mật khẩu'
              : item.sublabel;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                isActive
                  ? `${item.activeBg} ${item.activeText}`
                  : 'border border-transparent text-slate-800 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border ${
                    isActive ? 'bg-white border-slate-200' : 'bg-white border-slate-200'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${item.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold leading-tight truncate">
                    {item.label}
                  </div>
                  <div className="text-xs text-slate-600 truncate mt-0.5">
                    {sublabel}
                  </div>
                </div>
              </div>
              {item.id === 'accounts' && (
                <span className="font-mono tabular-nums text-xs font-semibold text-indigo-700 shrink-0">
                  {activeAccountsCount}
                </span>
              )}
              {item.id === 'nurture' && (
                <span className="font-mono tabular-nums text-xs font-semibold text-rose-700 shrink-0">
                  {fanpagesCount}
                </span>
              )}
              {item.id === 'auto-publisher' && scheduledPostsCount > 0 && (
                <span className="font-mono tabular-nums text-xs font-semibold text-sky-700 shrink-0">
                  {scheduledPostsCount}
                </span>
              )}
              {item.id === 'keyword-scanner' && runningStreamsCount > 0 && (
                <span className="font-mono tabular-nums text-xs font-semibold text-emerald-700 shrink-0">
                  {runningStreamsCount} chạy
                </span>
              )}
              {item.id === 'ai-content' && pendingAiCount > 0 && (
                <span className="font-mono tabular-nums text-xs font-semibold text-violet-700 shrink-0">
                  {pendingAiCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Pure white user identity + logout footer */}
      <div className="border-t border-slate-200 px-4 py-3.5 bg-white space-y-2.5">
        <div className="min-w-0">
          <div className="text-xs font-bold text-slate-900 truncate">{currentUser.fullName}</div>
          <div className="text-[11px] font-medium text-blue-700 truncate">
            {ROLE_LABELS[currentUser.role]}
          </div>
          <div className="text-[11px] font-mono text-slate-600 truncate">
            {currentUser.username}
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="w-full h-8 px-3 rounded-lg border border-slate-200 bg-white hover:border-red-300 hover:text-red-700 text-xs font-semibold text-slate-800 inline-flex items-center justify-center gap-1.5 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Đăng xuất</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block lg:w-68 lg:shrink-0">{navContent}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-72 max-w-[85vw] h-full">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}
