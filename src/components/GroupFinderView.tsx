import {
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Lock,
  Search,
  ShieldAlert,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FacebookAccount, FacebookGroup, GroupDataset } from '../../shared/types';
import { buildAuthUrl } from '../utils/authToken';
import { formatCompactMembers, formatNumberVi } from '../utils/formatters';

interface GroupFinderViewProps {
  datasets: GroupDataset[];
  groups: FacebookGroup[];
  accounts: FacebookAccount[];
  selectedDatasetId: string;
  onSelectDataset: (id: string) => void;
  onSearchGroups: (params: {
    keyword: string;
    targetCount: number;
    autoJoinPublic: boolean;
    accountIds: string[];
  }) => Promise<void>;
  onManualJoin: (groupId: string) => Promise<void>;
  onDeleteDataset: (datasetId: string) => Promise<void>;
  onJumpToScanner: (datasetId: string) => void;
}

export function GroupFinderView({
  datasets,
  groups,
  accounts,
  selectedDatasetId,
  onSelectDataset,
  onSearchGroups,
  onManualJoin,
  onDeleteDataset,
  onJumpToScanner,
}: GroupFinderViewProps) {
  const [keyword, setKeyword] = useState('');
  const [targetCount, setTargetCount] = useState(6);
  const [autoJoinPublic, setAutoJoinPublic] = useState(true);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'Public' | 'Private'>('ALL');
  const [approvalFilter, setApprovalFilter] = useState<'ALL' | 'NO_POST_APPROVAL' | 'FREE_COMMENT'>('ALL');
  const [searchFilter, setSearchFilter] = useState('');
  const [joiningId, setJoiningId] = useState<string | null>(null);

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

  const visibleGroups = groups.filter((g) => {
    if (selectedDatasetId !== 'ALL' && g.datasetId !== selectedDatasetId) return false;
    if (typeFilter !== 'ALL' && g.groupType !== typeFilter) return false;
    if (approvalFilter === 'NO_POST_APPROVAL' && g.postApproval !== 'Không cần duyệt') return false;
    if (approvalFilter === 'FREE_COMMENT' && g.commentApproval !== 'Tự do bình luận') return false;
    if (
      searchFilter.trim() &&
      !g.name.toLowerCase().includes(searchFilter.trim().toLowerCase()) &&
      !g.keyword.toLowerCase().includes(searchFilter.trim().toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!keyword.trim()) {
      setErrorMsg('Vui lòng nhập từ khóa để tìm kiếm Group Facebook.');
      return;
    }
    if (selectedAccountIds.length === 0) {
      setErrorMsg('Vui lòng chọn ít nhất 1 tài khoản Facebook thực hiện.');
      return;
    }
    setSearching(true);
    try {
      await onSearchGroups({
        keyword: keyword.trim(),
        targetCount,
        autoJoinPublic,
        accountIds: selectedAccountIds,
      });
      setKeyword('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể tìm kiếm Group.');
    } finally {
      setSearching(false);
    }
  };

  const handleJoinClick = async (groupId: string) => {
    setJoiningId(groupId);
    setErrorMsg(null);
    try {
      await onManualJoin(groupId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không thể tham gia nhóm.');
    } finally {
      setJoiningId(null);
    }
  };

  const exportUrl = buildAuthUrl(
    selectedDatasetId && selectedDatasetId !== 'ALL'
      ? `/api/groups/export?datasetId=${encodeURIComponent(selectedDatasetId)}`
      : '/api/groups/export'
  );

  return (
    <div className="space-y-6">
      {/* Pure White Module Header with Blue Accent */}
      <section className="bg-white border border-neutral-300 border-t-2 border-t-blue-600 rounded-xl p-6">
        <div className="flex items-start gap-4 mb-5">
          <div className="h-11 w-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-black">
              Module 1 · Tìm kiếm Group, Kiểm tra Phê duyệt &amp; Auto-Join Song song
            </h2>
            <p className="text-sm text-neutral-800 mt-0.5">
              Mỗi từ khóa tạo 1 tập dữ liệu riêng. Chọn nhiều tài khoản chạy song song để chia tải và tự động nhận diện Group đăng bài/comment không cần phê duyệt.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-neutral-300 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
            <div className="md:col-span-5">
              <label
                htmlFor="group-keyword-input"
                className="block text-xs font-semibold text-black mb-1.5"
              >
                Từ khóa tìm kiếm Group Facebook
              </label>
              <div className="relative">
                <Search className="h-4 w-4 text-neutral-700 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="group-keyword-input"
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="Ví dụ: đồ gia dụng thông minh, mẹ và bé..."
                  className="w-full h-10 pl-9 pr-3 rounded-lg border border-neutral-300 bg-white text-sm text-black placeholder:text-neutral-500 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="group-count-input"
                className="block text-xs font-semibold text-black mb-1.5"
              >
                Số nhóm mục tiêu
              </label>
              <select
                id="group-count-input"
                value={targetCount}
                onChange={(e) => setTargetCount(Number(e.target.value))}
                className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm font-mono tabular-nums text-black focus:border-blue-600 focus:outline-none"
              >
                <option value={4}>4 nhóm</option>
                <option value={6}>6 nhóm</option>
                <option value={8}>8 nhóm</option>
                <option value={10}>10 nhóm</option>
              </select>
            </div>

            <div className="md:col-span-3 flex items-center h-10">
              <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoJoinPublic}
                  onChange={(e) => setAutoJoinPublic(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-400 accent-blue-600"
                />
                <span className="text-sm font-medium text-black">Auto-Join nhóm Public</span>
              </label>
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={searching}
                className="w-full h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                {searching ? 'Đang tìm...' : 'Tìm kiếm Group'}
              </button>
            </div>
          </div>

          {/* Parallel Facebook Account Selector */}
          <div className="pt-3 border-t border-neutral-200">
            <div className="text-xs font-semibold text-black mb-2">
              Chọn tài khoản Facebook chạy song song ({selectedAccountIds.length} đã chọn):
            </div>
            <div className="flex flex-wrap gap-2">
              {enabledAccounts.map((acc) => {
                const checked = selectedAccountIds.includes(acc.id);
                return (
                  <label
                    key={acc.id}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer select-none transition-colors bg-white ${
                      checked
                        ? 'border-blue-600 text-blue-700 ring-1 ring-blue-600'
                        : 'border-neutral-300 text-black hover:border-blue-600'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAccount(acc.id)}
                      className="h-3.5 w-3.5 rounded border-neutral-400 accent-blue-600"
                    />
                    <span>{acc.name}</span>
                    <span className="font-mono text-neutral-700">
                      ({acc.joinsToday}/{acc.maxJoinsPerDay})
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="px-4 py-2.5 rounded-lg bg-white border-2 border-red-600 text-xs font-semibold text-red-700"
            >
              {errorMsg}
            </div>
          )}
        </form>
      </section>

      {/* Dataset Selector & Table */}
      <section className="bg-white border border-neutral-300 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-300 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
            <button
              type="button"
              onClick={() => onSelectDataset('ALL')}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                selectedDatasetId === 'ALL'
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-neutral-300 text-black hover:border-blue-600'
              }`}
            >
              Tất cả tập dữ liệu ({groups.length})
            </button>

            {datasets.map((ds) => {
              const isSelected = selectedDatasetId === ds.id;
              return (
                <div key={ds.id} className="inline-flex items-center shrink-0">
                  <button
                    type="button"
                    onClick={() => onSelectDataset(ds.id)}
                    className={`px-3 py-1.5 rounded-l-lg border text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-neutral-300 text-black hover:border-blue-600'
                    }`}
                  >
                    {ds.keyword} ({ds.totalGroups})
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteDataset(ds.id)}
                    aria-label={`Xóa tập dữ liệu ${ds.keyword}`}
                    className={`px-2 py-1.5 rounded-r-lg border border-l-0 text-xs transition-colors ${
                      isSelected
                        ? 'bg-blue-700 border-blue-700 text-white hover:bg-red-600 hover:border-red-600'
                        : 'bg-white border-neutral-300 text-neutral-700 hover:text-red-600 hover:border-red-600'
                    }`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {selectedDatasetId !== 'ALL' && (
              <button
                type="button"
                onClick={() => onJumpToScanner(selectedDatasetId)}
                className="px-3 py-1.5 rounded-lg border border-red-600 bg-white text-red-700 hover:bg-red-600 hover:text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
              >
                Quét nội dung tập này →
              </button>
            )}
            <a
              href={exportUrl}
              download
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-black hover:border-blue-600 hover:text-blue-700 whitespace-nowrap shrink-0 transition-colors"
            >
              <Download className="h-3.5 w-3.5 text-blue-600" />
              <span>Xuất CSV / Sheet</span>
            </a>
          </div>
        </div>

        {/* Toolbar Filter */}
        <div className="px-6 py-3 bg-white border-b border-neutral-300 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-1 p-1 bg-white border border-neutral-300 rounded-lg">
              {(['ALL', 'Public', 'Private'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    typeFilter === t
                      ? t === 'Private'
                        ? 'bg-red-600 text-white'
                        : 'bg-blue-600 text-white'
                      : 'text-black hover:text-blue-700'
                  }`}
                >
                  {t === 'ALL' ? 'Tất cả loại' : t}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-1 p-1 bg-white border border-neutral-300 rounded-lg">
              <button
                type="button"
                onClick={() => setApprovalFilter('ALL')}
                className={`px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  approvalFilter === 'ALL'
                    ? 'bg-black text-white'
                    : 'text-black hover:text-blue-700'
                }`}
              >
                Mọi quyền duyệt
              </button>
              <button
                type="button"
                onClick={() => setApprovalFilter('NO_POST_APPROVAL')}
                className={`px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  approvalFilter === 'NO_POST_APPROVAL'
                    ? 'bg-blue-600 text-white'
                    : 'text-black hover:text-blue-700'
                }`}
              >
                Đăng bài không cần duyệt
              </button>
              <button
                type="button"
                onClick={() => setApprovalFilter('FREE_COMMENT')}
                className={`px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  approvalFilter === 'FREE_COMMENT'
                    ? 'bg-blue-600 text-white'
                    : 'text-black hover:text-blue-700'
                }`}
              >
                Comment không cần duyệt
              </button>
            </div>
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="h-3.5 w-3.5 text-neutral-700 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              aria-label="Lọc tên Group trong bảng"
              placeholder="Lọc tên Group..."
              className="w-full h-8 pl-8 pr-3 rounded-lg border border-neutral-300 bg-white text-xs text-black placeholder:text-neutral-500 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>

        {/* Data Table */}
        {visibleGroups.length === 0 ? (
          <div className="p-12 text-center bg-white">
            <p className="text-sm font-semibold text-black">
              Chưa có Group nào phù hợp bộ lọc
            </p>
            <p className="text-xs text-neutral-800 mt-1">
              Nhập từ khóa ở biểu mẫu phía trên hoặc mở rộng bộ lọc phê duyệt.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white" data-testid="groups-table-container">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-300 bg-white text-xs font-bold text-black">
                  <th className="py-3 pl-4 pr-2 whitespace-nowrap">Keyword</th>
                  <th className="py-3 px-2 min-w-[150px]">Tên Group</th>
                  <th className="py-3 px-2 text-right whitespace-nowrap">Thành viên</th>
                  <th className="py-3 px-2 whitespace-nowrap">Loại</th>
                  <th className="py-3 px-2 whitespace-nowrap">Đăng bài</th>
                  <th className="py-3 px-2 whitespace-nowrap">Bình luận</th>
                  <th className="py-3 px-2 whitespace-nowrap">Tài khoản</th>
                  <th className="py-3 px-2 whitespace-nowrap">Link</th>
                  <th className="py-3 pl-2 pr-4 whitespace-nowrap">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 text-xs">
                {visibleGroups.map((grp) => {
                  const isJoined = grp.joinStatus.startsWith('Đã tham gia');
                  const isPrivate = grp.groupType === 'Private';
                  const postInstant = grp.postApproval === 'Không cần duyệt';
                  const commentInstant = grp.commentApproval === 'Tự do bình luận';
                  return (
                    <tr key={grp.id} className="bg-white hover:bg-neutral-50/70">
                      <td className="py-3 pl-4 pr-2 font-semibold text-black max-w-[110px]">
                        {grp.keyword}
                      </td>
                      <td className="py-3 px-2">
                        <div className="text-xs font-semibold text-black leading-snug">{grp.name}</div>
                      </td>
                      <td className="py-3 px-2 text-right font-mono tabular-nums text-black whitespace-nowrap">
                        <span title={formatNumberVi(grp.memberCount)}>
                          {formatCompactMembers(grp.memberCount)}
                        </span>
                      </td>
                      <td className="py-3 px-2 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            isPrivate ? 'text-red-700' : 'text-blue-700'
                          }`}
                        >
                          {isPrivate ? (
                            <Lock className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span>{grp.groupType}</span>
                        </span>
                      </td>
                      <td className="py-3 px-2 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            postInstant ? 'text-blue-700' : 'text-red-700'
                          }`}
                        >
                          {postInstant ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span>{grp.postApproval}</span>
                        </span>
                      </td>
                      <td className="py-3 px-2 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            commentInstant ? 'text-blue-700' : 'text-red-700'
                          }`}
                        >
                          {commentInstant ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span>{grp.commentApproval}</span>
                        </span>
                      </td>
                      <td className="py-3 px-2 text-blue-700 font-semibold max-w-[110px]">
                        {grp.accountName.split('(')[0].trim()}
                      </td>
                      <td className="py-3 px-2 whitespace-nowrap">
                        <a
                          href={grp.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline font-mono"
                        >
                          <span>Mở</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </td>
                      <td className="py-3 pl-2 pr-4">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 font-semibold ${
                              isJoined ? 'text-blue-700' : 'text-red-700'
                            }`}
                          >
                            {isJoined ? (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <Clock className="h-3.5 w-3.5 shrink-0" />
                            )}
                            <span>{grp.joinStatus}</span>
                          </span>

                          {!isJoined && (
                            <button
                              type="button"
                              disabled={joiningId === grp.id}
                              onClick={() => handleJoinClick(grp.id)}
                              aria-label={`Tham gia thủ công nhóm ${grp.name}`}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-blue-600 bg-white text-xs font-semibold text-blue-700 hover:bg-blue-600 hover:text-white disabled:opacity-50 whitespace-nowrap shrink-0 transition-colors"
                            >
                              <UserPlus className="h-3 w-3" />
                              <span>{joiningId === grp.id ? '...' : 'Join'}</span>
                            </button>
                          )}
                        </div>
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
