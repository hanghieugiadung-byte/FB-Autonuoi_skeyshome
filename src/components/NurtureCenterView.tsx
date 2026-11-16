import {
  CheckCircle2,
  ExternalLink,
  Flag,
  Flame,
  KeyRound,
  Mail,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Square,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  AutomationStream,
  FacebookAccount,
  Fanpage,
} from '../../shared/types';
import { formatNumberVi } from '../utils/formatters';

interface NurtureCenterViewProps {
  accounts: FacebookAccount[];
  fanpages: Fanpage[];
  warmupStream?: AutomationStream;
  onGeneratePersona: () => Promise<{
    name: string;
    fbUid: string;
    recoveryEmail: string;
    twoFactorSecret: string;
    proxyEndpoint: string;
    cookieData: string;
    warmupStage: FacebookAccount['warmupStage'];
    maxJoinsPerDay: number;
    maxCommentsPerDay: number;
  }>;
  onCreateAccount: (payload: {
    name: string;
    fbUid: string;
    cookieData: string;
    proxyEndpoint: string;
    warmupStage: FacebookAccount['warmupStage'];
    recoveryEmail: string;
    twoFactorSecret: string;
    maxJoinsPerDay: number;
    maxCommentsPerDay: number;
  }) => Promise<void>;
  onCreateFanpage: (payload: {
    ownerAccountId: string;
    name: string;
    category: string;
    description: string;
    pageSlug?: string;
    followersCount?: number;
  }) => Promise<void>;
  onToggleFanpage: (id: string) => Promise<void>;
  onDeleteFanpage: (id: string) => Promise<void>;
  onStartWarmup: (params: { accountIds: string[]; pageIds: string[] }) => Promise<void>;
  onStopWarmup: () => Promise<void>;
}

function getDailyChecklist(type: 'profile' | 'page', warmupDays: number): string[] {
  if (type === 'profile') {
    if (warmupDays <= 7) {
      return [
        'Lướt News Feed tự nhiên 3-5 phút',
        'Xem 2 video Reels/Watch không tua nhanh',
        'Thả cảm xúc nhẹ 3 bài viết uy tín',
      ];
    }
    if (warmupDays <= 21) {
      return [
        'Bình luận tương tác tự nhiên không chứa link',
        'Tham gia 2 Group cùng tệp khách hàng',
        'Tạo bài viết ngắn chia sẻ kinh nghiệm trên tường',
      ];
    }
    return [
      'Duy trì độ Trust > 85% để chuẩn bị tạo BM/TKQC',
      'Kiểm tra Account Quality & liên kết Fanpage',
    ];
  }
  if (warmupDays <= 7) {
    return [
      'Chuẩn hóa mô tả SEO & nút Nhắn tin Page',
      'Mời bạn bè từ Nick chủ sở hữu thích Fanpage',
      'Đăng bài chia sẻ giá trị thuần túy',
    ];
  }
  return [
    'Đăng đều bài AI hàng ngày giữ Reach tự nhiên',
    'Sẵn sàng gắn Business Manager chạy Ads chuyển đổi',
  ];
}

