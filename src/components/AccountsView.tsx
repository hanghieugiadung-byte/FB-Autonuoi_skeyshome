import {
  CheckCircle2,
  ExternalLink,
  KeyRound,
  PauseCircle,
  PlayCircle,
  Plus,
  Server,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { useState } from 'react';
import type { FacebookAccount } from '../../shared/types';

interface AccountsViewProps {
  accounts: FacebookAccount[];
  onAddAccount: (payload: {
    name: string;
    fbUid: string;
    cookieData: string;
    proxyEndpoint: string;
    warmupStage: FacebookAccount['warmupStage'];
    maxJoinsPerDay: number;
    maxCommentsPerDay: number;
  }) => Promise<void>;
  onToggleAccount: (id: string) => Promise<void>;
  onDeleteAccount: (id: string) => Promise<void>;
}

export function AccountsView({
  accounts,
  onAddAccount,
  onToggleAccount,
  onDeleteAccount,
}: AccountsViewProps) {
  const [name, setName] = useState('');
  const [fbUid, setFbUid] = useState('');
  const [cookieData, setCookieData] = useState('');
  const [proxyEndpoint, setProxyEndpoint] = useState('socks5://vn-hcm-res-04.proxy:1080');
  const [warmupStage, setWarmupStage] =
    useState<FacebookAccount['warmupStage']>('Đang nuôi (8-21 ngày)');
  const [maxJoinsPerDay, setMaxJoinsPerDay] = useState(8);
  const [maxCommentsPerDay, setMaxCommentsPerDay] = useState(15);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const enabledCount = accounts.filter((a) => a.enabled).length;
  const runningCount = accounts.filter((a) => a.workerStatus === 'running').length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!name.trim() || !fbUid.trim() || !cookieData.trim()) {
      setFeedback({
        type: 'err',
        text: 'Vui lòng nhập đầy đủ Tên tài khoản, Facebook UID và chuỗi Cookie phiên đăng nhập.',
      });
      return;
    }
    setSubmitting(true);
    try {
      await onAddAccount({
        name: name.trim(),
        fbUid: fbUid.trim(),
        cookieData: cookieData.trim(),
        proxyEndpoint: proxyEndpoint.trim(),
        warmupStage,
        maxJoinsPerDay,
        maxCommentsPerDay,
      });
      setName('');
      setFbUid('');
      setCookieData('');
      setFeedback({
        type: 'ok',
        text: 'Đã thêm tài khoản Facebook mới và sẵn sàng chạy song song cùng cụm tài khoản.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Không thể thêm tài khoản.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Pure White Header Banner with Blue Accent */}
      <section className="bg-white border border-neutral-300 border-t-2 border-t-blue-600 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-black">
              Cấu hình &amp; Điều phối Đa Tài khoản Facebook (Chạy Song Song)
            </h2>
            <p className="text-sm text-neutral-800 mt-0.5">
              Thêm nhiều tài khoản với Cookie + Proxy riêng biệt để chia tải tìm kiếm Group, Auto-Join và quét bài đồng thời.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 shrink-0 font-mono tabular-nums text-xs">
          <div>
            <div className="text-neutral-800 font-semibold">Tài khoản đang bật</div>
            <div className="text-lg font-bold text-blue-700">
              {enabledCount} / {accounts.length}
            </div>
          </div>
          <div className="h-8 w-px bg-neutral-300" aria-hidden="true" />
          <div>
            <div className="text-neutral-800 font-semibold">Đang chạy song song</div>
            <div className="text-lg font-bold text-red-700">{runningCount} luồng</div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Add New Account Form */}
        <section className="lg:col-span-5 bg-white border border-neutral-300 rounded-xl p-6">
          <h3 className="font-display text-base font-bold text-black mb-4">
            Thêm tài khoản Facebook mới
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="acc-name-input"
                className="block text-xs font-bold text-black mb-1"
              >
                Tên gợi nhớ tài khoản
              </label>
              <input
                id="acc-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Lan Hương Seeding (Acc #04)"
                className="w-full h-10 px-3 rounded-lg border border-neutral-400 bg-white text-sm text-black placeholder:text-neutral-500 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="acc-uid-input"
                  className="block text-xs font-bold text-black mb-1"
                >
                  Facebook UID
                </label>
                <input
                  id="acc-uid-input"
                  type="text"
                  value={fbUid}
                  onChange={(e) => setFbUid(e.target.value)}
                  placeholder="100089123456789"
                  className="w-full h-10 px-3 rounded-lg border border-neutral-400 bg-white text-sm font-mono text-black placeholder:text-neutral-500 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="acc-warmup-select"
                  className="block text-xs font-bold text-black mb-1"
                >
                  Độ tin cậy (Warm-up)
                </label>
                <select
                  id="acc-warmup-select"
                  value={warmupStage}
                  onChange={(e) =>
                    setWarmupStage(e.target.value as FacebookAccount['warmupStage'])
                  }
                  className="w-full h-10 px-3 rounded-lg border border-neutral-400 bg-white text-sm text-black focus:border-blue-600 focus:outline-none"
                >
                  <option value="Mới (1-7 ngày)">Mới (1-7 ngày)</option>
                  <option value="Đang nuôi (8-21 ngày)">Đang nuôi (8-21 ngày)</option>
                  <option value="Tin cậy (>21 ngày)">Tin cậy (&gt;21 ngày)</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="acc-cookie-input"
                className="block text-xs font-bold text-black mb-1"
              >
                Chuỗi Cookie phiên đăng nhập (c_user, xs, datr)
              </label>
              <textarea
                id="acc-cookie-input"
                rows={3}
                value={cookieData}
                onChange={(e) => setCookieData(e.target.value)}
                placeholder="c_user=100089...; xs=42%3A...; datr=..."
                className="w-full p-3 rounded-lg border border-neutral-400 bg-white text-xs font-mono text-black placeholder:text-neutral-500 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="acc-proxy-input"
                className="block text-xs font-bold text-black mb-1"
              >
                Proxy riêng cho tài khoản (SOCKS5 / HTTP)
              </label>
              <input
                id="acc-proxy-input"
                type="text"
                value={proxyEndpoint}
                onChange={(e) => setProxyEndpoint(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-neutral-400 bg-white text-xs font-mono text-black focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="acc-max-joins"
                  className="block text-xs font-bold text-black mb-1"
                >
                  Max Join / ngày
                </label>
                <input
                  id="acc-max-joins"
                  type="number"
                  min={1}
                  max={50}
                  value={maxJoinsPerDay}
                  onChange={(e) => setMaxJoinsPerDay(Math.max(1, Number(e.target.value)))}
                  className="w-full h-10 px-3 rounded-lg border border-neutral-400 text-sm font-mono tabular-nums text-black focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="acc-max-comments"
                  className="block text-xs font-bold text-black mb-1"
                >
                  Max Comment / ngày
                </label>
                <input
                  id="acc-max-comments"
                  type="number"
                  min={1}
                  max={100}
                  value={maxCommentsPerDay}
                  onChange={(e) => setMaxCommentsPerDay(Math.max(1, Number(e.target.value)))}
                  className="w-full h-10 px-3 rounded-lg border border-neutral-400 text-sm font-mono tabular-nums text-black focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>{submitting ? 'Đang lưu...' : 'Thêm tài khoản Facebook'}</span>
            </button>

            {feedback && (
              <div
                role={feedback.type === 'err' ? 'alert' : 'status'}
                className={`px-3.5 py-2.5 rounded-lg border-2 bg-white text-xs font-semibold ${
                  feedback.type === 'err'
                    ? 'border-red-600 text-red-700'
                    : 'border-blue-600 text-blue-700'
                }`}
              >
                {feedback.text}
              </div>
            )}
          </form>
        </section>

        {/* Accounts List Grid */}
        <section className="lg:col-span-7 space-y-4">
          {accounts.map((acc) => {
            const isRunning = acc.workerStatus === 'running';
            return (
              <article
                key={acc.id}
                className={`bg-white border rounded-xl p-5 transition-colors ${
                  acc.enabled ? 'border-neutral-300' : 'border-neutral-300 opacity-75'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-display text-sm font-bold text-black">
                        {acc.name}
                      </h3>
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-bold ${
                          isRunning
                            ? 'text-red-700'
                            : acc.enabled
                              ? 'text-blue-700'
                              : 'text-neutral-700'
                        }`}
                      >
                        {isRunning ? (
                          <PlayCircle className="h-3.5 w-3.5" />
                        ) : acc.enabled ? (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                          <PauseCircle className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {isRunning
                            ? 'Đang chạy song song'
                            : acc.enabled
                              ? 'Sẵn sàng'
                              : 'Đang tắt'}
                        </span>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-800">
                      <a
                        href={acc.profileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono font-semibold text-blue-700 hover:underline"
                      >
                        <span>UID: {acc.fbUid}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-black">{acc.warmupStage}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums font-bold text-red-700">
                        Trust {acc.trustScore}% (Ngày {acc.warmupDays})
                      </span>
                      <span aria-hidden="true">·</span>
                      <span
                        className={`font-bold ${
                          acc.adAccountStatus === 'Sẵn sàng chạy Ads'
                            ? 'text-blue-700'
                            : 'text-red-700'
                        }`}
                      >
                        {acc.adAccountStatus}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleAccount(acc.id)}
                      aria-label={`${acc.enabled ? 'Tạm tắt' : 'Kích hoạt'} tài khoản ${acc.name}`}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold whitespace-nowrap shrink-0 transition-colors ${
                        acc.enabled
                          ? 'border-blue-600 bg-white text-blue-700 hover:bg-blue-600 hover:text-white'
                          : 'border-neutral-300 bg-white text-black hover:border-blue-600'
                      }`}
                    >
                      {acc.enabled ? 'Đang kích hoạt' : 'Bật lại'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteAccount(acc.id)}
                      aria-label={`Xóa tài khoản ${acc.name}`}
                      className="p-1.5 rounded-lg border border-neutral-300 bg-white text-black hover:text-red-600 hover:border-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Quota & Infra Details */}
                <div className="mt-4 pt-4 border-t border-neutral-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-neutral-900 font-mono truncate">
                      <Server className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">{acc.proxyEndpoint}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-900">
                      <KeyRound className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span className="font-semibold text-black">Cookie: {acc.cookieStatus}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate text-neutral-800">{acc.currentTask}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 font-mono tabular-nums">
                    <div>
                      <div className="flex justify-between font-semibold text-black mb-1">
                        <span>Join</span>
                        <span>
                          {acc.joinsToday}/{acc.maxJoinsPerDay}
                        </span>
                      </div>
                      <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round((acc.joinsToday / acc.maxJoinsPerDay) * 100)
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between font-semibold text-black mb-1">
                        <span>Comment</span>
                        <span>
                          {acc.commentsToday}/{acc.maxCommentsPerDay}
                        </span>
                      </div>
                      <div className="h-1.5 bg-neutral-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-600 rounded-full"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.round((acc.commentsToday / acc.maxCommentsPerDay) * 100)
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </div>
  );
}
