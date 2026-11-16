import { Lock, Menu, Plus, Settings } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import type { NavTab } from './Sidebar';

interface TopBarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenMobileMenu: () => void;
  onPrimaryAction: () => void;
  workspaceName?: string;
  onLockApp: () => void;
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
  'system-admin': 'Cài đặt Hệ thống & Mật mã',
};

export function TopBar({
  activeTab,
  onSelectTab,
  onOpenMobileMenu,
  onPrimaryAction,
  workspaceName,
  onLockApp,
}: TopBarProps) {
  return (
    <header className="h-16 bg-white border-b border-neutral-300 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
      {/* Zone 1: Breadcrumb / Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Mở menu điều hướng"
          className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-300 bg-white text-black hover:border-blue-600 shrink-0"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="text-neutral-800 hidden 2xl:inline whitespace-nowrap font-semibold">
            {workspaceName || 'Workspace'}
          </span>
          <span className="text-neutral-500 hidden 2xl:inline" aria-hidden="true">
            /
          </span>
          <h1 className="font-display text-base font-bold text-black truncate">
            {TAB_TITLES[activeTab]}
          </h1>
        </div>
      </div>

      {/* Zone 2: Concise single-line module links */}
      <nav
        aria-label="Chuyển nhanh module"
        className="hidden xl:flex items-center gap-3.5 2xl:gap-5 text-xs 2xl:text-sm font-semibold text-black"
      >
        <button
          type="button"
          onClick={() => onSelectTab('dashboard')}
          className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
            activeTab === 'dashboard'
              ? 'border-blue-600 text-blue-700 font-bold'
              : 'border-transparent text-black hover:text-blue-700'
          }`}
        >
          Báo cáo
        </button>
        <button
          type="button"
          onClick={() => onSelectTab('nurture')}
          className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
            activeTab === 'nurture'
              ? 'border-red-600 text-red-700 font-bold'
              : 'border-transparent text-black hover:text-red-700'
          }`}
        >
          Nuôi Nick &amp; Page
        </button>
        <button
          type="button"
          onClick={() => onSelectTab('auto-publisher')}
          className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
            activeTab === 'auto-publisher'
              ? 'border-blue-600 text-blue-700 font-bold'
              : 'border-transparent text-black hover:text-blue-700'
          }`}
        >
          Lịch Đăng AI
        </button>
        <button
          type="button"
          onClick={() => onSelectTab('group-finder')}
          className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
            activeTab === 'group-finder'
              ? 'border-blue-600 text-blue-700 font-bold'
              : 'border-transparent text-black hover:text-blue-700'
          }`}
        >
          Group Finder
        </button>
        <button
          type="button"
          onClick={() => onSelectTab('keyword-scanner')}
          className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
            activeTab === 'keyword-scanner'
              ? 'border-red-600 text-red-700 font-bold'
              : 'border-transparent text-black hover:text-red-700'
          }`}
        >
          Scanner
        </button>
        <button
          type="button"
          onClick={() => onSelectTab('ai-content')}
          className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
            activeTab === 'ai-content'
              ? 'border-blue-600 text-blue-700 font-bold'
              : 'border-transparent text-black hover:text-blue-700'
          }`}
        >
          AI Content
        </button>
      </nav>

      {/* Zone 3: Install App + Settings + Lock + Primary Action */}
      <div className="flex items-center gap-2 shrink-0">
        <PWAInstallButton />
        <button
          type="button"
          onClick={() => onSelectTab('system-admin')}
          aria-label="Mở Cài đặt Hệ thống và Đổi mật mã"
          className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white hover:border-blue-600 text-xs font-semibold text-black whitespace-nowrap"
        >
          <Settings className="h-3.5 w-3.5 text-blue-600" />
          <span>Cài đặt</span>
        </button>
        <button
          type="button"
          onClick={onLockApp}
          aria-label="Khóa phiên truy cập"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-600 bg-white hover:bg-red-600 hover:text-white text-xs font-semibold text-red-700 whitespace-nowrap transition-colors"
        >
          <Lock className="h-3.5 w-3.5" />
          <span>Khóa</span>
        </button>
        <button
          type="button"
          onClick={onPrimaryAction}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <Plus className="h-4 w-4" />
          <span>Tìm Group mới</span>
        </button>
      </div>
    </header>
  );
}
