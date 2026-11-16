import {
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flag,
  PauseCircle,
  PlayCircle,
  Send,
  Sparkles,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  AutomationStream,
  FacebookAccount,
  Fanpage,
  PostGoal,
  PostRecurrence,
  PostTargetRef,
  ScheduledPost,
} from '../../shared/types';
import { formatShortDateTime } from '../utils/formatters';

interface AutoPublisherViewProps {
  accounts: FacebookAccount[];
  fanpages: Fanpage[];
  posts: ScheduledPost[];
  docsCount: number;
  publisherStream?: AutomationStream;
  onGenerateAiPost: (params: {
    topic: string;
    goal: PostGoal;
    tone: string;
    useRag: boolean;
    targetNames: string[];
  }) => Promise<{
    title: string;
    postText: string;
    hashtags: string[];
    citations: string[];
  }>;
  onCreateScheduledPost: (payload: {
    title: string;
    topic: string;
    goal: PostGoal;
    tone: string;
    useRag: boolean;
    aiContent: string;
    hashtags: string[];
    aiCitations: string[];
    perTargetVariation: boolean;
    targets: PostTargetRef[];
    scheduledAt: string;
    recurrence: PostRecurrence;
    publishImmediately: boolean;
  }) => Promise<void>;
  onPublishNow: (id: string) => Promise<void>;
  onTogglePause: (id: string) => Promise<void>;
  onDeletePost: (id: string) => Promise<void>;
}

function toLocalDatetimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

const RECURRENCE_LABELS: Record<PostRecurrence, string> = {
  once: 'Đăng 1 lần',
  daily: 'Lặp hàng ngày',
  every_2_days: 'Lặp mỗi 2 ngày',
  weekly: 'Lặp hàng tuần',
};