export function NurtureCenterView({
  accounts,
  fanpages,
  warmupStream,
  onGeneratePersona,
  onCreateAccount,
  onCreateFanpage,
  onToggleFanpage,
  onDeleteFanpage,
  onStartWarmup,
  onStopWarmup,
}: NurtureCenterViewProps) {
  const [createMode, setCreateMode] = useState<'profile' | 'page'>('page');

  // Create FB Account state
  const [accName, setAccName] = useState('');
  const [fbUid, setFbUid] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [twoFactorSecret, setTwoFactorSecret] = useState('');
  const [proxyEndpoint, setProxyEndpoint] = useState('socks5://vn-hcm-res-05.proxy:1080');
  const [cookieData, setCookieData] = useState('');
  const [warmupStage, setWarmupStage] =
    useState<FacebookAccount['warmupStage']>('Mới (1-7 ngày)');
  const [generatingPersona, setGeneratingPersona] = useState(false);

  // Create Fanpage state
  const [ownerAccountId, setOwnerAccountId] = useState(accounts[0]?.id ?? '');
  const [pageName, setPageName] = useState('');
  const [pageCategory, setPageCategory] = useState('Đồ gia dụng & Thiết bị thông minh');
  const [pageSlug, setPageSlug] = useState('');
  const [pageDescription, setPageDescription] = useState('');

  // Selection for Warmup Runner
  const [selectedAccIds, setSelectedAccIds] = useState<string[]>(() =>
    accounts.filter((a) => a.enabled).map((a) => a.id)
  );
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>(() =>
    fanpages.filter((p) => p.enabled).map((p) => p.id)
  );

  useEffect(() => {
    if (!ownerAccountId && accounts.length > 0) {
      setOwnerAccountId(accounts[0].id);
    }
  }, [accounts, ownerAccountId]);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const isRunning = warmupStream?.status === 'running';
  const readyProfilesCount = accounts.filter(
    (a) => a.adAccountStatus === 'Sẵn sàng chạy Ads'
  ).length;
  const readyPagesCount = fanpages.filter((p) => p.adReadiness === 'Sẵn sàng chạy Ads').length;

  const handleGenerateSamplePersona = async () => {
    setFeedback(null);
    setGeneratingPersona(true);
    try {
      const persona = await onGeneratePersona();
      setAccName(persona.name);
      setFbUid(persona.fbUid);
      setRecoveryEmail(persona.recoveryEmail);
      setTwoFactorSecret(persona.twoFactorSecret);
      setProxyEndpoint(persona.proxyEndpoint);
      setCookieData(persona.cookieData);
      setWarmupStage(persona.warmupStage);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Không thể sinh profile mẫu.',
      });
    } finally {
      setGeneratingPersona(false);
    }
  };

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!accName.trim() || !fbUid.trim() || !cookieData.trim()) {
      setFeedback({
        type: 'err',
        text: 'Vui lòng nhập hoặc nhấn "Tạo nhanh Profile mẫu" trước khi lưu.',
      });
      return;
    }
    setSubmitting(true);
    try {
      await onCreateAccount({
        name: accName.trim(),
        fbUid: fbUid.trim(),
        cookieData: cookieData.trim(),
        proxyEndpoint: proxyEndpoint.trim(),
        warmupStage,
        recoveryEmail: recoveryEmail.trim(),
        twoFactorSecret: twoFactorSecret.trim(),
        maxJoinsPerDay: 4,
        maxCommentsPerDay: 8,
      });
      setAccName('');
      setFbUid('');
      setRecoveryEmail('');
      setTwoFactorSecret('');
      setCookieData('');
      setFeedback({
        type: 'ok',
        text: 'Đã tạo hồ sơ Nick FB mới và đưa vào hệ thống nuôi tự động!',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Không thể tạo Nick FB.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitFanpage = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!ownerAccountId || !pageName.trim()) {
      setFeedback({
        type: 'err',
        text: 'Vui lòng chọn Tài khoản sở hữu và nhập Tên Fanpage.',
      });
      return;
    }
    setSubmitting(true);
    try {
      await onCreateFanpage({
        ownerAccountId,
        name: pageName.trim(),
        category: pageCategory.trim(),
        description: pageDescription.trim(),
        pageSlug: pageSlug.trim() || undefined,
      });
      setPageName('');
      setPageSlug('');
      setPageDescription('');
      setFeedback({
        type: 'ok',
        text: 'Đã khởi tạo Fanpage mới thành công — sẵn sàng nuôi tương tác & lên lịch đăng bài AI.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Không thể tạo Fanpage.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSelectAccount = (id: string) => {
    setSelectedAccIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectPage = (id: string) => {
    setSelectedPageIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllTargets = () => {
    setSelectedAccIds(accounts.filter((a) => a.enabled).map((a) => a.id));
    setSelectedPageIds(fanpages.filter((p) => p.enabled).map((p) => p.id));
  };

  const handleRunWarmup = async () => {
    setFeedback(null);
    try {
      await onStartWarmup({
        accountIds: selectedAccIds,
        pageIds: selectedPageIds,
      });
      setFeedback({
        type: 'ok',
        text: `Đang chạy kịch bản nuôi tương tác cho ${selectedAccIds.length} Nick FB và ${selectedPageIds.length} Fanpage.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Không thể chạy phiên nuôi.',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Pure White Header Banner with Rose Accent */}
      <section className="bg-white border border-slate-200 border-l-4 border-l-rose-600 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Tạo &amp; Nuôi Nick FB, Fanpage (Chuẩn bị Chiến dịch Quảng cáo)
            </h2>
            <p className="text-sm text-slate-700 mt-0.5">
              Khởi tạo hồ sơ Nick FB kèm 2FA/Proxy, tạo Fanpage vệ tinh và chạy kịch bản nuôi Trust tự nhiên để sẵn sàng lên Camp Ads bền vững.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5 shrink-0 font-mono tabular-nums text-xs">
          <div>
            <div className="text-slate-600">Nick FB đạt chuẩn Ads</div>
            <div className="text-lg font-semibold text-rose-700">
              {readyProfilesCount} / {accounts.length}
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200" aria-hidden="true" />
          <div>
            <div className="text-slate-600">Fanpage đạt chuẩn Ads</div>
            <div className="text-lg font-semibold text-emerald-700">
              {readyPagesCount} / {fanpages.length}
            </div>
          </div>
        </div>
      </section>

      {/* Warmup Action Control Strip */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span>Trình chạy Nuôi Tương tác Tự động (Warm-up Worker)</span>
            {isRunning && (
              <span className="text-xs font-medium text-emerald-700">· Đang chạy realtime</span>
            )}
          </div>
          <p className="text-xs text-slate-600 truncate">
            {warmupStream?.currentAction ||
              'Tick chọn các Nick FB hoặc Fanpage bên dưới rồi nhấn Chạy phiên nuôi để tăng Trust Score & Follower tự nhiên.'}
          </p>
          {warmupStream && warmupStream.total > 0 && isRunning && (
            <div className="pt-1 flex items-center gap-3 max-w-md">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-600 transition-all duration-300"
                  style={{
                    width: `${Math.round((warmupStream.progress / warmupStream.total) * 100)}%`,
                  }}
                />
              </div>
              <span className="font-mono tabular-nums text-xs text-slate-500">
                {warmupStream.progress}/{warmupStream.total}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleSelectAllTargets}
            className="h-9 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap"
          >
            Chọn tất cả ({accounts.filter((a) => a.enabled).length} Nick +{' '}
            {fanpages.filter((p) => p.enabled).length} Page)
          </button>

          {isRunning ? (
            <button
              type="button"
              onClick={onStopWarmup}
              className="h-9 px-4 inline-flex items-center gap-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold whitespace-nowrap"
            >
              <Square className="h-3.5 w-3.5" />
              <span>Dừng phiên nuôi</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRunWarmup}
              className="h-9 px-4 inline-flex items-center gap-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold whitespace-nowrap"
            >
              <Play className="h-3.5 w-3.5" />
              <span>
                Chạy phiên nuôi ({selectedAccIds.length + selectedPageIds.length} mục)
              </span>
            </button>
          )}
        </div>
      </section>

      {feedback && (
        <div
          role={feedback.type === 'err' ? 'alert' : 'status'}
          className={`px-4 py-3 rounded-xl border text-xs font-medium ${
            feedback.type === 'err'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}
        >
          {feedback.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Creation Forms (Nick FB & Fanpage) */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-2 border-b border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => setCreateMode('page')}
              className={`py-3 px-4 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
                createMode === 'page'
                  ? 'border-rose-600 text-rose-700 bg-white'
                  : 'border-transparent text-slate-700 hover:text-slate-900'
              }`}
            >
              <Flag className="h-3.5 w-3.5" />
              <span>Tạo Fanpage Ads</span>
            </button>
            <button
              type="button"
              onClick={() => setCreateMode('profile')}
              className={`py-3 px-4 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition-colors ${
                createMode === 'profile'
                  ? 'border-rose-600 text-rose-700 bg-white'
                  : 'border-transparent text-slate-700 hover:text-slate-900'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Tạo Nick FB mới</span>
            </button>
          </div>

          <div className="p-6">
            {createMode === 'profile' ? (
              <form onSubmit={handleSubmitProfile} className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    Khởi tạo Hồ sơ Nick FB (Nuôi Ads)
                  </h3>
                  <button
                    type="button"
                    onClick={handleGenerateSamplePersona}
                    disabled={generatingPersona}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 text-xs font-semibold whitespace-nowrap"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{generatingPersona ? 'Đang tạo...' : 'Tạo nhanh Profile mẫu'}</span>
                  </button>
                </div>

                <div>
                  <label
                    htmlFor="nurture-acc-name"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Tên hiển thị Nick Facebook
                  </label>
                  <input
                    id="nurture-acc-name"
                    type="text"
                    value={accName}
                    onChange={(e) => setAccName(e.target.value)}
                    placeholder="VD: Hoàng Bảo Vy (Ads Warmup #04)"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:border-rose-600 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="nurture-acc-uid"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Facebook UID
                    </label>
                    <input
                      id="nurture-acc-uid"
                      type="text"
                      value={fbUid}
                      onChange={(e) => setFbUid(e.target.value)}
                      placeholder="100089..."
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-900 focus:border-rose-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="nurture-acc-stage"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Giai đoạn khởi điểm
                    </label>
                    <select
                      id="nurture-acc-stage"
                      value={warmupStage}
                      onChange={(e) =>
                        setWarmupStage(e.target.value as FacebookAccount['warmupStage'])
                      }
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:border-rose-600 focus:outline-none"
                    >
                      <option value="Mới (1-7 ngày)">Mới (1-7 ngày)</option>
                      <option value="Đang nuôi (8-21 ngày)">Đang nuôi (8-21 ngày)</option>
                      <option value="Tin cậy (>21 ngày)">Tin cậy (&gt;21 ngày)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="nurture-acc-email"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Email khôi phục (Via/Clone)
                    </label>
                    <input
                      id="nurture-acc-email"
                      type="text"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      placeholder="name@mailcare.vn"
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-900 focus:border-rose-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="nurture-acc-2fa"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Mã bảo mật 2FA Secret
                    </label>
                    <input
                      id="nurture-acc-2fa"
                      type="text"
                      value={twoFactorSecret}
                      onChange={(e) => setTwoFactorSecret(e.target.value)}
                      placeholder="ABCD EFGH IJKL MNOP"
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-900 focus:border-rose-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="nurture-acc-proxy"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Proxy dân cư riêng
                  </label>
                  <input
                    id="nurture-acc-proxy"
                    type="text"
                    value={proxyEndpoint}
                    onChange={(e) => setProxyEndpoint(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-900 focus:border-rose-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="nurture-acc-cookie"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Chuỗi Cookie phiên đăng nhập
                  </label>
                  <textarea
                    id="nurture-acc-cookie"
                    rows={2}
                    value={cookieData}
                    onChange={(e) => setCookieData(e.target.value)}
                    placeholder="c_user=...; xs=...; datr=...;"
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-900 focus:border-rose-600 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-medium"
                >
                  <Plus className="h-4 w-4" />
                  <span>{submitting ? 'Đang tạo...' : 'Lưu Nick FB & Đưa vào Nuôi'}</span>
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmitFanpage} className="space-y-4">
                <h3 className="font-display text-sm font-semibold text-slate-900">
                  Tạo Fanpage mới phục vụ Quảng cáo
                </h3>

                <div>
                  <label
                    htmlFor="page-owner-select"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Tài khoản FB chủ sở hữu (Admin Fanpage)
                  </label>
                  <select
                    id="page-owner-select"
                    value={ownerAccountId}
                    onChange={(e) => setOwnerAccountId(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:border-rose-600 focus:outline-none"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} (Trust {acc.trustScore}%)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="page-name-input"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Tên Fanpage
                  </label>
                  <input
                    id="page-name-input"
                    type="text"
                    value={pageName}
                    onChange={(e) => setPageName(e.target.value)}
                    placeholder="VD: Gia Dụng Tiện Ích Sài Gòn"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:border-rose-600 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="page-category-input"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Ngành hàng / Danh mục
                    </label>
                    <input
                      id="page-category-input"
                      type="text"
                      value={pageCategory}
                      onChange={(e) => setPageCategory(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:border-rose-600 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="page-slug-input"
                      className="block text-xs font-medium text-slate-700 mb-1"
                    >
                      Username / Link rút gọn
                    </label>
                    <input
                      id="page-slug-input"
                      type="text"
                      value={pageSlug}
                      onChange={(e) => setPageSlug(e.target.value)}
                      placeholder="giadungtienichsg"
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-mono text-slate-900 focus:border-rose-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="page-desc-input"
                    className="block text-xs font-medium text-slate-700 mb-1"
                  >
                    Mô tả Fanpage chuẩn SEO (hiển thị cho khách &amp; thuật toán Ads)
                  </label>
                  <textarea
                    id="page-desc-input"
                    rows={3}
                    value={pageDescription}
                    onChange={(e) => setPageDescription(e.target.value)}
                    placeholder="Chuyên cung cấp sản phẩm chính hãng, giao nhanh 2h, bảo hành 24 tháng..."
                    className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:border-rose-600 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-medium"
                >
                  <Plus className="h-4 w-4" />
                  <span>{submitting ? 'Đang khởi tạo...' : 'Khởi tạo Fanpage & Nuôi Ads'}</span>
                </button>
              </form>
            )}
          </div>
        </section>

        {/* Right: Managed Assets List (Fanpages + FB Profiles) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Owned Fanpages */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 bg-white border-b border-slate-200 border-l-4 border-l-rose-600 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Danh sách Fanpage sở hữu ({fanpages.length})
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Theo dõi Trust Score, Follower tự nhiên &amp; mức độ sẵn sàng chạy Ads / BM
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-200">
              {fanpages.map((page) => {
                const checked = selectedPageIds.includes(page.id);
                const isReady = page.adReadiness === 'Sẵn sàng chạy Ads';
                const checklist = getDailyChecklist('page', page.warmupDays);

                return (
                  <article key={page.id} className="p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <label className="flex items-start gap-3 cursor-pointer min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelectPage(page.id)}
                          aria-label={`Chọn Fanpage ${page.name} để nuôi`}
                          className="mt-1 h-4 w-4 accent-rose-600 rounded"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-display text-sm font-semibold text-slate-900">
                              {page.name}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${
                                isReady
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                  : page.adReadiness === 'Đang nuôi Ads'
                                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                                    : 'bg-slate-100 border-slate-200 text-slate-600'
                              }`}
                            >
                              {page.adReadiness}
                            </span>
                            {page.workerStatus === 'running' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700">
                                <RefreshCw className="h-3 w-3 animate-spin" />
                                <span>Đang nuôi...</span>
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                            <span>{page.category}</span>
                            <span aria-hidden="true">·</span>
                            <span>Chủ quản: {page.ownerAccountName}</span>
                            <span aria-hidden="true">·</span>
                            <a
                              href={page.pageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-600 hover:underline font-mono"
                            >
                              <span>ID {page.pageId.slice(-6)}</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </label>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onToggleFanpage(page.id)}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-medium ${
                            page.enabled
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-slate-50 text-slate-500'
                          }`}
                        >
                          {page.enabled ? 'Đang nuôi' : 'Tạm ngưng'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteFanpage(page.id)}
                          aria-label={`Xóa Fanpage ${page.name}`}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-white border border-slate-200 rounded-lg p-3 font-mono tabular-nums">
                      <div>
                        <div className="text-slate-600 font-sans">Tuổi nuôi</div>
                        <div className="font-semibold text-slate-900 mt-0.5">
                          Ngày {page.warmupDays}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 font-sans">Follower</div>
                        <div className="font-semibold text-slate-900 mt-0.5">
                          {formatNumberVi(page.followersCount)}
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 font-sans">Bài đã đăng</div>
                        <div className="font-semibold text-slate-900 mt-0.5">
                          {page.postsPublishedCount} bài
                        </div>
                      </div>
                      <div>
                        <div className="text-slate-500 font-sans flex items-center justify-between">
                          <span>Trust Page</span>
                          <span className="font-mono font-semibold text-rose-700">
                            {page.trustScore}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1.5">
                          <div
                            className={`h-full rounded-full ${
                              page.trustScore >= 82 ? 'bg-emerald-600' : 'bg-rose-600'
                            }`}
                            style={{ width: `${page.trustScore}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="font-semibold text-slate-700">Kịch bản hôm nay:</span>
                      {checklist.map((step) => (
                        <span key={step} className="inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-rose-500 shrink-0" />
                          <span>{step}</span>
                        </span>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Owned Personal FB Profiles (Ads Warm-up Status) */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 bg-white border-b border-slate-200 border-l-4 border-l-indigo-600 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Nick FB Cá nhân đang nuôi ({accounts.length})
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Dùng chung cụm tài khoản với Module Quét Group — quản lý Trust &amp; 2FA để lên TKQC
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-200">
              {accounts.map((acc) => {
                const checked = selectedAccIds.includes(acc.id);
                const isReady = acc.adAccountStatus === 'Sẵn sàng chạy Ads';
                const checklist = getDailyChecklist('profile', acc.warmupDays);

                return (
                  <article key={acc.id} className="p-5 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <label className="flex items-start gap-3 cursor-pointer min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelectAccount(acc.id)}
                          aria-label={`Chọn Nick FB ${acc.name} để nuôi`}
                          className="mt-1 h-4 w-4 accent-rose-600 rounded"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-display text-sm font-semibold text-slate-900">
                              {acc.name}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${
                                isReady
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                  : 'bg-amber-50 border-amber-200 text-amber-700'
                              }`}
                            >
                              {acc.adAccountStatus}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                            <span className="font-mono">UID: {acc.fbUid}</span>
                            {acc.recoveryEmail && (
                              <span className="inline-flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                <span>{acc.recoveryEmail}</span>
                              </span>
                            )}
                            {acc.twoFactorSecret && (
                              <span className="inline-flex items-center gap-1 font-mono text-emerald-700">
                                <KeyRound className="h-3 w-3" />
                                <span>2FA OK</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </label>

                      <div className="flex items-center gap-4 shrink-0 font-mono tabular-nums text-xs">
                        <div className="text-right">
                          <div className="text-slate-500 font-sans">Ngày nuôi</div>
                          <div className="font-semibold text-slate-900">#{acc.warmupDays}</div>
                        </div>
                        <div className="w-24">
                          <div className="flex justify-between text-slate-600 mb-1">
                            <span>Trust</span>
                            <span className="font-semibold text-slate-900">{acc.trustScore}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                acc.trustScore >= 82 ? 'bg-emerald-600' : 'bg-indigo-600'
                              }`}
                              style={{ width: `${acc.trustScore}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1 pl-7">
                      {checklist.slice(0, 2).map((step) => (
                        <span key={step} className="inline-flex items-center gap-1">
                          <ShieldAlert className="h-3 w-3 text-indigo-500 shrink-0" />
                          <span>{step}</span>
                        </span>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
