import {
  BotMessageSquare,
  CalendarClock,
  Flame,
  LayoutDashboard,
  Lock,
  Radar,
  Settings,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';

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
  workspaceName?: string;
  onLockApp: () => void;
}

const NAV_ITEMS: Array<{
  id: NavTab;
  label: string;
  sublabel: string;
  icon: typeof LayoutDashboard;
  accent: 'blue' | 'red';
}> = [
  {
    id: 'dashboard',
    label: 'Tổng quan Realtime',
    sublabel: 'Module 4 · Báo cáo',
    icon: LayoutDashboard,
    accent: 'blue',
  },
  {
    id: 'accounts',
    label: 'Tài khoản Facebook',
    sublabel: 'Đa luồng · Song song',
    icon: UserCheck,
    accent: 'blue',
  },
  {
    id: 'nurture',
    label: 'Nuôi Nick & Fanpage',
    sublabel: 'Tạo Page · Chuẩn Ads',
    icon: Flame,
    accent: 'red',
  },
  {
    id: 'auto-publisher',
    label: 'Lịch Đăng bài AI',
    sublabel: 'Auto-Post · FB & Page',
    icon: CalendarClock,
    accent: 'blue',
  },
  {
    id: 'group-finder',
    label: 'Tìm kiếm Group',
    sublabel: 'Module 1 · Auto-Join',
    icon: Users,
    accent: 'blue',
  },
  {
    id: 'keyword-scanner',
    label: 'Quét Nội dung',
    sublabel: 'Module 2 · Delay 3-10s',
    icon: Radar,
    accent: 'red',
  },
  {
    id: 'ai-content',
    label: 'AI Content & RAG',
    sublabel: 'Module 3 · 2 Cột',
    icon: BotMessageSquare,
    accent: 'blue',
  },
  {
    id: 'safety-optimize',
    label: 'An toàn & Tối ưu',
    sublabel: 'Module 5 · Anti-Ban',
    icon: ShieldCheck,
    accent: 'red',
  },
  {
    id: 'system-admin',
    label: 'Cài đặt & Mật mã',
    sublabel: 'Setup · Đổi Pass truy cập',
    icon: Settings,
    accent: 'blue',
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
  workspaceName,
  onLockApp,
}: SidebarProps) {
  const navContent = (
    <div className="flex h-full flex-col bg-white border-r border-neutral-300">
      <div className="flex h-16 items-center justify-between px-5 border-b border-neutral-300 bg-white">
        <a
          href="#dashboard"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('dashboard');
            onCloseMobile();
          }}
          className="font-display text-lg font-bold tracking-tight text-black whitespace-nowrap shrink-0 truncate flex items-center gap-1.5"
        >
          {(() => {
            const name = (workspaceName || 'SocialPulse FB').trim();
            if (name.endsWith(' FB')) {
              return (
                <>
                  <span>{name.slice(0, -3)}</span>
                  <span className="text-red-600">FB</span>
                </>
              );
            }
            return (
              <>
                <span>{name}</span>
                <span className="text-blue-600">FB</span>
              </>
            );
          })()}
        </a>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Đóng menu điều hướng"
          className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg text-black hover:border-red-600 border border-neutral-300"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav aria-label="Điều hướng chính" className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 bg-white">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const isRed = item.accent === 'red';

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onSelectTab(item.id);
                onCloseMobile();
              }}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                isActive
                  ? isRed
                    ? 'bg-white border-2 border-red-600 text-black'
                    : 'bg-white border-2 border-blue-600 text-black'
                  : 'border border-transparent text-black hover:border-neutral-300'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isActive
                      ? isRed
                        ? 'bg-red-600 text-white'
                        : 'bg-blue-600 text-white'
                      : isRed
                        ? 'bg-white border border-neutral-300 text-red-600'
                        : 'bg-white border border-neutral-300 text-blue-600'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div
                    className={`text-sm leading-tight truncate ${
                      isActive
                        ? isRed
                          ? 'font-bold text-red-700'
                          : 'font-bold text-blue-700'
                        : 'font-semibold text-black'
                    }`}
                  >
                    {item.label}
                  </div>
                  <div className="text-xs text-neutral-700 truncate mt-0.5">
                    {item.sublabel}
                  </div>
                </div>
              </div>
              {item.id === 'accounts' && (
                <span className="font-mono tabular-nums text-xs font-bold text-blue-700 shrink-0">
                  {activeAccountsCount}
                </span>
              )}
              {item.id === 'nurture' && (
                <span className="font-mono tabular-nums text-xs font-bold text-red-700 shrink-0">
                  {fanpagesCount}
                </span>
              )}
              {item.id === 'auto-publisher' && scheduledPostsCount > 0 && (
                <span className="font-mono tabular-nums text-xs font-bold text-blue-700 shrink-0">
                  {scheduledPostsCount}
                </span>
              )}
              {item.id === 'keyword-scanner' && runningStreamsCount > 0 && (
                <span className="font-mono tabular-nums text-xs font-bold text-red-700 shrink-0">
                  {runningStreamsCount} chạy
                </span>
              )}
              {item.id === 'ai-content' && pendingAiCount > 0 && (
                <span className="font-mono tabular-nums text-xs font-bold text-blue-700 shrink-0">
                  {pendingAiCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Single-owner lock footer */}
      <div className="border-t border-neutral-300 px-4 py-3.5 bg-white space-y-2.5">
        <div className="min-w-0">
          <div className="text-xs font-bold text-black truncate">Workspace Cá nhân</div>
          <div className="text-[11px] font-semibold text-blue-700 truncate">
            Bảo vệ bằng Mật mã truy cập
          </div>
        </div>
        <button
          type="button"
          onClick={onLockApp}
          className="w-full h-9 px-3 rounded-lg border border-red-600 bg-white hover:bg-red-600 hover:text-white text-xs font-bold text-red-700 inline-flex items-center justify-center gap-1.5 transition-colors"
        >
          <Lock className="h-3.5 w-3.5" />
          <span>Khóa phiên</span>
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
            className="fixed inset-0 bg-black/45"
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