export function AutoPublisherView({
  accounts,
  fanpages,
  posts,
  docsCount,
  publisherStream,
  onGenerateAiPost,
  onCreateScheduledPost,
  onPublishNow,
  onTogglePause,
  onDeletePost,
}: AutoPublisherViewProps) {
  const [selectedTargets, setSelectedTargets] = useState<PostTargetRef[]>(() => {
    const initial: PostTargetRef[] = [];
    if (fanpages[0]) {
      initial.push({
        type: 'page',
        id: fanpages[0].id,
        name: fanpages[0].name,
        ownerAccountId: fanpages[0].ownerAccountId,
      });
    }
    return initial;
  });

  useEffect(() => {
    if (selectedTargets.length === 0 && fanpages.length > 0) {
      setSelectedTargets([
        {
          type: 'page',
          id: fanpages[0].id,
          name: fanpages[0].name,
          ownerAccountId: fanpages[0].ownerAccountId,
        },
      ]);
    }
  }, [fanpages, selectedTargets.length]);

  const [topic, setTopic] = useState('');
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState<PostGoal>('Review sản phẩm');
  const [tone, setTone] = useState('Tự nhiên như người dùng chia sẻ kinh nghiệm');
  const [useRag, setUseRag] = useState(true);
  const [perTargetVariation, setPerTargetVariation] = useState(true);
  const [aiContent, setAiContent] = useState('');
  const [hashtagsText, setHashtagsText] = useState('');
  const [aiCitations, setAiCitations] = useState<string[]>([]);

  const [scheduledLocal, setScheduledLocal] = useState(() =>
    toLocalDatetimeInputValue(new Date(Date.now() + 30 * 60 * 1000))
  );
  const [recurrence, setRecurrence] = useState<PostRecurrence>('once');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'scheduled' | 'published' | 'paused'>('ALL');

  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const isTargetSelected = (type: 'profile' | 'page', id: string) =>
    selectedTargets.some((t) => t.type === type && t.id === id);

  const toggleTarget = (target: PostTargetRef) => {
    setSelectedTargets((prev) =>
      prev.some((t) => t.type === target.type && t.id === target.id)
        ? prev.filter((t) => !(t.type === target.type && t.id === target.id))
        : [...prev, target]
    );
  };

  const selectAllTargets = () => {
    const all: PostTargetRef[] = [
      ...fanpages
        .filter((p) => p.enabled)
        .map((p) => ({
          type: 'page' as const,
          id: p.id,
          name: p.name,
          ownerAccountId: p.ownerAccountId,
        })),
      ...accounts
        .filter((a) => a.enabled)
        .map((a) => ({
          type: 'profile' as const,
          id: a.id,
          name: a.name,
          ownerAccountId: a.id,
        })),
    ];
    setSelectedTargets(all);
  };

  const handleGenerateAi = async () => {
    setFeedback(null);
    if (!topic.trim()) {
      setFeedback({
        type: 'err',
        text: 'Vui lòng nhập Chủ đề hoặc Sản phẩm trước khi gọi AI viết bài.',
      });
      return;
    }
    setGenerating(true);
    try {
      const result = await onGenerateAiPost({
        topic: topic.trim(),
        goal,
        tone,
        useRag,
        targetNames: selectedTargets.map((t) => t.name),
      });
      setTitle(result.title);
      setAiContent(result.postText);
      setHashtagsText(result.hashtags.join(' '));
      setAiCitations(result.citations);
      setFeedback({
        type: 'ok',
        text:
          result.citations.length > 0
            ? `AI đã viết xong bài đăng và tham chiếu ${result.citations.length} tài liệu RAG!`
            : 'AI đã viết xong nội dung bài đăng. Bạn có thể chỉnh sửa trước khi đặt lịch.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Không thể sinh bài đăng AI.',
      });
    } finally {
      setGenerating(false);
    }
  };

  const submitSchedule = async (publishImmediately: boolean) => {
    setFeedback(null);
    if (selectedTargets.length === 0) {
      setFeedback({
        type: 'err',
        text: 'Vui lòng tick chọn ít nhất 1 Fanpage hoặc Nick FB sở hữu.',
      });
      return;
    }
    if (!aiContent.trim()) {
      setFeedback({
        type: 'err',
        text: 'Vui lòng nhấn "AI Sinh bài đăng" hoặc nhập nội dung bài viết.',
      });
      return;
    }

    const scheduledIso = scheduledLocal
      ? new Date(scheduledLocal).toISOString()
      : new Date().toISOString();

    const parsedHashtags = hashtagsText
      .split(/[\s,]+/)
      .map((h) => h.trim())
      .filter(Boolean)
      .map((h) => (h.startsWith('#') ? h : `#${h}`));

    setSaving(true);
    try {
      await onCreateScheduledPost({
        title: title.trim() || topic.trim() || 'Bài đăng tự động AI',
        topic: topic.trim() || title.trim() || 'Chia sẻ cộng đồng',
        goal,
        tone,
        useRag,
        aiContent: aiContent.trim(),
        hashtags: parsedHashtags,
        aiCitations,
        perTargetVariation,
        targets: selectedTargets,
        scheduledAt: scheduledIso,
        recurrence,
        publishImmediately,
      });
      setTopic('');
      setTitle('');
      setAiContent('');
      setHashtagsText('');
      setAiCitations([]);
      setFeedback({
        type: 'ok',
        text: publishImmediately
          ? `Đã đăng bài thành công lên ${selectedTargets.length} kênh sở hữu!`
          : `Đã lưu lịch tự động đăng lên ${selectedTargets.length} kênh sở hữu.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Không thể lưu lịch đăng bài.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePublishNow = async (id: string) => {
    setFeedback(null);
    setPublishingId(id);
    try {
      await onPublishNow(id);
      setFeedback({
        type: 'ok',
        text: 'Đã hoàn tất đăng bài tự động lên các Nick FB & Fanpage đích.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Đăng bài thất bại.',
      });
    } finally {
      setPublishingId(null);
    }
  };

  const filteredPosts = posts.filter((p) =>
    filterStatus === 'ALL' ? true : p.status === filterStatus
  );
  const scheduledCount = posts.filter((p) => p.status === 'scheduled').length;
  const publishedCount = posts.filter((p) => p.status === 'published').length;

  return (
    <div className="space-y-6">
      {/* Pure White Header Banner with Blue Accent */}
      <section className="bg-white border border-neutral-300 border-t-2 border-t-blue-600 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-black">
              Tự động Đăng bài AI lên Nick FB &amp; Fanpage Sở hữu theo Lịch
            </h2>
            <p className="text-sm text-neutral-800 mt-0.5">
              Dùng Gemini 4 + Kho tài liệu RAG để viết bài chuẩn chuyển đổi, hẹn lịch đăng đa kênh song song lên các tài khoản &amp; Fanpage đã add.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5 shrink-0 font-mono tabular-nums text-xs">
          <div>
            <div className="text-neutral-800 font-semibold">Đang hẹn lịch</div>
            <div className="text-lg font-bold text-red-700">{scheduledCount} bài</div>
          </div>
          <div className="h-8 w-px bg-neutral-300" aria-hidden="true" />
          <div>
            <div className="text-neutral-800 font-semibold">Đã đăng tự động</div>
            <div className="text-lg font-bold text-blue-700">{publishedCount} bài</div>
          </div>
        </div>
      </section>

      {publisherStream?.status === 'running' && (
        <div className="bg-blue-600 text-white rounded-xl px-5 py-3 flex items-center justify-between gap-4 text-xs font-bold">
          <span>{publisherStream.currentAction}</span>
          <span className="font-mono tabular-nums shrink-0">
            {publisherStream.progress}/{publisherStream.total} kênh
          </span>
        </div>
      )}

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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: AI Composer & Schedule Builder */}
        <section className="lg:col-span-5 bg-white border border-neutral-300 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-base font-bold text-black">
              Soạn &amp; Lên lịch Đăng bài AI
            </h3>
            <button
              type="button"
              onClick={selectAllTargets}
              className="text-xs font-bold text-blue-700 hover:underline whitespace-nowrap"
            >
              Chọn tất cả kênh ({fanpages.filter((p) => p.enabled).length + accounts.filter((a) => a.enabled).length})
            </button>
          </div>

          {/* Target Multi-Select (Fanpages + Owned FB Accounts) */}
          <div className="space-y-2.5">
            <div className="text-xs font-bold text-black">
              1. Chọn đích đăng sở hữu ({selectedTargets.length} đã chọn)
            </div>

            <div className="border border-neutral-300 rounded-lg p-3 space-y-2.5 max-h-48 overflow-y-auto bg-white">
              {fanpages.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-red-700 uppercase tracking-wide flex items-center gap-1">
                    <Flag className="h-3 w-3" />
                    <span>Fanpage sở hữu</span>
                  </div>
                  {fanpages.map((page) => (
                    <label
                      key={page.id}
                      className="flex items-center justify-between gap-2 text-xs text-black cursor-pointer py-0.5"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={isTargetSelected('page', page.id)}
                          onChange={() =>
                            toggleTarget({
                              type: 'page',
                              id: page.id,
                              name: page.name,
                              ownerAccountId: page.ownerAccountId,
                            })
                          }
                          className="h-3.5 w-3.5 accent-red-600 rounded shrink-0"
                        />
                        <span className="truncate font-semibold">{page.name}</span>
                      </span>
                      <span className="text-[11px] font-mono text-neutral-800 shrink-0">
                        Trust {page.trustScore}%
                      </span>
                    </label>
                  ))}
                </div>
              )}

              <div className="space-y-1.5 pt-1 border-t border-neutral-200">
                <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wide flex items-center gap-1">
                  <UserCheck className="h-3 w-3" />
                  <span>Nick FB cá nhân sở hữu</span>
                </div>
                {accounts.map((acc) => (
                  <label
                    key={acc.id}
                    className="flex items-center justify-between gap-2 text-xs text-black cursor-pointer py-0.5"
                  >
                    <span className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={isTargetSelected('profile', acc.id)}
                        onChange={() =>
                          toggleTarget({
                            type: 'profile',
                            id: acc.id,
                            name: acc.name,
                            ownerAccountId: acc.id,
                          })
                        }
                        className="h-3.5 w-3.5 accent-blue-600 rounded shrink-0"
                      />
                      <span className="truncate font-semibold">{acc.name}</span>
                    </span>
                    <span className="text-[11px] text-neutral-800 shrink-0">
                      {acc.warmupStage.split('(')[0].trim()}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Topic & AI Generator */}
          <div className="space-y-3 pt-2 border-t border-neutral-200">
            <div>
              <label
                htmlFor="pub-topic-input"
                className="block text-xs font-bold text-black mb-1"
              >
                2. Chủ đề / Sản phẩm cần viết bài
              </label>
              <input
                id="pub-topic-input"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="VD: Robot hút bụi X10 Pro chống rối lông mèo, ưu đãi 9.490k"
                className="w-full h-10 px-3 rounded-lg border border-neutral-400 bg-white text-sm text-black placeholder:text-neutral-500 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="pub-goal-select"
                  className="block text-xs font-bold text-black mb-1"
                >
                  Mục tiêu bài viết
                </label>
                <select
                  id="pub-goal-select"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value as PostGoal)}
                  className="w-full h-10 px-2.5 rounded-lg border border-neutral-400 bg-white text-xs text-black focus:border-blue-600 focus:outline-none"
                >
                  <option value="Review sản phẩm">Review sản phẩm</option>
                  <option value="Bán hàng / Chốt đơn">Bán hàng / Chốt đơn</option>
                  <option value="Nuôi tương tác tự nhiên">Nuôi tương tác tự nhiên</option>
                  <option value="Chia sẻ kiến thức">Chia sẻ kiến thức</option>
                  <option value="Khuyến mãi">Khuyến mãi</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="pub-tone-input"
                  className="block text-xs font-bold text-black mb-1"
                >
                  Tone giọng AI
                </label>
                <input
                  id="pub-tone-input"
                  type="text"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full h-10 px-2.5 rounded-lg border border-neutral-400 bg-white text-xs text-black focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-black cursor-pointer">
                <input
                  type="checkbox"
                  checked={useRag}
                  onChange={(e) => setUseRag(e.target.checked)}
                  className="h-4 w-4 accent-blue-600 rounded"
                />
                <span>Lấy dữ liệu từ Kho RAG ({docsCount} tài liệu)</span>
              </label>

              <button
                type="button"
                onClick={handleGenerateAi}
                disabled={generating}
                className="h-9 px-3.5 inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-bold whitespace-nowrap shrink-0"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{generating ? 'AI đang viết...' : 'AI Sinh nội dung'}</span>
              </button>
            </div>
          </div>

          {/* Editable AI Output */}
          <div className="space-y-3 pt-2 border-t border-neutral-200">
            <div>
              <label
                htmlFor="pub-title-input"
                className="block text-xs font-bold text-black mb-1"
              >
                Tiêu đề quản lý chiến dịch
              </label>
              <input
                id="pub-title-input"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tự điền khi AI sinh bài hoặc nhập tên chiến dịch..."
                className="w-full h-9 px-3 rounded-lg border border-neutral-400 bg-white text-xs text-black placeholder:text-neutral-500 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="pub-content-textarea"
                  className="text-xs font-bold text-black"
                >
                  Nội dung bài đăng Facebook
                </label>
                {aiCitations.length > 0 && (
                  <span className="text-[11px] font-bold text-blue-700">
                    RAG: {aiCitations.join(', ')}
                  </span>
                )}
              </div>
              <textarea
                id="pub-content-textarea"
                rows={5}
                value={aiContent}
                onChange={(e) => setAiContent(e.target.value)}
                placeholder="Nội dung AI sinh ra sẽ hiển thị tại đây (bạn có thể sửa lại câu chữ trước khi hẹn lịch)..."
                className="w-full p-3 rounded-lg border border-neutral-400 bg-white text-xs leading-relaxed text-black placeholder:text-neutral-500 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="pub-hashtags-input"
                className="block text-xs font-bold text-black mb-1"
              >
                Hashtags
              </label>
              <input
                id="pub-hashtags-input"
                type="text"
                value={hashtagsText}
                onChange={(e) => setHashtagsText(e.target.value)}
                placeholder="#RobotHutBui #GiaDungThongMinh"
                className="w-full h-9 px-3 rounded-lg border border-neutral-400 bg-white text-xs font-mono text-blue-700 placeholder:text-neutral-500 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Schedule Settings */}
          <div className="space-y-3 pt-2 border-t border-neutral-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="pub-schedule-time"
                  className="block text-xs font-bold text-black mb-1"
                >
                  3. Thời gian đăng dự kiến
                </label>
                <input
                  id="pub-schedule-time"
                  type="datetime-local"
                  value={scheduledLocal}
                  onChange={(e) => setScheduledLocal(e.target.value)}
                  className="w-full h-10 px-2.5 rounded-lg border border-neutral-400 bg-white text-xs font-mono text-black focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label
                  htmlFor="pub-recurrence-select"
                  className="block text-xs font-bold text-black mb-1"
                >
                  Chu kỳ tự động lặp lại
                </label>
                <select
                  id="pub-recurrence-select"
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as PostRecurrence)}
                  className="w-full h-10 px-2.5 rounded-lg border border-neutral-400 bg-white text-xs text-black focus:border-blue-600 focus:outline-none"
                >
                  <option value="once">Đăng 1 lần theo lịch</option>
                  <option value="daily">Tự động lặp Hàng ngày</option>
                  <option value="every_2_days">Lặp Cách 2 ngày</option>
                  <option value="weekly">Tự động lặp Hàng tuần</option>
                </select>
              </div>
            </div>

            <label className="inline-flex items-center gap-2 text-xs font-medium text-neutral-900 cursor-pointer">
              <input
                type="checkbox"
                checked={perTargetVariation}
                onChange={(e) => setPerTargetVariation(e.target.checked)}
                className="h-4 w-4 accent-blue-600 rounded"
              />
              <span>Tự động xoay biến thể nhẹ câu chữ khi đăng nhiều kênh (Anti-Spam)</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                disabled={saving}
                onClick={() => submitSchedule(false)}
                className="h-10 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold"
              >
                <CalendarClock className="h-4 w-4" />
                <span>{saving ? 'Đang lưu...' : 'Lưu Lịch Tự động'}</span>
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => submitSchedule(true)}
                className="h-10 inline-flex items-center justify-center gap-2 rounded-lg border border-blue-600 bg-white hover:bg-blue-600 hover:text-white transition-colors disabled:opacity-60 text-blue-700 text-xs font-bold"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Lưu &amp; Đăng ngay</span>
              </button>
            </div>
          </div>
        </section>

        {/* Right: Scheduled & Published Posts Feed */}
        <section className="lg:col-span-7 bg-white border border-neutral-300 rounded-xl overflow-hidden">
          <div className="px-6 py-4 bg-white border-b border-neutral-300 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold text-black">
                Danh sách Lịch đăng &amp; Lịch sử Auto-Post ({filteredPosts.length})
              </h3>
              <p className="text-xs text-neutral-800 mt-0.5">
                Hệ thống tự động kiểm tra và đăng bài đúng giờ hẹn lên các FB &amp; Fanpage đã chọn
              </p>
            </div>

            <div className="flex items-center gap-1.5 text-xs">
              {(
                [
                  { id: 'ALL', label: 'Tất cả' },
                  { id: 'scheduled', label: 'Đang hẹn lịch' },
                  { id: 'published', label: 'Đã đăng' },
                  { id: 'paused', label: 'Tạm dừng' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterStatus(tab.id)}
                  className={`px-2.5 py-1.5 rounded-lg font-bold whitespace-nowrap transition-colors ${
                    filterStatus === tab.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-white border border-neutral-300 text-black hover:border-blue-600'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-neutral-200">
            {filteredPosts.length === 0 ? (
              <div className="p-10 text-center text-sm font-medium text-neutral-800">
                Chưa có bài đăng nào trong mục này. Hãy dùng AI soạn bài bên trái để lên lịch tự động!
              </div>
            ) : (
              filteredPosts.map((post) => {
                const isPublished = post.status === 'published';
                const isPaused = post.status === 'paused';
                const isPublishing = post.status === 'publishing' || publishingId === post.id;

                return (
                  <article key={post.id} className="p-5 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-display text-sm font-bold text-black">
                            {post.title}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded-md border text-[11px] font-bold bg-white ${
                              isPublished
                                ? 'border-blue-600 text-blue-700'
                                : isPublishing
                                  ? 'border-blue-600 text-blue-700'
                                  : isPaused
                                    ? 'border-neutral-400 text-black'
                                    : 'border-red-600 text-red-700'
                            }`}
                          >
                            {isPublished
                              ? 'Đã đăng'
                              : isPublishing
                                ? 'Đang đăng...'
                                : isPaused
                                  ? 'Tạm dừng'
                                  : 'Đang hẹn lịch'}
                          </span>
                          <span className="text-[11px] font-semibold text-neutral-800">
                            · {RECURRENCE_LABELS[post.recurrence]}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-800 font-mono tabular-nums">
                          <span className="inline-flex items-center gap-1 text-red-700 font-bold">
                            <Clock className="h-3.5 w-3.5" />
                            <span>Hẹn đăng: {formatShortDateTime(post.scheduledAt)}</span>
                          </span>
                          {post.publishedAt && (
                            <span className="inline-flex items-center gap-1 text-blue-700 font-bold">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Đăng gần nhất: {formatShortDateTime(post.publishedAt)}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={isPublishing}
                          onClick={() => handlePublishNow(post.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          <Send className="h-3 w-3" />
                          <span>{isPublishing ? 'Đang đăng...' : 'Đăng ngay'}</span>
                        </button>

                        {post.status !== 'published' && (
                          <button
                            type="button"
                            onClick={() => onTogglePause(post.id)}
                            aria-label={`${isPaused ? 'Tiếp tục' : 'Tạm dừng'} lịch ${post.title}`}
                            className="px-2.5 py-1.5 rounded-lg border border-neutral-300 bg-white text-black hover:border-blue-600 text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap"
                          >
                            {isPaused ? (
                              <>
                                <PlayCircle className="h-3.5 w-3.5 text-blue-600" />
                                <span>Tiếp tục</span>
                              </>
                            ) : (
                              <>
                                <PauseCircle className="h-3.5 w-3.5 text-red-600" />
                                <span>Tạm dừng</span>
                              </>
                            )}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onDeletePost(post.id)}
                          aria-label={`Xóa lịch đăng ${post.title}`}
                          className="p-1.5 rounded-lg border border-neutral-300 bg-white text-black hover:text-red-600 hover:border-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Targets badges */}
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-black font-bold mr-1">Kênh đích:</span>
                      {post.targets.map((t) => (
                        <span
                          key={`${t.type}_${t.id}`}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border bg-white text-[11px] font-bold ${
                            t.type === 'page'
                              ? 'border-red-600 text-red-700'
                              : 'border-blue-600 text-blue-700'
                          }`}
                        >
                          {t.type === 'page' ? (
                            <Flag className="h-2.5 w-2.5" />
                          ) : (
                            <UserCheck className="h-2.5 w-2.5" />
                          )}
                          <span>{t.name}</span>
                        </span>
                      ))}
                    </div>

                    {/* AI Post Content Preview */}
                    <div className="bg-white border border-neutral-300 rounded-lg p-3.5 text-xs text-black whitespace-pre-line leading-relaxed">
                      {post.aiContent}
                      {post.hashtags.length > 0 && (
                        <div className="mt-2 font-mono font-semibold text-blue-700">
                          {post.hashtags.join(' ')}
                        </div>
                      )}
                    </div>

                    {/* Published Permalinks */}
                    {post.publishedUrls.length > 0 && (
                      <div className="bg-white border border-blue-600 rounded-lg p-3 space-y-1.5 text-xs">
                        <div className="font-bold text-blue-700">
                          Liên kết bài đã tự động đăng ({post.publishedUrls.length}):
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {post.publishedUrls.slice(0, 6).map((link, i) => (
                            <a
                              key={`${link.targetId}_${i}`}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-blue-700 hover:underline font-bold"
                            >
                              <span>{link.targetName}</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
