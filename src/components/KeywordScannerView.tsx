import {
  BotMessageSquare,
  CheckCircle2,
  Download,
  ExternalLink,
  MessageSquare,
  Play,
  Radar,
  ShieldAlert,
  Square,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  AutomationStream,
  FacebookAccount,
  GroupDataset,
  ScannedPost,
} from '../../shared/types';
import { buildAuthUrl } from '../utils/authToken';
import { formatShortDateTime, parseKeywordList } from '../utils/formatters';

interface KeywordScannerViewProps {
  datasets: GroupDataset[];
  posts: ScannedPost[];
  accounts: FacebookAccount[];
  scannerStream: AutomationStream | undefined;
  initialDatasetId?: string;
  onStartScan: (params: {
    datasetId: string;
    trackingKeywords: string[];
    accountIds: string[];
    delayMinSec: number;
    delayMaxSec: number;
  }) => Promise<void>;
  onStopScan: () => Promise<void>;
  onOpenInAiWorkbench: (postId: string) => void;
}

export function KeywordScannerView({
  datasets,
  posts,
  accounts,
  scannerStream,
  initialDatasetId,
  onStartScan,
  onStopScan,
  onOpenInAiWorkbench,
}: KeywordScannerViewProps) {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>(
    initialDatasetId && initialDatasetId !== 'ALL'
      ? initialDatasetId
      : datasets[0]?.id ?? ''
  );
  const [keywordsText, setKeywordsText] = useState('robot hút bụi, tư vấn, báo giá');
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [delayMinSec, setDelayMinSec] = useState(3);
  const [delayMaxSec, setDelayMaxSec] = useState(10);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Post' | 'Comment'>('ALL');
  const [approvalFilter, setApprovalFilter] = useState<'ALL' | 'NO_POST_APPROVAL' | 'FREE_COMMENT'>('ALL');
  const [datasetFilter, setDatasetFilter] = useState<string>('ALL');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const enabledAccounts = accounts.filter((a) => a.enabled);

  useEffect(() => {
    if (selectedAccountIds.length === 0 && enabledAccounts.length > 0) {
      setSelectedAccountIds(enabledAccounts.slice(0, 2).map((a) => a.id));
    }
  }, [enabledAccounts.length]);

  const toggleAccount = (id: string) => {
    setSelectedAccountIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isRunning = scannerStream?.status === 'running';
  const activeDatasetId = selectedDatasetId || datasets[0]?.id || '';

  const visiblePosts = posts.filter((p) => {
    if (datasetFilter !== 'ALL' && p.datasetId !== datasetFilter) return false;
    if (typeFilter !== 'ALL' && p.postType !== typeFilter) return false;
    if (approvalFilter === 'NO_POST_APPROVAL' && p.postApproval !== 'Không cần duyệt') return false;
    if (approvalFilter === 'FREE_COMMENT' && p.commentApproval !== 'Tự do bình luận') return false;
    return true;
  });

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!activeDatasetId) {
      setErrorMsg('Chưa có tập dữ liệu Group nào. Hãy tạo ở Module 1 trước.');
      return;
    }

    const parsedKeywords = parseKeywordList(keywordsText);
    if (parsedKeywords.length === 0) {
      setErrorMsg('Vui lòng nhập ít nhất 1 từ khóa cần theo dõi.');
      return;
    }

    if (selectedAccountIds.length === 0) {
      setErrorMsg('Vui lòng chọn ít nhất 1 tài khoản Facebook chạy song song.');
      return;
    }

    setSubmitting(true);
    try {
      await onStartScan({
        datasetId: activeDatasetId,
        trackingKeywords: parsedKeywords,
        accountIds: selectedAccountIds,
        delayMinSec,
        delayMaxSec: Math.max(delayMinSec, delayMaxSec),
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể bắt đầu quét.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Pure White Module Header with Amber Accent */}
      <section className="bg-white border border-slate-200 border-l-4 border-l-amber-600 rounded-xl p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
          <div className="flex items-start gap-4">
            <div className="h-11 w-11 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0">
              <Radar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Module 2 · Quét Nội dung &amp; Comment Song song (Random Delay 3–10s)
              </h2>
              <p className="text-sm text-slate-700 mt-0.5">
                Phân chia Group cho nhiều tài khoản Facebook chạy đồng thời, hiển thị rõ Group nào cho đăng bài / comment không cần phê duyệt.
              </p>
            </div>
          </div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-white border border-amber-300 px-3 py-1.5 rounded-lg shrink-0">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <span className="font-mono tabular-nums">
              Anti-Bot Delay: {delayMinSec}s – {Math.max(delayMinSec, delayMaxSec)}s
            </span>
          </div>
        </div>

        <form onSubmit={handleStart} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-3">
              <label
                htmlFor="scanner-dataset-select"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Tập dữ liệu Group cần quét
              </label>
              <select
                id="scanner-dataset-select"
                value={activeDatasetId}
                onChange={(e) => setSelectedDatasetId(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:border-amber-600 focus:outline-none"
              >
                {datasets.length === 0 ? (
                  <option value="">Chưa có tập Group</option>
                ) : (
                  datasets.map((ds) => (
                    <option key={ds.id} value={ds.id}>
                      {ds.keyword} ({ds.totalGroups} nhóm)
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="md:col-span-4">
              <label
                htmlFor="scanner-keywords-input"
                className="block text-xs font-medium text-slate-700 mb-1.5"
              >
                Từ khóa theo dõi (phân tách bởi dấu phẩy)
              </label>
              <input
                id="scanner-keywords-input"
                type="text"
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                placeholder="tư vấn, báo giá, mua ở đâu..."
                className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-amber-600 focus:outline-none"
              />
            </div>

            <div className="md:col-span-3 grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="delay-min-input"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Delay Min (giây)
                </label>
                <input
                  id="delay-min-input"
                  type="number"
                  min={1}
                  max={30}
                  value={delayMinSec}
                  onChange={(e) => setDelayMinSec(Math.max(1, Number(e.target.value)))}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono tabular-nums text-slate-900 focus:border-amber-600 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="delay-max-input"
                  className="block text-xs font-medium text-slate-700 mb-1.5"
                >
                  Delay Max (giây)
                </label>
                <input
                  id="delay-max-input"
                  type="number"
                  min={2}
                  max={60}
                  value={delayMaxSec}
                  onChange={(e) => setDelayMaxSec(Math.max(delayMinSec, Number(e.target.value)))}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono tabular-nums text-slate-900 focus:border-amber-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="md:col-span-2 flex gap-2">
              {isRunning ? (
                <button
                  type="button"
                  onClick={onStopScan}
                  className="w-full h-10 inline-flex items-center justify-center gap-1.5 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium whitespace-nowrap shrink-0"
                >
                  <Square className="h-3.5 w-3.5" />
                  <span>Dừng quét</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting || datasets.length === 0}
                  className="w-full h-10 inline-flex items-center justify-center gap-1.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-medium whitespace-nowrap shrink-0"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>{submitting ? 'Đang chạy...' : 'Bắt đầu quét'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Parallel Accounts Selection */}
          <div className="pt-3 border-t border-slate-100">
            <div className="text-xs font-medium text-slate-700 mb-2">
              Tài khoản Facebook quét song song ({selectedAccountIds.length} luồng đồng thời):
            </div>
            <div className="flex flex-wrap gap-2">
              {enabledAccounts.map((acc) => {
                const checked = selectedAccountIds.includes(acc.id);
                return (
                  <label
                    key={acc.id}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer select-none ${
                      checked
                        ? 'bg-indigo-50 border-indigo-300 text-indigo-800'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAccount(acc.id)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600"
                    />
                    <span>{acc.name}</span>
                    {acc.workerStatus === 'running' && (
                      <span className="text-emerald-700 font-semibold">· Đang quét</span>
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Live Worker Bar */}
          {scannerStream && (isRunning || scannerStream.progress > 0) && (
            <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={`font-semibold shrink-0 ${
                    isRunning ? 'text-emerald-700' : 'text-slate-600'
                  }`}
                >
                  {isRunning ? 'Đang chạy:' : 'Trạng thái cuối:'}
                </span>
                <span className="text-slate-700 truncate">{scannerStream.currentAction}</span>
              </div>
              {scannerStream.total > 0 && (
                <div className="flex items-center gap-3 shrink-0">
                  <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        isRunning ? 'bg-amber-600' : 'bg-emerald-600'
                      }`}
                      style={{
                        width: `${Math.round((scannerStream.progress / scannerStream.total) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="font-mono tabular-nums text-slate-600">
                    {scannerStream.progress}/{scannerStream.total} nhóm
                  </span>
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-medium text-red-700"
            >
              {errorMsg}
            </div>
          )}
        </form>
      </section>

      {/* Results Data Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(['ALL', 'Post', 'Comment'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 ${
                    typeFilter === t
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t === 'ALL' ? `Tất cả (${posts.length})` : t}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setApprovalFilter('ALL')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 ${
                  approvalFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tất cả Group
              </button>
              <button
                type="button"
                onClick={() => setApprovalFilter('NO_POST_APPROVAL')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 ${
                  approvalFilter === 'NO_POST_APPROVAL'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Đăng bài không cần duyệt
              </button>
              <button
                type="button"
                onClick={() => setApprovalFilter('FREE_COMMENT')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 ${
                  approvalFilter === 'FREE_COMMENT'
                    ? 'bg-white text-teal-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Comment không cần duyệt
              </button>
            </div>

            <select
              aria-label="Lọc theo tập dữ liệu Group"
              value={datasetFilter}
              onChange={(e) => setDatasetFilter(e.target.value)}
              className="h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700 focus:border-amber-600 focus:outline-none"
            >
              <option value="ALL">Tất cả tập Group</option>
              {datasets.map((ds) => (
                <option key={ds.id} value={ds.id}>
                  {ds.keyword}
                </option>
              ))}
            </select>
          </div>

          <a
            href={buildAuthUrl('/api/scanner/export')}
            download
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 self-start lg:self-auto"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Xuất CSV / Sheet</span>
          </a>
        </div>

        {visiblePosts.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-900">
              Chưa có bài đăng hoặc bình luận nào khớp bộ lọc
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Chọn tập dữ liệu Group, chọn tài khoản chạy song song và bấm Bắt đầu quét.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto" data-testid="scanner-table-container">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-white text-xs font-semibold text-slate-800">
                  <th className="py-3 pl-4 pr-2 whitespace-nowrap">Từ khóa</th>
                  <th className="py-3 px-2">Tên Group</th>
                  <th className="py-3 px-2 whitespace-nowrap">Phê duyệt</th>
                  <th className="py-3 px-2 whitespace-nowrap">Link</th>
                  <th className="py-3 px-2 min-w-[180px]">Nội dung chi tiết</th>
                  <th className="py-3 px-2 whitespace-nowrap">Thời gian</th>
                  <th className="py-3 px-2 whitespace-nowrap">Người đăng</th>
                  <th className="py-3 px-2 whitespace-nowrap">Tài khoản</th>
                  <th className="py-3 pl-2 pr-4 text-right whitespace-nowrap">AI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs align-top">
                {visiblePosts.map((post) => {
                  const postInstant = post.postApproval === 'Không cần duyệt';
                  const commentInstant = post.commentApproval === 'Tự do bình luận';
                  const formattedTime = formatShortDateTime(post.postedAt);
                  const [timePart, datePart] = formattedTime.split(' ');
                  return (
                    <tr key={post.id} className="hover:bg-slate-50/80">
                      <td className="py-3 pl-4 pr-2 max-w-[110px]">
                        <div className="font-semibold text-amber-700 leading-snug">
                          {post.keywordFound}
                        </div>
                        <div className="text-slate-500 mt-0.5 flex items-center gap-1 whitespace-nowrap">
                          <MessageSquare className="h-3 w-3 shrink-0" />
                          <span>{post.postType}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 font-medium text-slate-800 max-w-[150px] leading-snug">
                        {post.groupName}
                      </td>
                      <td className="py-3 px-2 whitespace-nowrap space-y-1">
                        <div
                          className={`flex items-center gap-1 font-medium ${
                            postInstant ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {postInstant ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span>Bài: {post.postApproval}</span>
                        </div>
                        <div
                          className={`flex items-center gap-1 font-medium ${
                            commentInstant ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {commentInstant ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span>Cmt: {post.commentApproval}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 whitespace-nowrap">
                        <a
                          href={post.directUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline font-mono"
                        >
                          <span>{post.postType}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </td>
                      <td className="py-3 px-2 max-w-[230px]">
                        <p className="text-slate-800 leading-relaxed line-clamp-3">
                          {post.content}
                        </p>
                        <div className="mt-1 text-slate-500 leading-snug">
                          {post.intent} · {post.replyStatus}
                        </div>
                      </td>
                      <td className="py-3 px-2 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        <div>{timePart ?? formattedTime}</div>
                        {datePart && <div className="text-slate-400">{datePart}</div>}
                      </td>
                      <td className="py-3 px-2 font-medium text-slate-800 max-w-[100px] leading-snug">
                        {post.authorName}
                      </td>
                      <td className="py-3 px-2 font-medium text-indigo-700 max-w-[105px] leading-snug">
                        {post.accountName.split('(')[0].trim()}
                      </td>
                      <td className="py-3 pl-2 pr-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => onOpenInAiWorkbench(post.id)}
                          aria-label={`Tạo AI Reply cho bài của ${post.authorName}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-violet-200 bg-violet-50 text-xs font-medium text-violet-700 hover:bg-violet-100 whitespace-nowrap shrink-0"
                        >
                          <BotMessageSquare className="h-3.5 w-3.5 shrink-0" />
                          <span>AI Reply</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
