import {
  Activity,
  AlertTriangle,
  BotMessageSquare,
  CalendarClock,
  CheckCircle2,
  Flame,
  Pause,
  Play,
  Radar,
  Square,
  UserCheck,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import type { DashboardSnapshot } from '../../shared/types';
import { formatNumberVi, formatShortDateTime } from '../utils/formatters';
import type { NavTab } from './Sidebar';

interface DashboardViewProps {
  snapshot: DashboardSnapshot | null;
  sseConnected: boolean;
  onToggleStream: (streamId: string, action: 'running' | 'pause' | 'stop') => Promise<void>;
  onNavigate: (tab: NavTab) => void;
}

export function DashboardView({
  snapshot,
  sseConnected,
  onToggleStream,
  onNavigate,
}: DashboardViewProps) {
  const [hoveredDayIdx, setHoveredDayIdx] = useState<number | null>(null);

  if (!snapshot) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-white border border-slate-200 animate-pulse" />
          ))}
        </div>
        <div className="h-72 rounded-xl bg-white border border-slate-200 animate-pulse" />
      </div>
    );
  }

  const {
    totals,
    dailySeries,
    keywordSeries,
    streams,
    accounts,
    usageToday,
    safetyConfig,
    recentLogs,
  } = snapshot;

  const maxDailyTotal = Math.max(
    1,
    ...dailySeries.map((d) => Math.max(d.posts, d.comments))
  );
  const maxKeywordCount = Math.max(1, ...keywordSeries.map((k) => k.count));

  return (
    <div className="space-y-6">
      {/* Distinct Color-Coded KPI Cards */}
      <section aria-label="Chỉ số tổng quan">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white border border-teal-200 rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-teal-700">Group đã quét</div>
                <div className="mt-1.5 font-mono tabular-nums text-3xl font-bold text-slate-900">
                  {formatNumberVi(totals.groupsScanned)}
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-emerald-700 font-medium tabular-nums">
                {totals.noApprovalGroups} đăng không cần duyệt
              </span>
              <button
                type="button"
                onClick={() => onNavigate('group-finder')}
                className="font-semibold text-teal-700 hover:underline whitespace-nowrap"
              >
                Chi tiết →
              </button>
            </div>
          </div>

          <div className="bg-white border border-indigo-200 rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-indigo-700">Tài khoản song song</div>
                <div className="mt-1.5 font-mono tabular-nums text-3xl font-bold text-slate-900">
                  {formatNumberVi(totals.activeAccounts)}
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <UserCheck className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-600 tabular-nums">
                {totals.runningAccounts} đang chạy · {totals.keywordsTracked} keyword
              </span>
              <button
                type="button"
                onClick={() => onNavigate('accounts')}
                className="font-semibold text-indigo-700 hover:underline whitespace-nowrap"
              >
                Quản lý →
              </button>
            </div>
          </div>

          <div className="bg-white border border-amber-200 rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-amber-700">Bài &amp; Comment quét</div>
                <div className="mt-1.5 font-mono tabular-nums text-3xl font-bold text-slate-900">
                  {formatNumberVi(totals.postsCollected + totals.commentsCollected)}
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Radar className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-600 tabular-nums">
                {totals.postsCollected} Post · {totals.commentsCollected} Comment
              </span>
              <button
                type="button"
                onClick={() => onNavigate('keyword-scanner')}
                className="font-semibold text-amber-700 hover:underline whitespace-nowrap"
              >
                Quét mới →
              </button>
            </div>
          </div>

          <div className="bg-white border border-violet-200 rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold text-violet-700">AI Content &amp; Duyệt</div>
                <div className="mt-1.5 font-mono tabular-nums text-3xl font-bold text-slate-900">
                  {formatNumberVi(totals.aiRepliesGenerated)}
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center shrink-0">
                <BotMessageSquare className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-violet-700 font-medium tabular-nums">
                {totals.approvedAutoComments} đã Approve
              </span>
              <button
                type="button"
                onClick={() => onNavigate('ai-content')}
                className="font-semibold text-violet-700 hover:underline whitespace-nowrap"
              >
                Xưởng AI →
              </button>
            </div>
          </div>
        </div>

        {/* New Feature KPI Strip: Ads Warmup & AI Auto-Publisher */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div className="bg-white border border-rose-200 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Flame className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-rose-700">
                  Tài nguyên Nuôi Ads (Nick FB &amp; Fanpage)
                </div>
                <div className="text-sm text-slate-900 font-semibold mt-0.5 font-mono tabular-nums">
                  {formatNumberVi(totals.fanpagesCount)} Fanpage ·{' '}
                  {formatNumberVi(totals.adsReadyAssetsCount)} sẵn sàng chạy Ads
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('nurture')}
              className="text-xs font-semibold text-rose-700 hover:underline whitespace-nowrap shrink-0"
            >
              Nuôi Nick &amp; Page →
            </button>
          </div>

          <div className="bg-white border border-sky-200 rounded-xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                <CalendarClock className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-sky-700">
                  Lịch Tự động Đăng bài AI (Đa kênh)
                </div>
                <div className="text-sm text-slate-900 font-semibold mt-0.5 font-mono tabular-nums">
                  {formatNumberVi(totals.scheduledPostsCount)} bài chờ lịch ·{' '}
                  {formatNumberVi(totals.publishedPostsCount)} bài đã đăng
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('auto-publisher')}
              className="text-xs font-semibold text-sky-700 hover:underline whitespace-nowrap shrink-0"
            >
              Lên lịch AI →
            </button>
          </div>
        </div>
      </section>

      {/* Charts Row */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6" aria-label="Biểu đồ phân tích">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display text-base font-semibold text-slate-900">
                Lượng bài đăng &amp; comment theo ngày
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Phân tách giữa bài viết gốc (Post) và bình luận (Comment) thu thập từ Group
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-blue-600" aria-hidden="true" />
                <span>Bài đăng (Post)</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-xs bg-amber-500" aria-hidden="true" />
                <span>Bình luận (Comment)</span>
              </span>
            </div>
          </div>

          {dailySeries.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg">
              Chưa có dữ liệu bài đăng theo ngày. Hãy chạy Module 2 để thu thập.
            </div>
          ) : (
            <div className="relative pl-7">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-6 bottom-7 flex flex-col justify-between text-[11px] font-mono tabular-nums text-slate-400"
              >
                <div className="flex items-center gap-2 border-b border-dashed border-slate-200/80 pb-0.5">
                  <span className="w-5 text-right">{maxDailyTotal}</span>
                </div>
                <div className="flex items-center gap-2 border-b border-dashed border-slate-200/80 pb-0.5">
                  <span className="w-5 text-right">
                    {Number.isInteger(maxDailyTotal / 2)
                      ? maxDailyTotal / 2
                      : (maxDailyTotal / 2).toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 text-right">0</span>
                </div>
              </div>

              <div className="relative h-52 flex items-end justify-between gap-3 pt-6 pb-0 border-b border-slate-200">
                {dailySeries.map((point, idx) => {
                  const postHeightPct = Math.round((point.posts / maxDailyTotal) * 100);
                  const commentHeightPct = Math.round((point.comments / maxDailyTotal) * 100);
                  const isHovered = hoveredDayIdx === idx;
                  return (
                    <div
                      key={point.date}
                      onMouseEnter={() => setHoveredDayIdx(idx)}
                      onMouseLeave={() => setHoveredDayIdx(null)}
                      className="flex-1 flex flex-col items-center gap-2 h-full justify-end relative group"
                    >
                      {isHovered && (
                        <div className="absolute -top-2 z-10 bg-slate-900 text-white text-xs px-2.5 py-1 rounded-md whitespace-nowrap font-mono tabular-nums shadow-sm pointer-events-none">
                          {point.date}: {point.posts} Post · {point.comments} Comment
                        </div>
                      )}
                      <div className="w-full max-w-[44px] h-full flex items-end justify-center gap-1">
                        <div
                          className="w-4 bg-blue-600 rounded-t transition-all duration-200"
                          style={{ height: `${Math.max(postHeightPct, point.posts > 0 ? 8 : 0)}%` }}
                          title={`Posts: ${point.posts}`}
                        />
                        <div
                          className="w-4 bg-amber-500 rounded-t transition-all duration-200"
                          style={{
                            height: `${Math.max(commentHeightPct, point.comments > 0 ? 8 : 0)}%`,
                          }}
                          title={`Comments: ${point.comments}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between gap-3 pt-2">
                {dailySeries.map((point) => (
                  <div
                    key={point.date}
                    className="flex-1 text-center font-mono tabular-nums text-xs text-slate-500"
                  >
                    {point.date}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Keyword Distribution Chart */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <div className="mb-5">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Phân bổ theo từ khóa mục tiêu
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Số lượng tín hiệu khách hàng khớp theo từng từ khóa
            </p>
          </div>

          {keywordSeries.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-lg">
              Chưa có dữ liệu từ khóa.
            </div>
          ) : (
            <div className="space-y-3.5">
              {keywordSeries.map((item, idx) => {
                const widthPct = Math.round((item.count / maxKeywordCount) * 100);
                const barColors = [
                  'bg-blue-600',
                  'bg-teal-600',
                  'bg-amber-500',
                  'bg-violet-600',
                ];
                return (
                  <div key={item.keyword} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 truncate pr-3">
                        {item.keyword}
                      </span>
                      <span className="font-mono tabular-nums text-slate-600 shrink-0">
                        {item.count} kết quả
                      </span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${barColors[idx % barColors.length]} rounded-full transition-all duration-300`}
                        style={{ width: `${Math.max(widthPct, 6)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Parallel Account Fleet + Streams & Logs */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          {/* Active Streams Status */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 bg-white border-b border-slate-200 border-l-4 border-l-blue-600 flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900">
                  Trạng thái luồng cào dữ liệu &amp; tự động hóa
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  Cập nhật trực tiếp qua Server-Sent Events (SSE)
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium">
                <span
                  className={`h-2 w-2 rounded-full ${
                    sseConnected ? 'bg-emerald-600' : 'bg-amber-500'
                  }`}
                  aria-hidden="true"
                />
                <span className={sseConnected ? 'text-emerald-700' : 'text-amber-700'}>
                  {sseConnected ? 'Realtime đang kết nối' : 'Đang kết nối lại...'}
                </span>
              </div>
            </div>

            <div className="divide-y divide-slate-200">
              {streams.map((stream) => {
                const isRunning = stream.status === 'running';
                const isPaused = stream.status === 'paused';
                const pct =
                  stream.total > 0 ? Math.round((stream.progress / stream.total) * 100) : 0;

                return (
                  <div
                    key={stream.id}
                    className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-sm font-medium text-slate-900">
                          {stream.name}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium ${
                            isRunning
                              ? 'text-emerald-700'
                              : isPaused
                                ? 'text-amber-700'
                                : 'text-slate-500'
                          }`}
                        >
                          <Activity className="h-3.5 w-3.5" />
                          <span>
                            {isRunning ? 'Đang chạy' : isPaused ? 'Tạm dừng' : 'Đã dừng'}
                          </span>
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 truncate">
                        {stream.currentAction}
                      </p>
                      {stream.total > 0 && (
                        <div className="mt-2 flex items-center gap-3">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                isRunning ? 'bg-blue-600' : 'bg-slate-400'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="font-mono tabular-nums text-xs text-slate-500 shrink-0">
                            {stream.progress}/{stream.total}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isRunning ? (
                        <>
                          <button
                            type="button"
                            onClick={() => onToggleStream(stream.id, 'pause')}
                            aria-label={`Tạm dừng ${stream.name}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                          >
                            <Pause className="h-3.5 w-3.5" />
                            <span>Tạm dừng</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleStream(stream.id, 'stop')}
                            aria-label={`Dừng hẳn ${stream.name}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-xs font-medium text-red-700 hover:bg-red-50 whitespace-nowrap shrink-0"
                          >
                            <Square className="h-3.5 w-3.5" />
                            <span>Dừng</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (stream.module === 'group_finder') onNavigate('group-finder');
                            else if (stream.module === 'keyword_scanner')
                              onNavigate('keyword-scanner');
                            else if (stream.module === 'warmup_worker') onNavigate('nurture');
                            else if (stream.module === 'auto_publisher')
                              onNavigate('auto-publisher');
                            else onNavigate('ai-content');
                          }}
                          aria-label={`Mở điều khiển ${stream.name}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                        >
                          <Play className="h-3.5 w-3.5" />
                          <span>Cấu hình &amp; Chạy</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Parallel Facebook Accounts Status */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 bg-white border-b border-slate-200 border-l-4 border-l-indigo-600 flex items-center justify-between gap-4">
              <h2 className="font-display text-base font-semibold text-slate-900">
                Cụm Tài khoản Facebook chạy song song
              </h2>
              <button
                type="button"
                onClick={() => onNavigate('accounts')}
                className="text-xs font-semibold text-indigo-700 hover:underline whitespace-nowrap shrink-0"
              >
                Thêm / Cấu hình →
              </button>
            </div>
            <div className="divide-y divide-slate-200">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900">{acc.name}</span>
                      <span
                        className={`font-medium ${
                          acc.workerStatus === 'running'
                            ? 'text-emerald-700'
                            : acc.enabled
                              ? 'text-indigo-700'
                              : 'text-slate-400'
                        }`}
                      >
                        ·{' '}
                        {acc.workerStatus === 'running'
                          ? 'Đang chạy'
                          : acc.enabled
                            ? 'Sẵn sàng'
                            : 'Đang tắt'}
                      </span>
                    </div>
                    <div className="text-slate-500 mt-0.5 truncate">{acc.currentTask}</div>
                  </div>
                  <div className="font-mono tabular-nums text-slate-600 shrink-0">
                    Join {acc.joinsToday}/{acc.maxJoinsPerDay} · Cmt {acc.commentsToday}/
                    {acc.maxCommentsPerDay}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Daily Safety Quota & Recent Activity */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-6 py-4 bg-white border-b border-slate-200 border-l-4 border-l-emerald-600 flex items-center justify-between gap-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              Hạn mức an toàn hôm nay
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('safety-optimize')}
              className="text-xs font-semibold text-emerald-700 hover:underline whitespace-nowrap shrink-0"
            >
              Điều chỉnh
            </button>
          </div>

          <div className="px-6 py-4 space-y-4 border-b border-slate-200">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-600">Auto-Join Group (hôm nay)</span>
                <span className="font-mono tabular-nums font-medium text-slate-900">
                  {usageToday.joinsCount} / {safetyConfig.maxJoinsPerDay}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-teal-600 rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((usageToday.joinsCount / safetyConfig.maxJoinsPerDay) * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-600">Bình luận Auto-Comment (hôm nay)</span>
                <span className="font-mono tabular-nums font-medium text-slate-900">
                  {usageToday.commentsCount} / {safetyConfig.maxCommentsPerDay}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((usageToday.commentsCount / safetyConfig.maxCommentsPerDay) * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="text-xs text-slate-500 flex items-center justify-between pt-1">
              <span>
                Khung giờ hoạt động: {safetyConfig.activeStartHour}:00 –{' '}
                {safetyConfig.activeEndHour}:00
              </span>
              <span className="font-mono">{safetyConfig.accountWarmupStage}</span>
            </div>
          </div>

          <div className="px-6 py-3 bg-white text-xs font-semibold text-slate-800 border-b border-slate-200">
            Nhật ký thực thi gần nhất
          </div>
          <div className="divide-y divide-slate-200 flex-1 overflow-y-auto max-h-80">
            {recentLogs.slice(0, 8).map((log) => (
              <div key={log.id} className="px-6 py-3 flex items-start gap-2.5 text-xs">
                {log.level === 'error' || log.level === 'warning' ? (
                  <AlertTriangle
                    className={`h-4 w-4 shrink-0 mt-0.5 ${
                      log.level === 'error' ? 'text-red-600' : 'text-amber-600'
                    }`}
                  />
                ) : (
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="text-slate-900 leading-relaxed">{log.message}</div>
                  <div className="text-slate-600 mt-0.5 font-mono tabular-nums">
                    {log.module} · {formatShortDateTime(log.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
