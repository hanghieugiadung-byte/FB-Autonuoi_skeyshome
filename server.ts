import 'dotenv/config';
import express from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  addActivityLog,
  createAppSession,
  db,
  deleteAppSession,
  getDashboardSnapshot,
  getDatabaseStats,
  getSafetyConfig,
  getSystemSettings,
  getTodayUsage,
  incrementTodayUsage,
  isAppSessionValid,
  listDatasets,
  listFacebookAccounts,
  listFanpages,
  listGroups,
  listKnowledgeDocs,
  listScanJobs,
  listScannedPosts,
  listScheduledPosts,
  listStreams,
  seedDatabaseIfEmpty,
  updateAppPasscode,
  updateSafetyConfig,
  updateSystemSettings,
  verifyAppPasscode,
} from './server/db.ts';
import { generateSessionToken, validatePasscode } from './server/lib/auth.ts';
import { generatePersonaDraft } from './server/lib/nurturing.ts';
import { chunkDocument } from './server/lib/rag.ts';
import { buildCsvDocument, isWithinActiveHours } from './server/lib/safety.ts';
import {
  broadcastSnapshot,
  getStarterScripts,
  publishScheduledPostNow,
  registerSseClient,
  runGroupFinder,
  startKeywordScannerJob,
  startScheduledPostDispatcher,
  startWarmupJob,
  stopStream,
} from './server/services/automationEngine.ts';
import {
  extractKnowledgeFromUploadedFile,
  generateContextualReply,
  generateScheduledSocialPost,
} from './server/services/geminiService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

seedDatabaseIfEmpty();

function extractSessionToken(req: express.Request): string {
  const authHeader = String(req.headers.authorization ?? '');
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  const queryToken = typeof req.query?.token === 'string' ? req.query.token.trim() : '';
  return queryToken;
}

const requireAuth: express.RequestHandler = (req, res, next) => {
  const token = extractSessionToken(req);
  if (!isAppSessionValid(token)) {
    res.status(401).json({ error: 'Phiên truy cập đã khóa hoặc hết hạn. Vui lòng nhập mật mã.' });
    return;
  }
  next();
};

