import {
  Check,
  Code2,
  Copy,
  Link2,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { DailyUsage, SafetyConfig } from '../../shared/types';

interface StarterScript {
  filename: string;
  title: string;
  description: string;
  code: string;
}

interface SafetyOptimizeViewProps {
  safetyConfig: SafetyConfig | null;
  usageToday: DailyUsage | null;
  scripts: StarterScript[];
  onSaveSafety: (patch: Partial<SafetyConfig>) => Promise<void>;
}

export function SafetyOptimizeView({
  safetyConfig,
  usageToday,
  scripts,
  onSaveSafety,
}: SafetyOptimizeViewProps) {
  const [form, setForm] = useState<SafetyConfig | null>(safetyConfig);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [copiedScript, setCopiedScript] = useState<string | null>(null);

  useEffect(() => {
    if (safetyConfig) {
      setForm(safetyConfig);
    }
  }, [safetyConfig]);

  if (!form) {
    return (
      <div className="h-64 rounded-xl bg-white border border-neutral-300 animate-pulse" />
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMessage(null);
    try {
      await onSaveSafety(form);
      setSaveMessage('Đã lưu cấu hình bảo vệ tài khoản & tối ưu chiến dịch UTM.');
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Lỗi khi lưu cấu hình.');
    } finally {
      setSaving(false);
    }
  };

  const utmPreview = (() => {
    try {
      const u = new URL(
        form.targetLandingUrl.startsWith('http')
          ? form.targetLandingUrl
          : `https://${form.targetLandingUrl}`
      );
      if (form.utmSource) u.searchParams.set('utm_source', form.utmSource);
      if (form.utmMedium) u.searchParams.set('utm_medium', form.utmMedium);
      if (form.utmCampaign) u.searchParams.set('utm_campaign', form.utmCampaign);
      return u.toString();
    } catch {
      return form.targetLandingUrl;
    }
  })();

  const handleCopyCode = async (filename: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // ignore clipboard fallback
    }
    setCopiedScript(filename);
    setTimeout(() => setCopiedScript((prev) => (prev === filename ? null : prev)), 2000);
  };

  return (
    <div className="space-y-6">
      <section className="bg-white border border-neutral-300 border-t-2 border-t-red-600 rounded-xl p-6 flex items-start gap-4">
        <div className="h-11 w-11 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold text-black">
            Module 5 · Bảo vệ Tài khoản (Anti-Ban), UTM Tracking &amp; Script Automation
          </h2>
          <p className="text-sm text-neutral-800 mt-0.5">
            Thiết lập ngưỡng an toàn toàn cục, khung giờ sinh hoạt người thật, gắn UTM theo dõi chuyển đổi và tải script Playwright đa tài khoản.
          </p>
        </div>
      </section>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Anti-Ban & Account Safety */}
        <section className="lg:col-span-7 bg-white border border-neutral-300 rounded-xl p-6 space-y-5">
          <div className="flex items-start justify-between gap-4 border-b border-neutral-300 pb-4">
            <div>
              <h2 className="font-display text-base font-bold text-black flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-red-600 shrink-0 mt-1" />
                <span>Cấu hình Chống khóa tài khoản (Anti-Ban Guardrails)</span>
              </h2>
              <p className="text-xs text-neutral-800 mt-1">
                Giới hạn hạn mức hành động theo độ tuổi tài khoản, khung giờ sinh hoạt người thật và kiểm tra trùng lặp bình luận.
              </p>
            </div>
            {usageToday && (
              <div className="text-right font-mono tabular-nums text-xs font-semibold text-black shrink-0">
                <div>
                  Join hôm nay: <span className="text-blue-700">{usageToday.joinsCount}</span>/{form.maxJoinsPerDay}
                </div>
                <div>
                  Comment hôm nay: <span className="text-red-700">{usageToday.commentsCount}</span>/{form.maxCommentsPerDay}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="safety-account-name"
                className="block text-xs font-semibold text-black mb-1"
              >
                Tài khoản Facebook vận hành
              </label>
              <input
                id="safety-account-name"
                type="text"
                value={form.accountName}
                onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm text-black focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="safety-warmup-stage"
                className="block text-xs font-semibold text-black mb-1"
              >
                Giai đoạn Warm-up tài khoản
              </label>
              <select
                id="safety-warmup-stage"
                value={form.accountWarmupStage}
                onChange={(e) =>
                  setForm({
                    ...form,
                    accountWarmupStage: e.target.value as SafetyConfig['accountWarmupStage'],
                  })
                }
                className="w-full h-10 px-3 rounded-lg border border-neutral-300 text-sm text-black bg-white focus:border-blue-600 focus:outline-none"
              >
                <option value="Mới (1-7 ngày)">Mới (1-7 ngày)</option>
                <option value="Đang nuôi (8-21 ngày)">Đang nuôi (8-21 ngày)</option>
                <option value="Tin cậy (>21 ngày)">Tin cậy (&gt;21 ngày)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="safety-proxy"
                className="block text-xs font-semibold text-black mb-1"
              >
                Residential Proxy / IP cố định (tránh nhảy IP gây checkpoint)
              </label>
              <input
                id="safety-proxy"
                type="text"
                value={form.proxyEndpoint}
                onChange={(e) => setForm({ ...form, proxyEndpoint: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm font-mono text-black focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="safety-max-joins"
                className="block text-xs font-semibold text-black mb-1"
              >
                Tối đa Join Group / ngày
              </label>
              <input
                id="safety-max-joins"
                type="number"
                min={1}
                max={100}
                value={form.maxJoinsPerDay}
                onChange={(e) =>
                  setForm({ ...form, maxJoinsPerDay: Math.max(1, Number(e.target.value)) })
                }
                className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm font-mono tabular-nums text-black focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="safety-max-comments"
                className="block text-xs font-semibold text-black mb-1"
              >
                Tối đa Auto-Comment / ngày
              </label>
              <input
                id="safety-max-comments"
                type="number"
                min={1}
                max={200}
                value={form.maxCommentsPerDay}
                onChange={(e) =>
                  setForm({ ...form, maxCommentsPerDay: Math.max(1, Number(e.target.value)) })
                }
                className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm font-mono tabular-nums text-black focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="safety-delay-min"
                className="block text-xs font-semibold text-black mb-1"
              >
                Random Delay tối thiểu (giây)
              </label>
              <input
                id="safety-delay-min"
                type="number"
                min={1}
                max={30}
                value={form.delayMinSec}
                onChange={(e) =>
                  setForm({ ...form, delayMinSec: Math.max(1, Number(e.target.value)) })
                }
                className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm font-mono tabular-nums text-black focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="safety-delay-max"
                className="block text-xs font-semibold text-black mb-1"
              >
                Random Delay tối đa (giây)
              </label>
              <input
                id="safety-delay-max"
                type="number"
                min={2}
                max={120}
                value={form.delayMaxSec}
                onChange={(e) =>
                  setForm({
                    ...form,
                    delayMaxSec: Math.max(form.delayMinSec, Number(e.target.value)),
                  })
                }
                className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm font-mono tabular-nums text-black focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="safety-hour-start"
                className="block text-xs font-semibold text-black mb-1"
              >
                Giờ bắt đầu hoạt động (0-23h)
              </label>
              <input
                id="safety-hour-start"
                type="number"
                min={0}
                max={23}
                value={form.activeStartHour}
                onChange={(e) =>
                  setForm({ ...form, activeStartHour: Math.min(23, Math.max(0, Number(e.target.value))) })
                }
                className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm font-mono tabular-nums text-black focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="safety-hour-end"
                className="block text-xs font-semibold text-black mb-1"
              >
                Giờ kết thúc hoạt động (0-23h)
              </label>
              <input
                id="safety-hour-end"
                type="number"
                min={0}
                max={23}
                value={form.activeEndHour}
                onChange={(e) =>
                  setForm({ ...form, activeEndHour: Math.min(23, Math.max(0, Number(e.target.value))) })
                }
                className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm font-mono tabular-nums text-black focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-neutral-200">
            <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-red-700">
              <input
                type="checkbox"
                checked={form.autoPauseOnWarning}
                onChange={(e) => setForm({ ...form, autoPauseOnWarning: e.target.checked })}
                className="h-4 w-4 rounded border-neutral-400 accent-red-600"
              />
              <span>Tự động ngắt toàn bộ worker nếu phát hiện cảnh báo Checkpoint / 429 Rate Limit</span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-black">
              <input
                type="checkbox"
                checked={form.spintaxVariation}
                onChange={(e) => setForm({ ...form, spintaxVariation: e.target.checked })}
                className="h-4 w-4 rounded border-neutral-400 accent-blue-600"
              />
              <span>Kiểm tra độ tương đồng Jaccard chống đăng bình luận trùng lặp giữa các Group</span>
            </label>
          </div>
        </section>

        {/* Right: Marketing Optimization & UTM Attribution */}
        <section className="lg:col-span-5 bg-white border border-neutral-300 rounded-xl p-6 space-y-5">
          <div className="border-b border-neutral-300 pb-4">
            <h2 className="font-display text-base font-bold text-black flex items-start gap-2">
              <Link2 className="h-4 w-4 text-blue-600 shrink-0 mt-1" />
              <span>Tối ưu Marketing &amp; Gắn UTM Tracking</span>
            </h2>
            <p className="text-xs text-neutral-800 mt-1">
              Tự động gắn tham số UTM vào link landing page khi AI sinh bình luận để đo lường chuyển đổi trên Google Analytics.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="utm-landing-url"
                className="block text-xs font-semibold text-black mb-1"
              >
                Link Landing Page / Zalo OA / Messenger
              </label>
              <input
                id="utm-landing-url"
                type="text"
                value={form.targetLandingUrl}
                onChange={(e) => setForm({ ...form, targetLandingUrl: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm font-mono text-black focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="utm-source"
                  className="block text-xs font-semibold text-black mb-1"
                >
                  utm_source
                </label>
                <input
                  id="utm-source"
                  type="text"
                  value={form.utmSource}
                  onChange={(e) => setForm({ ...form, utmSource: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-lg border border-neutral-300 bg-white text-xs font-mono text-black focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="utm-medium"
                  className="block text-xs font-semibold text-black mb-1"
                >
                  utm_medium
                </label>
                <input
                  id="utm-medium"
                  type="text"
                  value={form.utmMedium}
                  onChange={(e) => setForm({ ...form, utmMedium: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-lg border border-neutral-300 bg-white text-xs font-mono text-black focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="utm-campaign"
                  className="block text-xs font-semibold text-black mb-1"
                >
                  utm_campaign
                </label>
                <input
                  id="utm-campaign"
                  type="text"
                  value={form.utmCampaign}
                  onChange={(e) => setForm({ ...form, utmCampaign: e.target.value })}
                  className="w-full h-9 px-2.5 rounded-lg border border-neutral-300 bg-white text-xs font-mono text-black focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-white border border-blue-600">
              <div className="text-xs font-bold text-black mb-1">Link UTM hoàn chỉnh:</div>
              <div className="text-xs font-mono font-semibold text-blue-700 break-all">{utmPreview}</div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Đang lưu...' : 'Lưu cấu hình An toàn & UTM'}</span>
            </button>

            {saveMessage && (
              <div
                role="status"
                className="px-3 py-2 rounded-lg bg-white border-2 border-blue-600 text-xs font-semibold text-blue-700"
              >
                {saveMessage}
              </div>
            )}
          </div>
        </section>
      </form>

      {/* Starter Scripts & Architecture Reference */}
      <section className="bg-white border border-neutral-300 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-300">
          <h2 className="font-display text-base font-bold text-black flex items-start gap-2">
            <Code2 className="h-4 w-4 text-blue-600 shrink-0 mt-1" />
            <span>Script Khởi tạo Browser Automation (Playwright) &amp; Database SQL</span>
          </h2>
          <p className="text-xs text-neutral-800 mt-0.5">
            Sao chép để chạy trực tiếp Worker Playwright với Cookie phiên Facebook nội bộ của bạn.
          </p>
        </div>

        <div className="divide-y divide-neutral-200">
          {scripts.map((sc) => (
            <div key={sc.filename} className="p-6 space-y-3 bg-white">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-black">{sc.title}</h3>
                  <p className="text-xs text-neutral-800 mt-0.5">{sc.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyCode(sc.filename, sc.code)}
                  aria-label={`Sao chép mã ${sc.filename}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-600 bg-white text-xs font-semibold text-blue-700 hover:bg-blue-600 hover:text-white whitespace-nowrap shrink-0 self-start sm:self-auto transition-colors"
                >
                  {copiedScript === sc.filename ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Đã sao chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy Script</span>
                    </>
                  )}
                </button>
              </div>

              <pre className="p-4 rounded-lg bg-black border border-black text-white text-xs font-mono overflow-x-auto leading-relaxed">
                <code>{sc.code}</code>
              </pre>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
