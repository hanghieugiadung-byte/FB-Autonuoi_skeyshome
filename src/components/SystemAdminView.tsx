import { Database, KeyRound, Lock, Save, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { DatabaseStats, SystemSettings } from '../../shared/types';
import { apiFetch } from '../utils/authToken';

interface SystemAdminViewProps {
  systemSettings: SystemSettings | null;
  onSystemSettingsUpdated: (next: SystemSettings) => void;
  onLockApp: () => void;
}

export function SystemAdminView({
  systemSettings: initialSettings,
  onSystemSettingsUpdated,
  onLockApp,
}: SystemAdminViewProps) {
  const [settingsForm, setSettingsForm] = useState<SystemSettings | null>(initialSettings);
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  // Passcode Change State
  const [currentPasscode, setCurrentPasscode] = useState('');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingOverview(true);
    apiFetch('/api/admin/overview')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        if (data.systemSettings) setSettingsForm(data.systemSettings);
        if (data.dbStats) setDbStats(data.dbStats);
      })
      .finally(() => {
        if (!cancelled) setLoadingOverview(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (initialSettings && !settingsForm) {
      setSettingsForm(initialSettings);
    }
  }, [initialSettings, settingsForm]);

  const handleChangePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!currentPasscode.trim()) {
      setFeedback({ type: 'err', text: 'Vui lòng nhập mật mã hiện tại.' });
      return;
    }
    if (newPasscode.trim().length < 4) {
      setFeedback({ type: 'err', text: 'Mật mã mới phải có tối thiểu 4 ký tự.' });
      return;
    }
    if (newPasscode.trim() !== confirmPasscode.trim()) {
      setFeedback({ type: 'err', text: 'Xác nhận mật mã mới không khớp.' });
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch('/api/auth/change-passcode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPasscode: currentPasscode.trim(),
          newPasscode: newPasscode.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Đổi mật mã thất bại.');
      setCurrentPasscode('');
      setNewPasscode('');
      setConfirmPasscode('');
      setFeedback({
        type: 'ok',
        text: 'Đã đổi mật mã truy cập mới thành công! Lần truy cập tiếp theo sẽ dùng mật mã này.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Không thể đổi mật mã.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSystemSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsForm) return;
    setFeedback(null);
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể lưu cài đặt hệ thống.');
      setSettingsForm(data.systemSettings);
      if (data.dbStats) setDbStats(data.dbStats);
      onSystemSettingsUpdated(data.systemSettings);
      setFeedback({ type: 'ok', text: 'Đã lưu cấu hình Hệ thống vào SQLite.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Lỗi lưu cài đặt.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <section className="bg-white border border-neutral-300 border-t-2 border-t-blue-600 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-black">
              Cài đặt Hệ thống &amp; Mật mã Truy cập
            </h2>
            <p className="text-sm text-neutral-800 mt-0.5">
              Sử dụng chế độ cá nhân 1 người dùng — bảo vệ truy cập bằng mật mã (mặc định <span className="font-mono font-bold text-blue-700">8889</span>) và tùy chỉnh thông số Workspace.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onLockApp}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-600 bg-white hover:bg-red-600 hover:text-white text-xs font-bold text-red-700 whitespace-nowrap shrink-0 self-start sm:self-auto transition-colors"
        >
          <Lock className="h-3.5 w-3.5" />
          <span>Khóa ứng dụng ngay</span>
        </button>
      </section>

      {feedback && (
        <div
          role={feedback.type === 'err' ? 'alert' : 'status'}
          className={`px-4 py-3 rounded-xl border-2 bg-white text-xs font-semibold ${
            feedback.type === 'err'
              ? 'border-red-600 text-red-700'
              : 'border-blue-600 text-blue-700'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* SQLite Stats Strip */}
      {dbStats && (
        <section
          aria-label="Thống kê dữ liệu SQLite"
          className="grid grid-cols-2 sm:grid-cols-4 gap-4"
        >
          {[
            {
              label: 'Nick FB & Fanpage',
              value: dbStats.accountsCount + dbStats.fanpagesCount,
              sub: `${dbStats.accountsCount} Nick · ${dbStats.fanpagesCount} Page`,
              accent: 'blue',
            },
            {
              label: 'Group & Bài quét',
              value: dbStats.groupsCount + dbStats.postsCount,
              sub: `${dbStats.groupsCount} Group · ${dbStats.postsCount} Post`,
              accent: 'red',
            },
            {
              label: 'Kho RAG & Lịch AI',
              value: dbStats.knowledgeDocsCount + dbStats.scheduledPostsCount,
              sub: `${dbStats.knowledgeDocsCount} RAG · ${dbStats.scheduledPostsCount} Lịch`,
              accent: 'blue',
            },
            {
              label: 'Nhật ký Hệ thống',
              value: dbStats.logsCount,
              sub: loadingOverview ? 'Đang đồng bộ...' : 'Lưu trữ SQLite cục bộ',
              accent: 'red',
            },
          ].map((card) => (
            <div
              key={card.label}
              className={`bg-white border border-neutral-300 border-t-2 ${
                card.accent === 'red' ? 'border-t-red-600' : 'border-t-blue-600'
              } rounded-xl p-4`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-black">
                <span>{card.label}</span>
                <Database
                  className={`h-4 w-4 ${
                    card.accent === 'red' ? 'text-red-600' : 'text-blue-600'
                  }`}
                />
              </div>
              <div className="mt-1 font-mono tabular-nums text-2xl font-bold text-black">
                {card.value}
              </div>
              <div className="text-xs text-neutral-800 mt-1 font-mono">{card.sub}</div>
            </div>
          ))}
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Passcode Management */}
        <section className="lg:col-span-5 bg-white border border-neutral-300 rounded-xl p-6 space-y-4">
          <div className="border-b border-neutral-300 pb-3">
            <h3 className="font-display text-base font-bold text-black flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-red-600" />
              <span>Đổi Mật mã Truy cập</span>
            </h3>
            <p className="text-xs text-neutral-800 mt-1">
              Mật mã này được yêu cầu mỗi lần mở ứng dụng. Mặc định ban đầu là{' '}
              <span className="font-mono font-bold text-blue-700">8889</span>.
            </p>
          </div>

          <form onSubmit={handleChangePasscode} className="space-y-4">
            <div>
              <label
                htmlFor="current-passcode"
                className="block text-xs font-semibold text-black mb-1"
              >
                Mật mã hiện tại
              </label>
              <input
                id="current-passcode"
                type="password"
                value={currentPasscode}
                onChange={(e) => setCurrentPasscode(e.target.value)}
                placeholder="Nhập mật mã hiện tại (mặc định 8889)..."
                className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm font-mono text-black focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="new-passcode"
                className="block text-xs font-semibold text-black mb-1"
              >
                Mật mã mới (tối thiểu 4 ký tự)
              </label>
              <input
                id="new-passcode"
                type="password"
                value={newPasscode}
                onChange={(e) => setNewPasscode(e.target.value)}
                placeholder="Ví dụ: 9999 hoặc mật mã riêng..."
                className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm font-mono text-black focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="confirm-passcode"
                className="block text-xs font-semibold text-black mb-1"
              >
                Xác nhận mật mã mới
              </label>
              <input
                id="confirm-passcode"
                type="password"
                value={confirmPasscode}
                onChange={(e) => setConfirmPasscode(e.target.value)}
                placeholder="Nhập lại mật mã mới..."
                className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm font-mono text-black focus:border-blue-600 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Đang cập nhật...' : 'Cập nhật Mật mã mới'}</span>
            </button>
          </form>
        </section>

        {/* Right: General Workspace Setup */}
        {settingsForm && (
          <form
            onSubmit={handleSaveSystemSettings}
            className="lg:col-span-7 bg-white border border-neutral-300 rounded-xl p-6 space-y-5"
          >
            <div className="border-b border-neutral-300 pb-3">
              <h3 className="font-display text-base font-bold text-black">
                Thông số Workspace &amp; Tự động hóa
              </h3>
              <p className="text-xs text-neutral-800 mt-0.5">
                Tùy chỉnh tên Workspace, múi giờ chạy lịch AI, luồng chạy song song và Proxy Pool mặc định.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="sys-workspace-name"
                  className="block text-xs font-semibold text-black mb-1"
                >
                  Tên Workspace hiển thị
                </label>
                <input
                  id="sys-workspace-name"
                  type="text"
                  value={settingsForm.workspaceName}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, workspaceName: e.target.value })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm text-black focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="sys-company-name"
                  className="block text-xs font-semibold text-black mb-1"
                >
                  Mô tả / Dự án vận hành
                </label>
                <input
                  id="sys-company-name"
                  type="text"
                  value={settingsForm.companyName}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, companyName: e.target.value })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm text-black focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="sys-timezone"
                  className="block text-xs font-semibold text-black mb-1"
                >
                  Múi giờ mặc định (Lịch đăng AI)
                </label>
                <select
                  id="sys-timezone"
                  value={settingsForm.defaultTimezone}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, defaultTimezone: e.target.value })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm text-black focus:border-blue-600 focus:outline-none"
                >
                  <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (GMT+7)</option>
                  <option value="Asia/Bangkok">Asia/Bangkok (GMT+7)</option>
                  <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
                  <option value="UTC">UTC (GMT+0)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="sys-ai-model"
                  className="block text-xs font-semibold text-black mb-1"
                >
                  Mô hình Gemini AI mặc định
                </label>
                <input
                  id="sys-ai-model"
                  type="text"
                  value={settingsForm.aiModelName}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, aiModelName: e.target.value })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm font-mono text-black focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="sys-max-workers"
                  className="block text-xs font-semibold text-black mb-1"
                >
                  Số luồng tài khoản chạy song song tối đa
                </label>
                <input
                  id="sys-max-workers"
                  type="number"
                  min={1}
                  max={20}
                  value={settingsForm.maxConcurrentWorkers}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      maxConcurrentWorkers: Math.max(1, Number(e.target.value)),
                    })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm font-mono tabular-nums text-black focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="sys-session-hours"
                  className="block text-xs font-semibold text-black mb-1"
                >
                  Thời hạn tối đa 1 phiên mở khóa (giờ)
                </label>
                <input
                  id="sys-session-hours"
                  type="number"
                  min={1}
                  max={720}
                  value={settingsForm.sessionTimeoutHours}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      sessionTimeoutHours: Math.max(1, Number(e.target.value)),
                    })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm font-mono tabular-nums text-black focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="sys-proxy-pool"
                  className="block text-xs font-semibold text-black mb-1"
                >
                  Proxy Pool mặc định khi khởi tạo Nick FB mới
                </label>
                <input
                  id="sys-proxy-pool"
                  type="text"
                  value={settingsForm.defaultProxyPool}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, defaultProxyPool: e.target.value })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm font-mono text-black focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-neutral-200 text-xs">
              <label className="flex items-center gap-2.5 cursor-pointer text-black font-medium">
                <input
                  type="checkbox"
                  checked={settingsForm.autoSchedulerEnabled}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, autoSchedulerEnabled: e.target.checked })
                  }
                  className="h-4 w-4 accent-blue-600 rounded"
                />
                <span>Bật bộ lập lịch Auto-Publisher tự động quét &amp; đăng bài đến hạn</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-black font-medium">
                <input
                  type="checkbox"
                  checked={settingsForm.requireApprovalBeforePost}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      requireApprovalBeforePost: e.target.checked,
                    })
                  }
                  className="h-4 w-4 accent-blue-600 rounded"
                />
                <span>Yêu cầu kiểm duyệt nội dung trước khi kích hoạt Auto-Comment hàng loạt</span>
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="h-10 px-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? 'Đang lưu...' : 'Lưu Cài đặt Hệ thống'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