async function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  // Multimodal file upload route (supports audio, video, image, PDF, Office, text up to 50MB)
  app.post(
    '/api/knowledge/upload',
    requireAuth,
    express.raw({ type: '*/*', limit: '50mb' }),
    async (req, res) => {
      try {
        const rawFileNameHeader = String(req.headers['x-file-name'] ?? '').trim();
        const fileName = rawFileNameHeader
          ? decodeURIComponent(rawFileNameHeader)
          : 'tai-lieu-tai-len.bin';

        const rawTitleHeader = String(req.headers['x-doc-title'] ?? '').trim();
        const customTitle = rawTitleHeader ? decodeURIComponent(rawTitleHeader).trim() : '';
        const title = customTitle || fileName.replace(/\.[^.]+$/, '') || fileName;

        const rawCategoryHeader = String(req.headers['x-doc-category'] ?? '').trim();
        const category = rawCategoryHeader
          ? decodeURIComponent(rawCategoryHeader).trim()
          : 'Tài liệu đa phương tiện';

        const declaredMimeType = String(
          req.headers['x-file-mime'] || req.headers['content-type'] || ''
        );

        const buffer = Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(typeof req.body === 'string' ? req.body : '');

        if (buffer.length === 0) {
          res.status(400).json({ error: 'File tải lên đang rỗng hoặc không đọc được dữ liệu.' });
          return;
        }

        const extracted = await extractKnowledgeFromUploadedFile({
          buffer,
          fileName,
          declaredMimeType,
        });

        const id = `doc_${Date.now().toString(36)}`;
        const chunks = chunkDocument(extracted.extractedText);
        const now = new Date().toISOString();

        db.prepare(
          `INSERT INTO knowledge_docs (
            id, title, category, content, chunk_count, source_type, file_name, mime_type, file_size, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          id,
          title,
          category,
          extracted.extractedText,
          chunks.length,
          extracted.sourceType,
          fileName,
          extracted.mimeType,
          buffer.length,
          now
        );

        const typeLabelMap: Record<string, string> = {
          audio: 'Âm thanh',
          video: 'Video',
          image: 'Hình ảnh',
          document: 'Tài liệu',
          text: 'Văn bản',
        };
        const typeLabel = typeLabelMap[extracted.sourceType] ?? 'Tài liệu';

        addActivityLog(
          'AI RAG Engine',
          'success',
          `Đã trích xuất & lập chỉ mục ${typeLabel} "${fileName}" (${chunks.length} chunks).`
        );
        broadcastSnapshot();

        res.json({
          ok: true,
          id,
          sourceType: extracted.sourceType,
          extractedText: extracted.extractedText,
          chunkCount: chunks.length,
          docs: listKnowledgeDocs(),
        });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Không thể xử lý và trích xuất nội dung file tải lên.';
        addActivityLog('AI RAG Engine', 'error', message);
        res.status(400).json({ error: message });
      }
    }
  );

  app.use(express.json({ limit: '2mb' }));

  app.get('/api/health', (_req, res) => {
    const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');
    res.json({
      ok: true,
      mode: isProd ? 'production' : 'development',
      pwaAutoUpdate: true,
      timestamp: new Date().toISOString(),
    });
  });

  // Single-Owner Passcode Gate Routes
  app.get('/api/auth/me', (req, res) => {
    const token = extractSessionToken(req);
    const systemSettings = getSystemSettings();
    res.json({
      authenticated: isAppSessionValid(token),
      systemSettings,
    });
  });

  app.post('/api/auth/login', (req, res) => {
    const passcode = String(req.body?.passcode ?? req.body?.password ?? '').trim();
    if (!passcode) {
      res.status(400).json({ error: 'Vui lòng nhập mật mã truy cập.' });
      return;
    }

    if (!verifyAppPasscode(passcode)) {
      res.status(401).json({ error: 'Mật mã truy cập không chính xác.' });
      return;
    }

    const settings = getSystemSettings();
    const token = generateSessionToken();
    const ttlMs = Math.max(1, settings.sessionTimeoutHours) * 60 * 60 * 1000;
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();

    createAppSession(token, expiresAt);
    addActivityLog('Bảo mật', 'info', 'Đã mở khóa hệ thống bằng mật mã truy cập.');

    res.json({ ok: true, token, systemSettings: settings });
  });

  app.post('/api/auth/logout', (req, res) => {
    const token = extractSessionToken(req);
    if (token) {
      deleteAppSession(token);
    }
    res.json({ ok: true });
  });

  const handleChangePasscode: express.RequestHandler = (req, res) => {
    const currentPasscode = String(req.body?.currentPasscode ?? req.body?.currentPassword ?? '').trim();
    const rawNewPasscode = String(req.body?.newPasscode ?? req.body?.newPassword ?? '');

    if (!verifyAppPasscode(currentPasscode)) {
      res.status(400).json({ error: 'Mật mã hiện tại không đúng.' });
      return;
    }

    const check = validatePasscode(rawNewPasscode);
    if (!check.ok) {
      res.status(400).json({ error: check.error });
      return;
    }

    updateAppPasscode(check.passcode);
    addActivityLog('Bảo mật', 'success', 'Đã cập nhật mật mã truy cập hệ thống mới.');
    res.json({ ok: true });
  };

  app.post('/api/auth/change-passcode', requireAuth, handleChangePasscode);
  app.post('/api/auth/change-password', requireAuth, handleChangePasscode);

  app.get('/api/events', requireAuth, (req, res) => {
    registerSseClient(res);
  });

  app.get('/api/dashboard', requireAuth, (_req, res) => {
    res.json(getDashboardSnapshot());
  });

  // Multi-Account Facebook Configuration APIs
  app.get('/api/accounts', requireAuth, (_req, res) => {
    res.json({ accounts: listFacebookAccounts() });
  });

  app.post('/api/accounts/generate-persona', requireAuth, (_req, res) => {
    const existingCount = listFacebookAccounts().length;
    const seed = existingCount * 17 + Math.floor(Date.now() / 1000) % 97;
    res.json({ persona: generatePersonaDraft(seed) });
  });

  app.post('/api/accounts', requireAuth, (req, res) => {
    const name = String(req.body?.name ?? '').trim();
    const fbUid = String(req.body?.fbUid ?? '').trim();
    const cookieData = String(req.body?.cookieData ?? '').trim();
    const proxyEndpoint = String(req.body?.proxyEndpoint ?? '').trim() || 'direct://local-ip';
    const warmupStage = String(req.body?.warmupStage ?? 'Mới (1-7 ngày)');
    const recoveryEmail = String(req.body?.recoveryEmail ?? '').trim();
    const twoFactorSecret = String(req.body?.twoFactorSecret ?? '').trim();
    const maxJoinsPerDay = Math.max(1, Number(req.body?.maxJoinsPerDay ?? 5));
    const maxCommentsPerDay = Math.max(1, Number(req.body?.maxCommentsPerDay ?? 10));

    if (!name || !fbUid || !cookieData) {
      res.status(400).json({
        error: 'Vui lòng nhập đầy đủ Tên tài khoản, Facebook UID và chuỗi Cookie.',
      });
      return;
    }

    const warmupDays =
      warmupStage === 'Tin cậy (>21 ngày)' ? 24 : warmupStage === 'Đang nuôi (8-21 ngày)' ? 10 : 1;
    const trustScore =
      warmupStage === 'Tin cậy (>21 ngày)' ? 85 : warmupStage === 'Đang nuôi (8-21 ngày)' ? 62 : 42;
    const adAccountStatus =
      trustScore >= 82 && warmupDays >= 14
        ? 'Sẵn sàng chạy Ads'
        : trustScore >= 50
          ? 'Đang nuôi Ads'
          : 'Chưa sẵn sàng Ads';

    const id = `acc_${Date.now().toString(36)}`;
    const profileUrl = `https://www.facebook.com/profile.php?id=${encodeURIComponent(fbUid)}`;
    const cookieStatus = cookieData.includes('c_user=') || cookieData.length >= 12 ? 'Hợp lệ' : 'Cần làm mới';
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO fb_accounts (
        id, name, fb_uid, profile_url, cookie_status, cookie_data, proxy_endpoint,
        warmup_stage, warmup_days, trust_score, ad_account_status, recovery_email, two_factor_secret,
        last_warmup_at, posts_published_count, max_joins_per_day, max_comments_per_day,
        joins_today, comments_today, enabled, worker_status, current_task, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, ?, ?, 0, 0, 1, 'idle', 'Sẵn sàng chạy song song & nuôi Ads', ?)
    `).run(
      id,
      name,
      fbUid,
      profileUrl,
      cookieStatus,
      cookieData,
      proxyEndpoint,
      warmupStage,
      warmupDays,
      trustScore,
      adAccountStatus,
      recoveryEmail,
      twoFactorSecret,
      maxJoinsPerDay,
      maxCommentsPerDay,
      now
    );

    addActivityLog('Account Fleet', 'success', `Đã thêm/tạo hồ sơ Nick FB "${name}" vào cụm chạy song song.`);
    broadcastSnapshot();
    res.json({ ok: true, id, accounts: listFacebookAccounts() });
  });

  app.put('/api/accounts/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const existing = listFacebookAccounts().find((a) => a.id === id);
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
      return;
    }

    const name = String(req.body?.name ?? existing.name).trim();
    const proxyEndpoint = String(req.body?.proxyEndpoint ?? existing.proxyEndpoint).trim();
    const cookieData = String(req.body?.cookieData ?? existing.cookieData).trim();
    const warmupStage = String(req.body?.warmupStage ?? existing.warmupStage);
    const maxJoinsPerDay = Math.max(1, Number(req.body?.maxJoinsPerDay ?? existing.maxJoinsPerDay));
    const maxCommentsPerDay = Math.max(1, Number(req.body?.maxCommentsPerDay ?? existing.maxCommentsPerDay));
    const enabled = req.body?.enabled !== undefined ? (req.body.enabled ? 1 : 0) : existing.enabled ? 1 : 0;

    db.prepare(`
      UPDATE fb_accounts SET
        name = ?, proxy_endpoint = ?, cookie_data = ?, warmup_stage = ?,
        max_joins_per_day = ?, max_comments_per_day = ?, enabled = ?
      WHERE id = ?
    `).run(name, proxyEndpoint, cookieData, warmupStage, maxJoinsPerDay, maxCommentsPerDay, enabled, id);

    broadcastSnapshot();
    res.json({ ok: true, accounts: listFacebookAccounts() });
  });

  app.post('/api/accounts/:id/toggle', requireAuth, (req, res) => {
    const { id } = req.params;
    const existing = listFacebookAccounts().find((a) => a.id === id);
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy tài khoản.' });
      return;
    }
    const nextEnabled = existing.enabled ? 0 : 1;
    db.prepare('UPDATE fb_accounts SET enabled = ? WHERE id = ?').run(nextEnabled, id);
    broadcastSnapshot();
    res.json({ ok: true, accounts: listFacebookAccounts() });
  });

  app.delete('/api/accounts/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    const accounts = listFacebookAccounts();
    if (accounts.length <= 1) {
      res.status(400).json({ error: 'Cần giữ lại ít nhất 1 tài khoản Facebook trong hệ thống.' });
      return;
    }
    db.prepare('DELETE FROM fb_accounts WHERE id = ?').run(id);
    addActivityLog('Account Fleet', 'warning', `Đã gỡ tài khoản ${id} khỏi cụm vận hành.`);
    broadcastSnapshot();
    res.json({ ok: true, accounts: listFacebookAccounts() });
  });

  // Module 1: Group Finder & Datasets
  app.get('/api/datasets', requireAuth, (_req, res) => {
    res.json({
      datasets: listDatasets(),
      groups: listGroups(),
    });
  });

  app.get('/api/groups', requireAuth, (req, res) => {
    const datasetId = typeof req.query.datasetId === 'string' ? req.query.datasetId : undefined;
    res.json({
      datasets: listDatasets(),
      groups: listGroups(datasetId),
    });
  });

  app.post('/api/groups/search', requireAuth, (req, res) => {
    const keyword = String(req.body?.keyword ?? '').trim();
    const targetCount = Number(req.body?.targetCount ?? 6);
    const autoJoinPublic = req.body?.autoJoinPublic !== false;
    const accountIds = Array.isArray(req.body?.accountIds)
      ? req.body.accountIds.map((id: unknown) => String(id))
      : undefined;

    if (!keyword) {
      res.status(400).json({ error: 'Vui lòng nhập từ khóa tìm kiếm Group.' });
      return;
    }

    try {
      const result = runGroupFinder({ keyword, targetCount, autoJoinPublic, accountIds });
      broadcastSnapshot();
      res.json({
        ...result,
        datasets: listDatasets(),
        groups: listGroups(result.datasetId),
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Lỗi tìm kiếm Group.' });
    }
  });

  app.post('/api/groups/:id/join', requireAuth, (req, res) => {
    const { id } = req.params;
    const row = db.prepare('SELECT * FROM facebook_groups WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!row) {
      res.status(404).json({ error: 'Không tìm thấy Group.' });
      return;
    }

    const safety = getSafetyConfig();
    const usage = getTodayUsage();
    if (usage.joinsCount >= safety.maxJoinsPerDay) {
      res.status(429).json({
        error: `Đã đạt giới hạn an toàn ${safety.maxJoinsPerDay} lượt Join/ngày.`,
      });
      return;
    }

    const now = new Date().toISOString();
    const nextStatus = row.group_type === 'Public' ? 'Đã tham gia (Auto-Join)' : 'Đang tham gia';
    db.prepare('UPDATE facebook_groups SET join_status = ?, joined_at = ? WHERE id = ?').run(nextStatus, now, id);
    incrementTodayUsage('joins_count', 1);
    addActivityLog('Group Finder', 'success', `Đã gửi yêu cầu tham gia nhóm "${String(row.name)}".`);
    broadcastSnapshot();

    res.json({ ok: true, joinStatus: nextStatus });
  });

  app.delete('/api/datasets/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM group_datasets WHERE id = ?').run(id);
    broadcastSnapshot();
    res.json({ ok: true });
  });

  app.get('/api/groups/export', requireAuth, (req, res) => {
    const datasetId = typeof req.query.datasetId === 'string' ? req.query.datasetId : undefined;
    const groups = listGroups(datasetId);
    const csv = buildCsvDocument(
      [
        'Keyword',
        'Tên Group',
        'Số lượng thành viên',
        'Loại Group',
        'Đăng bài',
        'Bình luận',
        'Link truy cập',
        'Trạng thái tham gia',
        'Tài khoản thực hiện',
      ],
      groups.map((g) => [
        g.keyword,
        g.name,
        g.memberCount,
        g.groupType,
        g.postApproval,
        g.commentApproval,
        g.url,
        g.joinStatus,
        g.accountName,
      ])
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="facebook-groups.csv"');
    res.send(csv);
  });

  // Module 2: Keyword Scanner (Parallel Multi-Account)
  app.get('/api/scanner', requireAuth, (req, res) => {
    const datasetId = typeof req.query.datasetId === 'string' ? req.query.datasetId : undefined;
    res.json({
      jobs: listScanJobs(),
      posts: listScannedPosts(datasetId),
      streams: listStreams(),
    });
  });

  app.post('/api/scanner/start', requireAuth, (req, res) => {
    const datasetId = String(req.body?.datasetId ?? '').trim();
    const trackingKeywordsRaw = req.body?.trackingKeywords;
    const trackingKeywords: string[] = Array.isArray(trackingKeywordsRaw)
      ? trackingKeywordsRaw.map((k) => String(k).trim()).filter(Boolean)
      : String(trackingKeywordsRaw ?? '')
          .split(/[,;\n]+/)
          .map((k) => k.trim())
          .filter(Boolean);

    const accountIds = Array.isArray(req.body?.accountIds)
      ? req.body.accountIds.map((id: unknown) => String(id))
      : undefined;

    const safety = getSafetyConfig();
    const delayMinSec = Number(req.body?.delayMinSec ?? safety.delayMinSec);
    const delayMaxSec = Number(req.body?.delayMaxSec ?? safety.delayMaxSec);

    if (!datasetId) {
      res.status(400).json({ error: 'Vui lòng chọn tập dữ liệu Group cần quét.' });
      return;
    }
    if (trackingKeywords.length === 0) {
      res.status(400).json({ error: 'Vui lòng nhập ít nhất 1 từ khóa cần theo dõi.' });
      return;
    }

    try {
      const { jobId, activeAccountCount } = startKeywordScannerJob({
        datasetId,
        trackingKeywords,
        accountIds,
        delayMinSec: Math.max(1, delayMinSec),
        delayMaxSec: Math.max(delayMinSec, delayMaxSec),
      });
      res.json({ ok: true, jobId, activeAccountCount });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Không thể khởi chạy luồng quét.' });
    }
  });

  app.post('/api/scanner/stop', requireAuth, (_req, res) => {
    stopStream('stream_keyword_scanner');
    addActivityLog('Keyword Scanner', 'warning', 'Đã dừng luồng quét song song theo yêu cầu.');
    res.json({ ok: true });
  });

  app.get('/api/scanner/export', requireAuth, (req, res) => {
    const datasetId = typeof req.query.datasetId === 'string' ? req.query.datasetId : undefined;
    const posts = listScannedPosts(datasetId);
    const csv = buildCsvDocument(
      [
        'Từ khóa tìm thấy',
        'Tên Group',
        'Đăng bài',
        'Bình luận',
        'Loại',
        'Link truy cập',
        'Nội dung chi tiết',
        'Thời gian đăng',
        'Người đăng',
        'Tài khoản quét',
        'Trạng thái AI',
      ],
      posts.map((p) => [
        p.keywordFound,
        p.groupName,
        p.postApproval,
        p.commentApproval,
        p.postType,
        p.directUrl,
        p.content,
        p.postedAt,
        p.authorName,
        p.accountName,
        p.replyStatus,
      ])
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="scanned-posts-comments.csv"');
    res.send(csv);
  });

  // Module 3: Knowledge Base (RAG) & Contextual AI Content Generator
  app.get('/api/knowledge', requireAuth, (_req, res) => {
    res.json({ docs: listKnowledgeDocs() });
  });

  app.post('/api/knowledge', requireAuth, (req, res) => {
    const title = String(req.body?.title ?? '').trim();
    const category = String(req.body?.category ?? 'Tài liệu sản phẩm').trim();
    const content = String(req.body?.content ?? '').trim();

    if (!title || !content) {
      res.status(400).json({ error: 'Tiêu đề và nội dung tài liệu không được để trống.' });
      return;
    }

    const id = `doc_${Date.now().toString(36)}`;
    const chunks = chunkDocument(content);
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO knowledge_docs (
        id, title, category, content, chunk_count, source_type, file_name, mime_type, file_size, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'text', NULL, 'text/plain', NULL, ?)`
    ).run(id, title, category, content, chunks.length, now);

    addActivityLog('AI RAG Engine', 'success', `Đã thêm tài liệu "${title}" (${chunks.length} chunks).`);
    broadcastSnapshot();
    res.json({ ok: true, id, docs: listKnowledgeDocs() });
  });

  app.delete('/api/knowledge/:id', requireAuth, (req, res) => {
    db.prepare('DELETE FROM knowledge_docs WHERE id = ?').run(req.params.id);
    broadcastSnapshot();
    res.json({ ok: true, docs: listKnowledgeDocs() });
  });

  app.post('/api/ai/generate-reply', requireAuth, async (req, res) => {
    const postId = String(req.body?.postId ?? '').trim();
    const toneOverride = typeof req.body?.toneOverride === 'string' ? req.body.toneOverride : undefined;

    if (!postId) {
      res.status(400).json({ error: 'Thiếu postId.' });
      return;
    }

    const posts = listScannedPosts();
    const target = posts.find((p) => p.id === postId);
    if (!target) {
      res.status(404).json({ error: 'Không tìm thấy bài đăng/comment.' });
      return;
    }

    const docs = listKnowledgeDocs();
    const safety = getSafetyConfig();
    const recentReplies = posts
      .filter((p) => p.id !== postId && p.aiReply)
      .slice(0, 6)
      .map((p) => p.aiReply as string);

    try {
      const result = await generateContextualReply({
        post: target,
        docs,
        safety,
        recentReplies,
        toneOverride,
      });

      db.prepare(
        "UPDATE scanned_posts SET ai_reply = ?, ai_citations = ?, reply_status = 'Đã tạo AI' WHERE id = ?"
      ).run(result.replyText, JSON.stringify(result.citations), postId);

      addActivityLog(
        'AI Content Generator',
        'success',
        `Đã sinh bình luận AI cho bài của ${target.authorName} (tham chiếu ${result.citations.length} tài liệu RAG).`
      );
      broadcastSnapshot();

      res.json({
        ok: true,
        postId,
        aiReply: result.replyText,
        aiCitations: result.citations,
        matchedChunks: result.matchedChunks,
        duplicateRiskScore: result.duplicateRiskScore,
        replyStatus: 'Đã tạo AI',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi khi gọi Gemini API.';
      addActivityLog('AI Content Generator', 'error', message);
      res.status(500).json({ error: message });
    }
  });

  app.post('/api/ai/save-reply', requireAuth, (req, res) => {
    const postId = String(req.body?.postId ?? '').trim();
    const aiReply = String(req.body?.aiReply ?? '').trim();
    const action = String(req.body?.action ?? 'save');

    if (!postId || !aiReply) {
      res.status(400).json({ error: 'Nội dung phản hồi không được để trống.' });
      return;
    }

    const safety = getSafetyConfig();
    const usage = getTodayUsage();

    if (action === 'approve') {
      if (usage.commentsCount >= safety.maxCommentsPerDay) {
        res.status(429).json({
          error: `Đã đạt giới hạn an toàn ${safety.maxCommentsPerDay} bình luận/ngày để tránh checkpoint.`,
        });
        return;
      }
      const hour = new Date().getHours();
      if (!isWithinActiveHours(hour, safety.activeStartHour, safety.activeEndHour)) {
        db.prepare(
          "UPDATE scanned_posts SET ai_reply = ?, reply_status = 'Đã duyệt (Auto-Comment)' WHERE id = ?"
        ).run(aiReply, postId);
        addActivityLog(
          'Auto-Comment Queue',
          'warning',
          `Đã duyệt vào hàng đợi (ngoài khung giờ hoạt động ${safety.activeStartHour}h-${safety.activeEndHour}h).`
        );
        broadcastSnapshot();
        res.json({ ok: true, replyStatus: 'Đã duyệt (Auto-Comment)' });
        return;
      }

      db.prepare(
        "UPDATE scanned_posts SET ai_reply = ?, reply_status = 'Đã duyệt (Auto-Comment)' WHERE id = ?"
      ).run(aiReply, postId);
      incrementTodayUsage('comments_count', 1);
      addActivityLog(
        'Auto-Comment Queue',
        'success',
        `Đã Approve bình luận #${postId} vào hàng đợi Auto-Comment (delay an toàn ${safety.delayMinSec}-${safety.delayMaxSec}s).`
      );
      broadcastSnapshot();
      res.json({ ok: true, replyStatus: 'Đã duyệt (Auto-Comment)' });
      return;
    }

    const nextStatus = action === 'copy' ? 'Đã Copy' : 'Đã tạo AI';
    db.prepare('UPDATE scanned_posts SET ai_reply = ?, reply_status = ? WHERE id = ?').run(
      aiReply,
      nextStatus,
      postId
    );
    broadcastSnapshot();
    res.json({ ok: true, replyStatus: nextStatus });
  });

  // Module 4 & 5: Streams & Safety Config
  app.post('/api/streams/:id/toggle', requireAuth, (req, res) => {
    const { id } = req.params;
    const action = String(req.body?.action ?? 'stop');
    if (action === 'stop') {
      stopStream(id);
    } else {
      const nextStatus = action === 'pause' ? 'paused' : 'running';
      db.prepare('UPDATE automation_streams SET status = ?, updated_at = ? WHERE id = ?').run(
        nextStatus,
        new Date().toISOString(),
        id
      );
      broadcastSnapshot();
    }
    res.json({ ok: true, streams: listStreams() });
  });

  app.get('/api/safety', requireAuth, (_req, res) => {
    res.json({
      safetyConfig: getSafetyConfig(),
      usageToday: getTodayUsage(),
    });
  });

  app.put('/api/safety', requireAuth, (req, res) => {
    const updated = updateSafetyConfig(req.body ?? {});
    addActivityLog('Safety Guard', 'info', 'Đã cập nhật cấu hình bảo vệ tài khoản & chiến dịch UTM.');
    broadcastSnapshot();
    res.json({
      safetyConfig: updated,
      usageToday: getTodayUsage(),
    });
  });

  app.get('/api/scripts', requireAuth, (_req, res) => {
    res.json({ scripts: getStarterScripts() });
  });

  // Feature 1: Fanpages CRUD & Nick/Page Warm-up (Ads Prep)
  app.get('/api/fanpages', requireAuth, (_req, res) => {
    res.json({ fanpages: listFanpages() });
  });

  app.post('/api/fanpages', requireAuth, (req, res) => {
    const ownerAccountId = String(req.body?.ownerAccountId ?? '').trim();
    const name = String(req.body?.name ?? '').trim();
    const category = String(req.body?.category ?? 'Đồ gia dụng & Bán lẻ').trim();
    const description = String(req.body?.description ?? '').trim();
    const customSlug = String(req.body?.pageSlug ?? '').trim();
    const followersCount = Math.max(0, Number(req.body?.followersCount ?? 0));

    const owner = listFacebookAccounts().find((a) => a.id === ownerAccountId);
    if (!owner) {
      res.status(400).json({ error: 'Vui lòng chọn Tài khoản FB sở hữu Fanpage hợp lệ.' });
      return;
    }
    if (!name) {
      res.status(400).json({ error: 'Vui lòng nhập Tên Fanpage.' });
      return;
    }

    const id = `page_${Date.now().toString(36)}`;
    const pageId = String(10100000000000 + (Date.now() % 899999999999));
    const slug =
      customSlug ||
      name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '')
        .slice(0, 28) ||
      id;

    const pageUrl = `https://www.facebook.com/${slug}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO fanpages (
        id, owner_account_id, owner_account_name, page_id, name, category, description, page_url,
        followers_count, warmup_days, warmup_stage, trust_score, ad_readiness, posts_published_count,
        last_warmup_at, enabled, worker_status, current_task, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'Mới tạo (1-7 ngày)', 42, 'Chưa sẵn sàng Ads', 0, NULL, 1, 'idle', 'Vừa khởi tạo · Chờ nuôi tương tác', ?)
    `).run(
      id,
      owner.id,
      owner.name,
      pageId,
      name,
      category,
      description || `Fanpage chính thức thuộc quản trị của ${owner.name}`,
      pageUrl,
      followersCount,
      now
    );

    addActivityLog('Ads Warm-up', 'success', `Đã khởi tạo Fanpage "${name}" dưới quyền tài khoản ${owner.name}.`);
    broadcastSnapshot();
    res.json({ ok: true, id, fanpages: listFanpages() });
  });

  app.post('/api/fanpages/:id/toggle', requireAuth, (req, res) => {
    const { id } = req.params;
    const existing = listFanpages().find((p) => p.id === id);
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy Fanpage.' });
      return;
    }
    db.prepare('UPDATE fanpages SET enabled = ? WHERE id = ?').run(existing.enabled ? 0 : 1, id);
    broadcastSnapshot();
    res.json({ ok: true, fanpages: listFanpages() });
  });

  app.delete('/api/fanpages/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM fanpages WHERE id = ?').run(id);
    addActivityLog('Ads Warm-up', 'warning', `Đã xóa Fanpage ${id} khỏi danh sách nuôi Ads.`);
    broadcastSnapshot();
    res.json({ ok: true, fanpages: listFanpages() });
  });

  app.post('/api/warmup/start', requireAuth, (req, res) => {
    const accountIds = Array.isArray(req.body?.accountIds)
      ? req.body.accountIds.map((id: unknown) => String(id))
      : [];
    const pageIds = Array.isArray(req.body?.pageIds)
      ? req.body.pageIds.map((id: unknown) => String(id))
      : [];

    try {
      const result = startWarmupJob({ accountIds, pageIds });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Không thể chạy phiên nuôi.' });
    }
  });

  app.post('/api/warmup/stop', requireAuth, (_req, res) => {
    stopStream('stream_warmup_worker');
    addActivityLog('Ads Warm-up', 'warning', 'Đã dừng luồng nuôi Nick FB & Fanpage theo yêu cầu.');
    res.json({ ok: true });
  });

  // Feature 2: AI Scheduled Auto-Publisher for Owned FB Profiles & Fanpages
  app.get('/api/publisher/posts', requireAuth, (_req, res) => {
    res.json({ posts: listScheduledPosts() });
  });

  app.post('/api/publisher/generate-ai', requireAuth, async (req, res) => {
    const topic = String(req.body?.topic ?? '').trim();
    const goal = String(req.body?.goal ?? 'Nuôi tương tác tự nhiên').trim();
    const tone = String(req.body?.tone ?? 'Tự nhiên như người dùng chia sẻ kinh nghiệm').trim();
    const useRag = req.body?.useRag !== false;
    const targetNames = Array.isArray(req.body?.targetNames)
      ? req.body.targetNames.map((n: unknown) => String(n))
      : [];

    if (!topic) {
      res.status(400).json({ error: 'Vui lòng nhập Chủ đề hoặc Sản phẩm để AI sinh bài viết.' });
      return;
    }

    try {
      const docs = listKnowledgeDocs();
      const safety = getSafetyConfig();
      const generated = await generateScheduledSocialPost({
        topic,
        goal: goal as Parameters<typeof generateScheduledSocialPost>[0]['goal'],
        tone,
        useRag,
        docs,
        safety,
        targetNames,
      });

      addActivityLog(
        'AI Auto-Publisher',
        'success',
        `AI đã sinh bài đăng "${generated.title}" (tham chiếu ${generated.citations.length} tài liệu RAG).`
      );
      res.json({ ok: true, ...generated });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi AI sinh bài đăng.';
      addActivityLog('AI Content Generator', 'error', msg);
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/publisher/posts', requireAuth, async (req, res) => {
    const title = String(req.body?.title ?? '').trim() || 'Bài đăng tự động AI';
    const topic = String(req.body?.topic ?? '').trim() || title;
    const goal = String(req.body?.goal ?? 'Nuôi tương tác tự nhiên').trim();
    const tone = String(req.body?.tone ?? 'Tự nhiên, hữu ích').trim();
    const useRag = req.body?.useRag !== false;
    const aiContent = String(req.body?.aiContent ?? '').trim();
    const hashtags = Array.isArray(req.body?.hashtags)
      ? req.body.hashtags.map((h: unknown) => String(h).trim()).filter(Boolean)
      : [];
    const aiCitations = Array.isArray(req.body?.aiCitations)
      ? req.body.aiCitations.map((c: unknown) => String(c).trim()).filter(Boolean)
      : [];
    const perTargetVariation = req.body?.perTargetVariation !== false;
    const targets = Array.isArray(req.body?.targets) ? req.body.targets : [];
    const scheduledAt = String(req.body?.scheduledAt ?? '').trim() || new Date().toISOString();
    const recurrence = String(req.body?.recurrence ?? 'once').trim();
    const publishImmediately = Boolean(req.body?.publishImmediately);

    if (!aiContent) {
      res.status(400).json({ error: 'Nội dung bài đăng không được để trống.' });
      return;
    }
    if (targets.length === 0) {
      res.status(400).json({ error: 'Vui lòng chọn ít nhất 1 Nick FB hoặc Fanpage sở hữu để đăng.' });
      return;
    }

    const id = `sched_${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO scheduled_posts (
        id, title, topic, goal, tone, use_rag, ai_content, hashtags, ai_citations,
        per_target_variation, targets, scheduled_at, recurrence, status, published_at, published_urls, last_error, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', NULL, '[]', NULL, ?)
    `).run(
      id,
      title,
      topic,
      goal,
      tone,
      useRag ? 1 : 0,
      aiContent,
      JSON.stringify(hashtags),
      JSON.stringify(aiCitations),
      perTargetVariation ? 1 : 0,
      JSON.stringify(targets),
      scheduledAt,
      recurrence,
      now
    );

    addActivityLog(
      'AI Auto-Publisher',
      'success',
      `Đã tạo lịch đăng "${title}" lên ${targets.length} kênh sở hữu (${recurrence === 'once' ? '1 lần' : recurrence}).`
    );

    if (publishImmediately) {
      await publishScheduledPostNow(id);
    } else {
      broadcastSnapshot();
    }

    res.json({ ok: true, id, posts: listScheduledPosts() });
  });

  app.post('/api/publisher/posts/:id/publish-now', requireAuth, async (req, res) => {
    const { id } = req.params;
    try {
      const result = await publishScheduledPostNow(id);
      res.json({ ok: true, ...result, posts: listScheduledPosts() });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Không thể đăng bài ngay.' });
    }
  });

  app.post('/api/publisher/posts/:id/toggle-pause', requireAuth, (req, res) => {
    const { id } = req.params;
    const existing = listScheduledPosts().find((p) => p.id === id);
    if (!existing) {
      res.status(404).json({ error: 'Không tìm thấy lịch bài đăng.' });
      return;
    }
    const nextStatus = existing.status === 'paused' ? 'scheduled' : 'paused';
    db.prepare('UPDATE scheduled_posts SET status = ? WHERE id = ?').run(nextStatus, id);
    broadcastSnapshot();
    res.json({ ok: true, posts: listScheduledPosts() });
  });

  app.delete('/api/publisher/posts/:id', requireAuth, (req, res) => {
    const { id } = req.params;
    db.prepare('DELETE FROM scheduled_posts WHERE id = ?').run(id);
    broadcastSnapshot();
    res.json({ ok: true, posts: listScheduledPosts() });
  });

  // System Settings & SQLite Stats Routes (Single-owner)
  app.get('/api/admin/overview', requireAuth, (_req, res) => {
    res.json({
      systemSettings: getSystemSettings(),
      dbStats: getDatabaseStats(),
    });
  });

  app.put('/api/admin/settings', requireAuth, (req, res) => {
    const updated = updateSystemSettings({ ...req.body, maintenanceMode: false });
    addActivityLog(
      'Cài đặt Hệ thống',
      'success',
      `Đã lưu cấu hình Workspace (${updated.workspaceName}).`
    );
    res.json({ ok: true, systemSettings: updated, dbStats: getDatabaseStats() });
  });

  startScheduledPostDispatcher();

  const httpServer = http.createServer(app);

  const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');

  if (isProd) {
    const distPath = path.join(__dirname, 'dist');
    app.use(
      express.static(distPath, {
        setHeaders(res, filePath) {
          if (
            filePath.endsWith('.html') ||
            filePath.endsWith('sw.js') ||
            filePath.endsWith('registerSW.js') ||
            filePath.endsWith('manifest.webmanifest')
          ) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );
    app.get('/{*splat}', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    process.env.DISABLE_HMR ??= 'true';
    const viteReady = import('vite').then(({ createServer: createViteServer }) =>
      createViteServer({
        server: {
          middlewareMode: true,
          hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
        },
        appType: 'spa',
      })
    );
    viteReady.catch((err) => {
      console.error('Vite dev middleware failed to initialize:', err);
    });
    app.use((req, res, next) => {
      viteReady
        .then((vite) => vite.middlewares(req, res, next))
        .catch(next);
    });
  }

  const cliPortIdx = process.argv.indexOf('--port');
  const cliPort = cliPortIdx !== -1 ? Number(process.argv[cliPortIdx + 1]) : NaN;
  const envPort = process.env.PORT ? Number(process.env.PORT) : NaN;
  const nginxPort = process.env.NGINX_PORT ? Number(process.env.NGINX_PORT) : NaN;
  const defaultAppPort = process.env.DEFAULT_APP_PORT ? Number(process.env.DEFAULT_APP_PORT) : 3000;

  const port =
    Number.isFinite(cliPort) && cliPort > 0
      ? cliPort
      : Number.isFinite(envPort) && envPort > 0 && envPort !== nginxPort
        ? envPort
        : defaultAppPort;

  const cliHostIdx = process.argv.indexOf('--host');
  const host = cliHostIdx !== -1 && process.argv[cliHostIdx + 1] ? process.argv[cliHostIdx + 1] : '0.0.0.0';

  httpServer.listen(port, host, () => {
    console.log(`SocialPulse FB server listening on http://${host}:${port} (${isProd ? 'production' : 'development'})`);
  });

  const shutdown = () => {
    httpServer.close(() => {
      try {
        db.close();
      } catch {
        // ignore close errors
      }
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

createApp().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
