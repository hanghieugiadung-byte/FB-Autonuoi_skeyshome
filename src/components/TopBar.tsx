import { LogOut, Menu, Plus, Settings } from 'lucide-react';
import type { AdminUser } from '../../shared/types';
import { canUserAccess, ROLE_LABELS } from '../utils/rbac';
import { PWAInstallButton } from './PWAInstallButton';
import type { NavTab } from './Sidebar';

interface TopBarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenMobileMenu: () => void;
  onPrimaryAction: () => void;
  currentUser: AdminUser;
  workspaceName?: string;
  onLogout: () => void;
}

const TAB_TITLES: Record<NavTab, string> = {
  dashboard: 'Tổng quan Realtime',
  accounts: 'Tài khoản Facebook & Chạy song song',
  nurture: 'Nuôi Nick FB & Fanpage Ads',
  'auto-publisher': 'Tự động Đăng bài AI theo Lịch',
  'group-finder': 'Tìm kiếm & Tổng hợp Group',
  'keyword-scanner': 'Quét Nội dung & Comment',
  'ai-content': 'Kho RAG & Xưởng AI Content',
  'safety-optimize': 'An toàn Tài khoản & Tối ưu',
  'system-admin': 'Quản trị Hệ thống & Phân quyền',
};

export function TopBar({
  activeTab,
  onSelectTab,
  onOpenMobileMenu,
  onPrimaryAction,
  currentUser,
  workspaceName,
  onLogout,
}: TopBarProps) {
  const canGroupFinder = canUserAccess(currentUser, 'run_group_finder');

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
      {/* Zone 1: Breadcrumb / Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Mở menu điều hướng"
          className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 shrink-0"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-slate-600 hidden 2xl:inline whitespace-nowrap font-medium">
            {workspaceName || 'Workspace'}
          </span>
          <span className="text-slate-400 hidden 2xl:inline" aria-hidden="true">
            /
          </span>
          <h1 className="font-display text-base font-bold text-slate-900 truncate">
            {TAB_TITLES[activeTab]}
          </h1>
        </div>
      </div>

      {/* Zone 2: Concise single-line navigation links filtered by RBAC */}
      <nav
        aria-label="Chuyển nhanh module"
        className="hidden xl:flex items-center gap-3.5 2xl:gap-5 text-xs 2xl:text-sm font-medium text-slate-700"
      >
        {canUserAccess(currentUser, 'view_dashboard') && (
          <button
            type="button"
            onClick={() => onSelectTab('dashboard')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeTab === 'dashboard'
                ? 'border-blue-600 text-blue-700 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Báo cáo
          </button>
        )}
        {canUserAccess(currentUser, 'manage_nurture') && (
          <button
            type="button"
            onClick={() => onSelectTab('nurture')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeTab === 'nurture'
                ? 'border-rose-600 text-rose-700 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Nuôi Nick &amp; Page
          </button>
        )}
        {canUserAccess(currentUser, 'manage_publisher') && (
          <button
            type="button"
            onClick={() => onSelectTab('auto-publisher')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeTab === 'auto-publisher'
                ? 'border-sky-600 text-sky-700 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Lịch Đăng AI
          </button>
        )}
        {canGroupFinder && (
          <button
            type="button"
            onClick={() => onSelectTab('group-finder')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeTab === 'group-finder'
                ? 'border-teal-600 text-teal-700 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Group Finder
          </button>
        )}
        {canUserAccess(currentUser, 'run_scanner') && (
          <button
            type="button"
            onClick={() => onSelectTab('keyword-scanner')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeTab === 'keyword-scanner'
                ? 'border-amber-600 text-amber-700 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            Scanner
          </button>
        )}
        {canUserAccess(currentUser, 'manage_ai_rag') && (
          <button
            type="button"
            onClick={() => onSelectTab('ai-content')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 ${
              activeTab === 'ai-content'
                ? 'border-violet-600 text-violet-700 font-semibold'
                : 'border-transparent hover:text-slate-900'
            }`}
          >
            AI Content
          </button>
        )}
      </nav>

      {/* Zone 3: Install App + User badge + Primary Action */}
      <div className="flex items-center gap-2 shrink-0">
        <PWAInstallButton />
        <button
          type="button"
          onClick={() => onSelectTab('system-admin')}
          aria-label="Mở Quản trị Hệ thống và Phân quyền"
          className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-blue-400 text-xs font-semibold text-slate-800 whitespace-nowrap"
        >
          <Settings className="h-3.5 w-3.5 text-slate-700" />
          <span>{ROLE_LABELS[currentUser.role].split('(')[0].trim()}</span>
        </button>

        {canGroupFinder ? (
          <button
            type="button"
            onClick={onPrimaryAction}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <Plus className="h-4 w-4" />
            <span>Tìm Group mới</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:border-red-300 text-slate-800 text-xs font-semibold whitespace-nowrap shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Đăng xuất</span>
          </button>
        )}
      </div>
    </header>
  );
}
