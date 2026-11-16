import {
  BookOpen,
  BotMessageSquare,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Upload,
} from 'lucide-react';
import { useState } from 'react';
import type { KnowledgeDoc, KnowledgeSourceType, ScannedPost } from '../../shared/types';
import { formatShortDateTime } from '../utils/formatters';

interface AiContentViewProps {
  posts: ScannedPost[];
  docs: KnowledgeDoc[];
  focusedPostId: string | null;
  onGenerateReply: (postId: string, toneOverride?: string) => Promise<void>;
  onSaveReplyAction: (
    postId: string,
    aiReply: string,
    action: 'save' | 'copy' | 'approve'
  ) => Promise<void>;
  onAddDoc: (doc: { title: string; category: string; content: string }) => Promise<void>;
  onUploadDocFile: (params: {
    file: File;
    title: string;
    category: string;
  }) => Promise<{ sourceType: string; chunkCount: number }>;
  onDeleteDoc: (docId: string) => Promise<void>;
}

function formatBytes(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getSourceMeta(sourceType: KnowledgeSourceType) {
  switch (sourceType) {
    case 'audio':
      return {
        label: 'Âm thanh',
        icon: FileAudio,
        badgeClass: 'bg-white text-blue-700 border-blue-600',
        iconClass: 'text-blue-600',
      };
    case 'video':
      return {
        label: 'Video',
        icon: FileVideo,
        badgeClass: 'bg-white text-red-700 border-red-600',
        iconClass: 'text-red-600',
      };
    case 'image':
      return {
        label: 'Hình ảnh',
        icon: FileImage,
        badgeClass: 'bg-white text-red-700 border-red-600',
        iconClass: 'text-red-600',
      };
    case 'document':
      return {
        label: 'Tài liệu',
        icon: FileText,
        badgeClass: 'bg-white text-blue-700 border-blue-600',
        iconClass: 'text-blue-600',
      };
    default:
      return {
        label: 'Văn bản',
        icon: FileText,
        badgeClass: 'bg-white text-black border-neutral-400',
        iconClass: 'text-black',
      };
  }
}

export function AiContentView({
  posts,
  docs,
  focusedPostId,
  onGenerateReply,
  onSaveReplyAction,
  onAddDoc,
  onUploadDocFile,
  onDeleteDoc,
}: AiContentViewProps) {
  const [subTab, setSubTab] = useState<'workbench' | 'knowledge'>('workbench');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Chưa tạo' | 'Đã tạo AI' | 'Đã duyệt'>('ALL');
  const [toneOverride, setToneOverride] = useState('');
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [draftEdits, setDraftEdits] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [docTitle, setDocTitle] = useState('');
  const [docCategory, setDocCategory] = useState('Sản phẩm chủ lực');
  const [docContent, setDocContent] = useState('');
  const [addingDoc, setAddingDoc] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const filteredPosts = posts.filter((p) => {
    if (statusFilter === 'Chưa tạo') return p.replyStatus === 'Chưa tạo';
    if (statusFilter === 'Đã tạo AI') return p.replyStatus === 'Đã tạo AI' || p.replyStatus === 'Đã Copy';
    if (statusFilter === 'Đã duyệt')
      return p.replyStatus === 'Đã duyệt (Auto-Comment)' || p.replyStatus === 'Đã gửi';
    return true;
  });

  const orderedPosts = focusedPostId
    ? [...filteredPosts].sort((a, b) => (a.id === focusedPostId ? -1 : b.id === focusedPostId ? 1 : 0))
    : filteredPosts;

  const handleGenerate = async (postId: string) => {
    setGeneratingId(postId);
    setActionMsg(null);
    try {
      await onGenerateReply(postId, toneOverride || undefined);
      setDraftEdits((prev) => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
    } catch (err) {
      setActionMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Lỗi khi gọi Gemini AI.',
      });
    } finally {
      setGeneratingId(null);
    }
  };

  const handleCopy = async (post: ScannedPost) => {
    const text = (draftEdits[post.id] ?? post.aiReply ?? '').trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API fallback ignored safely
    }
    setCopiedId(post.id);
    setTimeout(() => setCopiedId((prev) => (prev === post.id ? null : prev)), 2000);
    await onSaveReplyAction(post.id, text, 'copy');
  };

  const handleApprove = async (post: ScannedPost) => {
    const text = (draftEdits[post.id] ?? post.aiReply ?? '').trim();
    if (!text) {
      setActionMsg({ type: 'err', text: 'Chưa có nội dung AI để duyệt Auto-Comment.' });
      return;
    }
    setActionMsg(null);
    try {
      await onSaveReplyAction(post.id, text, 'approve');
      setActionMsg({
        type: 'ok',
        text: `Đã duyệt bình luận cho ${post.authorName} vào hàng đợi Auto-Comment an toàn.`,
      });
    } catch (err) {
      setActionMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Không thể duyệt bình luận.',
      });
    }
  };

  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionMsg(null);
    if (!docTitle.trim() || !docContent.trim()) {
      setActionMsg({ type: 'err', text: 'Vui lòng nhập tiêu đề và nội dung tài liệu nguồn.' });
      return;
    }
    setAddingDoc(true);
    try {
      await onAddDoc({
        title: docTitle.trim(),
        category: docCategory,
        content: docContent.trim(),
      });
      setDocTitle('');
      setDocContent('');
      setActionMsg({ type: 'ok', text: 'Đã nạp tài liệu mới vào Kho RAG.' });
    } catch (err) {
      setActionMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Không thể lưu tài liệu.',
      });
    } finally {
      setAddingDoc(false);
    }
  };

  const processUploadedFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setActionMsg(null);
    const files = Array.from(fileList);
    let successCount = 0;

    for (const file of files) {
      if (file.size > 50 * 1024 * 1024) {
        setActionMsg({
          type: 'err',
          text: `File "${file.name}" vượt quá giới hạn 50MB.`,
        });
        continue;
      }

      setUploadingFileName(file.name);
      try {
        const resolvedTitle =
          files.length === 1 && docTitle.trim()
            ? docTitle.trim()
            : file.name.replace(/\.[^.]+$/, '') || file.name;
        const res = await onUploadDocFile({
          file,
          title: resolvedTitle,
          category: docCategory,
        });
        successCount++;
        setActionMsg({
          type: 'ok',
          text:
            files.length === 1
              ? `Đã trích xuất nội dung file "${file.name}" (${res.chunkCount} chunks) vào Kho RAG.`
              : `Đã nạp thành công ${successCount}/${files.length} file đa phương tiện vào Kho RAG.`,
        });
      } catch (err) {
        setActionMsg({
          type: 'err',
          text: err instanceof Error ? err.message : `Không thể xử lý file "${file.name}".`,
        });
      } finally {
        setUploadingFileName(null);
      }
    }

    if (successCount > 0 && files.length === 1) {
      setDocTitle('');
    }
  };

  const handleUploadAnyFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await processUploadedFiles(e.target.files);
    e.target.value = '';
  };

  const handleDropFiles = async (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragActive(false);
    await processUploadedFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-6">
      {/* Pure White Blue-Accented Banner */}
      <section className="bg-white border border-neutral-300 border-t-2 border-t-blue-600 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
            <BotMessageSquare className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-black">
              Module 3 · Kho tài liệu RAG &amp; Xưởng Sinh Content AI (2 Cột)
            </h2>
            <p className="text-sm text-neutral-800 mt-0.5">
              Đối chiếu ngữ cảnh khách hàng ở Cột 1 và nội dung AI đề xuất ở Cột 2 để Copy dán tay hoặc Approve chạy Auto-Comment.
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-1 p-1 bg-white border border-neutral-300 rounded-lg self-start lg:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setSubTab('workbench')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              subTab === 'workbench'
                ? 'bg-blue-600 text-white'
                : 'text-black hover:text-blue-700'
            }`}
          >
            <Send className="h-3.5 w-3.5" />
            <span>Xưởng Content AI (2 Cột)</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('knowledge')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              subTab === 'knowledge'
                ? 'bg-red-600 text-white'
                : 'text-black hover:text-red-700'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Kho tài liệu nguồn RAG ({docs.length})</span>
          </button>
        </div>
      </section>

      {subTab === 'workbench' && (
        <div className="bg-white border border-neutral-300 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 p-1 bg-white border border-neutral-300 rounded-lg">
            {(['ALL', 'Chưa tạo', 'Đã tạo AI', 'Đã duyệt'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
                  statusFilter === st
                    ? st === 'Chưa tạo'
                      ? 'bg-red-600 text-white'
                      : 'bg-blue-600 text-white'
                    : 'text-black hover:text-blue-700'
                }`}
              >
                {st === 'ALL' ? 'Tất cả' : st}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={toneOverride}
            onChange={(e) => setToneOverride(e.target.value)}
            aria-label="Tùy chỉnh phong cách trả lời AI"
            placeholder="Tone giọng tùy chọn (VD: chuyên gia kỹ thuật)..."
            className="h-9 px-3 rounded-lg border border-neutral-300 bg-white text-xs text-black placeholder:text-neutral-500 w-full sm:w-72 focus:border-blue-600 focus:outline-none"
          />
        </div>
      )}

      {actionMsg && (
        <div
          role={actionMsg.type === 'err' ? 'alert' : 'status'}
          className={`px-4 py-3 rounded-xl border-2 bg-white text-xs font-semibold ${
            actionMsg.type === 'err'
              ? 'border-red-600 text-red-700'
              : 'border-blue-600 text-blue-700'
          }`}
        >
          {actionMsg.text}
        </div>
      )}

      {subTab === 'knowledge' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-5 bg-white border border-neutral-300 rounded-xl p-6 space-y-5">
            <div>
              <h3 className="font-display text-base font-bold text-black">
                Nạp tài liệu nguồn đa phương tiện (RAG)
              </h3>
              <p className="text-xs text-neutral-800 mt-0.5">
                Hỗ trợ tải lên mọi file âm thanh, video, hình ảnh hoặc tài liệu để AI tự động trích xuất kiến thức.
              </p>
            </div>

            {/* Multimodal Dropzone accepting ANY file */}
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDropFiles}
              className={`block rounded-xl border-2 border-dashed p-5 text-center cursor-pointer transition-colors bg-white ${
                dragActive
                  ? 'border-blue-600'
                  : uploadingFileName
                    ? 'border-red-600'
                    : 'border-neutral-400 hover:border-blue-600'
              }`}
            >
              <input
                type="file"
                multiple
                disabled={Boolean(uploadingFileName)}
                onChange={handleUploadAnyFile}
                aria-label="Tải lên file âm thanh, video, hình ảnh hoặc tài liệu vào Kho RAG"
                className="sr-only"
              />
              <div className="flex flex-col items-center gap-2">
                {uploadingFileName ? (
                  <>
                    <Loader2 className="h-7 w-7 text-red-600 animate-spin" />
                    <div className="text-sm font-semibold text-red-700">
                      Đang phân tích &amp; trích xuất: {uploadingFileName}
                    </div>
                    <p className="text-xs text-neutral-800">
                      Hệ thống đang đọc nội dung / chép lời và lập chỉ mục vào Kho RAG...
                    </p>
                  </>
                ) : (
                  <>
                    <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
                      <Upload className="h-5 w-5" />
                    </div>
                    <div className="text-sm font-bold text-black">
                      Kéo thả hoặc bấm chọn bất kỳ file nào (tối đa 50MB)
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 w-full max-w-sm pt-1 text-left text-xs text-black font-medium">
                      <div className="flex items-center gap-1.5 bg-white border border-neutral-300 rounded-md px-2 py-1">
                        <FileAudio className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        <span>Âm thanh (MP3, WAV, M4A)</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white border border-neutral-300 rounded-md px-2 py-1">
                        <FileVideo className="h-3.5 w-3.5 text-red-600 shrink-0" />
                        <span>Video (MP4, MOV, WebM)</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white border border-neutral-300 rounded-md px-2 py-1">
                        <FileImage className="h-3.5 w-3.5 text-red-600 shrink-0" />
                        <span>Hình ảnh (PNG, JPG, WebP)</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white border border-neutral-300 rounded-md px-2 py-1">
                        <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        <span>PDF, DOCX, XLSX, TXT</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </label>

            <form onSubmit={handleCreateDoc} className="space-y-4">
              <div>
                <label
                  htmlFor="rag-doc-title"
                  className="block text-xs font-semibold text-black mb-1"
                >
                  Tiêu đề tài liệu
                </label>
                <input
                  id="rag-doc-title"
                  type="text"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder="VD: Bảng giá & Ưu đãi Tháng 11"
                  className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm text-black focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="rag-doc-category"
                  className="block text-xs font-semibold text-black mb-1"
                >
                  Phân loại kiến thức
                </label>
                <select
                  id="rag-doc-category"
                  value={docCategory}
                  onChange={(e) => setDocCategory(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-neutral-300 bg-white text-sm text-black focus:border-blue-600 focus:outline-none"
                >
                  <option value="Sản phẩm chủ lực">Sản phẩm chủ lực</option>
                  <option value="Bảng giá & Khuyến mãi">Bảng giá &amp; Khuyến mãi</option>
                  <option value="Playbook Sales">Playbook Sales</option>
                  <option value="Chính sách bảo hành">Chính sách bảo hành</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="rag-doc-content"
                  className="block text-xs font-semibold text-black mb-1"
                >
                  Nội dung chi tiết (AI sẽ trích xuất thông tin từ đây)
                </label>
                <textarea
                  id="rag-doc-content"
                  rows={7}
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  placeholder="Nhập thông số sản phẩm, USP, bảng giá, chính sách đổi trả, kịch bản xử lý từ chối..."
                  className="w-full p-3 rounded-lg border border-neutral-300 bg-white text-sm text-black focus:border-blue-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={addingDoc}
                className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>{addingDoc ? 'Đang lập chỉ mục...' : 'Lưu vào Kho RAG'}</span>
              </button>
            </form>
          </section>

          <section className="lg:col-span-7 bg-white border border-neutral-300 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-300">
              <h3 className="font-display text-base font-bold text-black">
                Tài liệu nguồn đang được lập chỉ mục
              </h3>
              <p className="text-xs text-neutral-800 mt-0.5">
                Hệ thống tự động chia đoạn (chunking) và truy xuất ngữ nghĩa TF-IDF khi AI sinh bình luận.
              </p>
            </div>

            {docs.length === 0 ? (
              <div className="p-10 text-center text-sm text-neutral-800 bg-white">
                Kho tài liệu đang trống. Hãy thêm tài liệu đầu tiên bên trái.
              </div>
            ) : (
              <div className="divide-y divide-neutral-200 bg-white">
                {docs.map((doc) => {
                  const meta = getSourceMeta(doc.sourceType);
                  const SourceIcon = meta.icon;
                  const sizeLabel = formatBytes(doc.fileSize);
                  return (
                    <div key={doc.id} className="p-6 space-y-2.5 bg-white">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <SourceIcon className={`h-4 w-4 shrink-0 ${meta.iconClass}`} />
                            <h4 className="text-sm font-bold text-black">{doc.title}</h4>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold ${meta.badgeClass}`}
                            >
                              {meta.label}
                            </span>
                          </div>
                          <div className="text-xs text-neutral-800 mt-1 font-mono tabular-nums flex flex-wrap items-center gap-x-2">
                            <span className="font-semibold text-blue-700">{doc.category}</span>
                            {doc.fileName && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-black">{doc.fileName}</span>
                              </>
                            )}
                            {sizeLabel && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{sizeLabel}</span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span>{doc.chunkCount} chunks</span>
                            <span aria-hidden="true">·</span>
                            <span>Cập nhật {formatShortDateTime(doc.updatedAt)}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onDeleteDoc(doc.id)}
                          aria-label={`Xóa tài liệu ${doc.title}`}
                          className="p-1.5 rounded-lg border border-transparent text-red-600 hover:border-red-600 bg-white transition-colors shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-xs text-black leading-relaxed whitespace-pre-line">
                        {doc.content}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      ) : (
        <section aria-label="Giao diện 2 cột sinh nội dung AI" className="space-y-4">
          {orderedPosts.length === 0 ? (
            <div className="bg-white border border-neutral-300 rounded-xl p-12 text-center">
              <p className="text-sm font-semibold text-black">
                Không có bài đăng hoặc bình luận nào trong bộ lọc này
              </p>
              <p className="text-xs text-neutral-800 mt-1">
                Hãy chạy Module 2 (Quét Nội dung) hoặc chuyển bộ lọc sang Tất cả.
              </p>
            </div>
          ) : (
            orderedPosts.map((post) => {
              const currentText = draftEdits[post.id] ?? post.aiReply ?? '';
              const isGenerating = generatingId === post.id;
              const isApproved =
                post.replyStatus === 'Đã duyệt (Auto-Comment)' || post.replyStatus === 'Đã gửi';

              return (
                <article
                  key={post.id}
                  className="bg-white border border-neutral-300 rounded-xl overflow-hidden"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-neutral-300">
                    {/* Cột 1: Nội dung khách hàng */}
                    <div className="p-6 flex flex-col justify-between gap-4 bg-white">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-bold text-black">
                            Cột 1 · Nội dung khách hàng ({post.postType})
                          </span>
                          <a
                            href={post.directUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline whitespace-nowrap shrink-0"
                          >
                            <span>Mở trên Facebook</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>

                        <div className="text-xs text-neutral-800 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-bold text-black">{post.authorName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-medium">{post.groupName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {formatShortDateTime(post.postedAt)}
                          </span>
                        </div>

                        <p className="text-sm text-black leading-relaxed bg-white border border-neutral-300 rounded-lg p-4">
                          {post.content}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-black pt-1">
                        <div>
                          Từ khóa:{' '}
                          <span className="font-bold text-red-700">{post.keywordFound}</span>
                          <span className="mx-1.5" aria-hidden="true">
                            ·
                          </span>
                          <span
                            className={
                              post.commentApproval === 'Tự do bình luận'
                                ? 'text-blue-700 font-semibold'
                                : 'text-red-700 font-semibold'
                            }
                          >
                            {post.commentApproval}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Cột 2: Nội dung AI đề xuất */}
                    <div className="p-6 flex flex-col justify-between gap-4 bg-white">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-bold text-blue-700">
                            Cột 2 · Nội dung AI đề xuất (RAG)
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold ${
                              isApproved
                                ? 'text-blue-700'
                                : post.replyStatus === 'Chưa tạo'
                                  ? 'text-red-700'
                                  : 'text-black'
                            }`}
                          >
                            {isApproved && <CheckCircle2 className="h-3.5 w-3.5" />}
                            <span>{post.replyStatus}</span>
                          </span>
                        </div>

                        {post.aiCitations.length > 0 && (
                          <div className="text-xs text-neutral-800">
                            Nguồn tham chiếu:{' '}
                            <span className="text-black font-semibold">
                              {post.aiCitations.join(' · ')}
                            </span>
                          </div>
                        )}

                        <textarea
                          rows={4}
                          value={currentText}
                          onChange={(e) =>
                            setDraftEdits((prev) => ({ ...prev, [post.id]: e.target.value }))
                          }
                          aria-label={`Nội dung AI đề xuất cho ${post.authorName}`}
                          placeholder="Chưa có phản hồi AI. Bấm nút Sinh AI Content bên dưới để AI đọc Kho tài liệu nguồn và đề xuất câu trả lời..."
                          className="w-full p-3.5 rounded-lg border border-neutral-300 bg-white text-sm text-black leading-relaxed placeholder:text-neutral-500 focus:border-blue-600 focus:outline-none"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          disabled={isGenerating}
                          onClick={() => handleGenerate(post.id)}
                          aria-label={`${currentText ? 'Sinh lại AI' : 'Sinh AI Content'} cho ${post.authorName}`}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-red-600 bg-white hover:bg-red-600 hover:text-white disabled:opacity-60 text-xs font-semibold text-red-700 whitespace-nowrap shrink-0 transition-colors"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                          <span>
                            {isGenerating
                              ? 'Đang sinh AI...'
                              : currentText
                                ? 'Sinh lại AI'
                                : 'Sinh AI Content'}
                          </span>
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={!currentText.trim()}
                            onClick={() => handleCopy(post)}
                            aria-label={`Copy nội dung trả lời cho ${post.authorName}`}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-neutral-300 bg-white hover:border-black disabled:opacity-50 text-xs font-semibold text-black whitespace-nowrap shrink-0 transition-colors"
                          >
                            {copiedId === post.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-blue-600" />
                                <span className="text-blue-700">Đã Copy</span>
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            disabled={!currentText.trim() || isApproved}
                            onClick={() => handleApprove(post)}
                            aria-label={`Approve tự động bình luận cho ${post.authorName}`}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
                          >
                            <Send className="h-3.5 w-3.5" />
                            <span>{isApproved ? 'Đã Approve' : 'Approve'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      )}
    </div>
  );
}
