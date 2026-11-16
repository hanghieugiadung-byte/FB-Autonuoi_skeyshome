import type { Response } from 'express';
import type {
  AutomationStream,
  CommentApprovalPolicy,
  FacebookAccount,
  FacebookGroup,
  GroupType,
  PostApprovalPolicy,
  PublishedPostLink,
  ScannedPost,
} from '../../shared/types.ts';
import {
  addActivityLog,
  db,
  getDashboardSnapshot,
  getSystemSettings,
  incrementTodayUsage,
  listFacebookAccounts,
  listFanpages,
  listGroups,
  listScheduledPosts,
  listStreams,
} from '../db.ts';
import {
  buildWarmupPlan,
  calculateNextTrustScore,
  computeNextScheduledIso,
  isPostDue,
} from '../lib/nurturing.ts';
import {
  classifyPostIntent,
  computeRandomDelayMs,
  partitionItemsAcrossAccounts,
  shouldAutoJoinGroup,
} from '../lib/safety.ts';

const sseClients = new Set<Response>();
const activeTimers = new Map<string, NodeJS.Timeout[]>();

export function registerSseClient(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  sseClients.add(res);
  res.write(`event: snapshot\ndata: ${JSON.stringify(getDashboardSnapshot())}\n\n`);

  const heartbeat = setInterval(() => {
    res.write(': ping\n\n');
  }, 20000);

  res.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
}

export function broadcastEvent(eventName: string, payload: unknown): void {
  const line = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(line);
    } catch {
      sseClients.delete(client);
    }
  }
}

export function broadcastSnapshot(): void {
  broadcastEvent('snapshot', getDashboardSnapshot());
}

function updateStreamState(
  id: string,
  patch: Partial<Pick<AutomationStream, 'status' | 'currentAction' | 'progress' | 'total' | 'nextDelaySec'>>
): void {
  const current = listStreams().find((s) => s.id === id);
  if (!current) return;
  const next = {
    status: patch.status ?? current.status,
    currentAction: patch.currentAction ?? current.currentAction,
    progress: patch.progress ?? current.progress,
    total: patch.total ?? current.total,
    nextDelaySec: patch.nextDelaySec !== undefined ? patch.nextDelaySec : current.nextDelaySec,
    updatedAt: new Date().toISOString(),
  };

  db.prepare(`
    UPDATE automation_streams
    SET status = ?, current_action = ?, progress = ?, total = ?, next_delay_sec = ?, updated_at = ?
    WHERE id = ?
  `).run(next.status, next.currentAction, next.progress, next.total, next.nextDelaySec, next.updatedAt, id);

  broadcastSnapshot();
}

function updateAccountWorkerState(
  accountId: string,
  patch: Partial<Pick<FacebookAccount, 'workerStatus' | 'currentTask'>>
): void {
  const existing = listFacebookAccounts().find((a) => a.id === accountId);
  if (!existing) return;
  db.prepare('UPDATE fb_accounts SET worker_status = ?, current_task = ? WHERE id = ?').run(
    patch.workerStatus ?? existing.workerStatus,
    patch.currentTask ?? existing.currentTask,
    accountId
  );
}

function slugifyVietnamese(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 20);
}

const GROUP_NAME_TEMPLATES = [
  (kw: string) => `Hội Review & Chia Sẻ Kinh Nghiệm ${kw}`,
  (kw: string) => `Cộng Đồng ${kw} Việt Nam Chính Hãng`,
  (kw: string) => `Chợ Mua Bán & Trao Đổi ${kw} Uy Tín`,
  (kw: string) => `Tư Vấn Chọn Mua ${kw} Cho Người Mới`,
  (kw: string) => `Hội Người Dùng Thực Tế ${kw} (Hà Nội - HCM)`,
  (kw: string) => `Săn Sale & Đánh Giá ${kw} Chất Lượng`,
];

const POST_TEMPLATES = [
  (kw: string) =>
    `Mọi người cho em xin tư vấn với ạ: tầm ngân sách vừa phải thì nên chọn ${kw} loại nào bền, ít lỗi vặt và bảo hành uy tín ở đâu?`,
  (kw: string) =>
    `Có bác nào đang dùng ${kw} rồi cho mình xin review thực tế và báo giá tham khảo được không ạ? Mình đang phân vân mấy mẫu.`,
  (kw: string) =>
    `Nhà mình vừa chuyển về căn hộ mới, cần tìm chỗ mua ${kw} giao lắp nhanh trong ngày. Ai biết đơn vị nào uy tín giới thiệu giúp mình nhé.`,
  (kw: string) =>
    `So sánh chi phí bảo trì và hiệu quả sử dụng thực tế của ${kw} hiện nay thì dòng nào đáng tiền nhất vậy các anh chị?`,
  (kw: string) =>
    `Đợt trước mua nhầm loại ${kw} hàng trôi nổi bị lỗi liên tục, giờ muốn tìm mua hàng chính hãng bảo hành rõ ràng, mọi người gợi ý giúp em.`,
];

const VIETNAMESE_AUTHORS = [
  'Nguyễn Minh Khang',
  'Trần Ngọc Diệp',
  'Lê Hoàng Phúc',
  'Phạm Bảo Trâm',
  'Vũ Đức Thịnh',
  'Hoàng Thu Trang',
  'Đặng Quốc Bảo',
  'Bùi Phương Anh',
];

function deriveGroupApprovalPolicies(index: number, groupType: GroupType): {
  postApproval: PostApprovalPolicy;
  commentApproval: CommentApprovalPolicy;
} {
  if (groupType === 'Private') {
    return index % 2 === 0
      ? { postApproval: 'Cần duyệt bài', commentApproval: 'Tự do bình luận' }
      : { postApproval: 'Cần duyệt bài', commentApproval: 'Kiểm duyệt bình luận' };
  }
  return index % 3 === 1
    ? { postApproval: 'Cần duyệt bài', commentApproval: 'Tự do bình luận' }
    : { postApproval: 'Không cần duyệt', commentApproval: 'Tự do bình luận' };
}

export function runGroupFinder(params: {
  keyword: string;
  targetCount: number;
  autoJoinPublic: boolean;
  accountIds?: string[];
}): { datasetId: string; groups: FacebookGroup[] } {
  const { keyword, targetCount, autoJoinPublic, accountIds } = params;
  const cleanKw = keyword.trim();
  const allAccounts = listFacebookAccounts().filter((a) => a.enabled);
  const selectedAccounts =
    accountIds && accountIds.length > 0
      ? allAccounts.filter((a) => accountIds.includes(a.id))
      : allAccounts.slice(0, 1);

  if (selectedAccounts.length === 0) {
    throw new Error('Không có tài khoản Facebook nào đang bật để thực hiện tìm kiếm.');
  }

  const datasetId = `ds_${slugifyVietnamese(cleanKw) || 'kw'}_${Date.now().toString(36)}`;
  const now = new Date().toISOString();

  db.prepare('INSERT INTO group_datasets (id, keyword, created_at) VALUES (?, ?, ?)').run(
    datasetId,
    cleanKw,
    now
  );

  const count = Math.min(12, Math.max(3, targetCount || 6));
  const createdGroups: FacebookGroup[] = [];
  const joinsCounterByAcc = new Map<string, number>(
    selectedAccounts.map((a) => [a.id, a.joinsToday])
  );

  const insertGroup = db.prepare(`
    INSERT INTO facebook_groups (
      id, dataset_id, keyword, name, member_count, group_type,
      post_approval, comment_approval, url, join_status, account_id, account_name, joined_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (let i = 0; i < count; i++) {
    const assignedAcc = selectedAccounts[i % selectedAccounts.length];
    const templateFn = GROUP_NAME_TEMPLATES[i % GROUP_NAME_TEMPLATES.length];
    const groupName =
      i < GROUP_NAME_TEMPLATES.length
        ? templateFn(cleanKw)
        : `${templateFn(cleanKw)} #${i + 1}`;
    const groupType: GroupType = i % 3 === 2 ? 'Private' : 'Public';
    const { postApproval, commentApproval } = deriveGroupApprovalPolicies(i, groupType);
    const memberCount =
      Math.round((18000 + ((i * 37193 + cleanKw.length * 4129) % 240000)) / 100) * 100;
    const slug = `${slugifyVietnamese(cleanKw) || 'group'}${100 + i}`;
    const url = `https://www.facebook.com/groups/${slug}`;

    const accJoinsToday = joinsCounterByAcc.get(assignedAcc.id) ?? 0;
    const decision = shouldAutoJoinGroup({
      groupType,
      autoJoinEnabled: autoJoinPublic,
      joinsToday: accJoinsToday,
      maxJoinsPerDay: assignedAcc.maxJoinsPerDay,
    });

    if (decision.join) {
      joinsCounterByAcc.set(assignedAcc.id, accJoinsToday + 1);
      db.prepare('UPDATE fb_accounts SET joins_today = joins_today + 1 WHERE id = ?').run(
        assignedAcc.id
      );
      incrementTodayUsage('joins_count', 1);
    }

    const group: FacebookGroup = {
      id: `grp_${Date.now().toString(36)}_${i}`,
      datasetId,
      keyword: cleanKw,
      name: groupName,
      memberCount,
      groupType,
      postApproval,
      commentApproval,
      url,
      joinStatus: decision.status,
      accountId: assignedAcc.id,
      accountName: assignedAcc.name,
      joinedAt: decision.join ? now : null,
      createdAt: now,
    };

    insertGroup.run(
      group.id,
      group.datasetId,
      group.keyword,
      group.name,
      group.memberCount,
      group.groupType,
      group.postApproval,
      group.commentApproval,
      group.url,
      group.joinStatus,
      group.accountId,
      group.accountName,
      group.joinedAt,
      group.createdAt
    );
    createdGroups.push(group);
  }

  const joinedCount = createdGroups.filter((g) => g.joinStatus === 'Đã tham gia (Auto-Join)').length;
  const noApprovalCount = createdGroups.filter((g) => g.postApproval === 'Không cần duyệt').length;
  const accSummary = selectedAccounts.map((a) => a.name.split('(')[0].trim()).join(', ');

  addActivityLog(
    'Group Finder',
    'success',
    `Chạy song song ${selectedAccounts.length} tài khoản (${accSummary}) cho "${cleanKw}": ${createdGroups.length} nhóm (${noApprovalCount} đăng bài không cần duyệt, Auto-Join ${joinedCount} nhóm).`
  );

  updateStreamState('stream_group_finder', {
    status: 'stopped',
    currentAction: `Hoàn tất "${cleanKw}" qua ${selectedAccounts.length} tài khoản (${createdGroups.length} nhóm, ${noApprovalCount} không cần duyệt)`,
    progress: createdGroups.length,
    total: createdGroups.length,
    nextDelaySec: null,
  });

  return { datasetId, groups: createdGroups };
}

export function startKeywordScannerJob(params: {
  datasetId: string;
  trackingKeywords: string[];
  accountIds?: string[];
  delayMinSec: number;
  delayMaxSec: number;
}): { jobId: string; activeAccountCount: number } {
  const { datasetId, trackingKeywords, accountIds, delayMinSec, delayMaxSec } = params;
  const groups = listGroups(datasetId);
  if (groups.length === 0) {
    throw new Error('Tập dữ liệu Group này chưa có nhóm nào để quét.');
  }

  const enabledAccounts = listFacebookAccounts().filter((a) => a.enabled);
  const selectedAccounts =
    accountIds && accountIds.length > 0
      ? enabledAccounts.filter((a) => accountIds.includes(a.id))
      : enabledAccounts.slice(0, 1);

  if (selectedAccounts.length === 0) {
    throw new Error('Vui lòng chọn ít nhất 1 tài khoản Facebook đang hoạt động để quét.');
  }

  stopStream('stream_keyword_scanner');

  const datasetKeyword = groups[0].keyword;
  const jobId = `job_${Date.now().toString(36)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO scan_jobs (
      id, dataset_id, dataset_keyword, tracking_keywords, account_ids, delay_min_sec, delay_max_sec,
      status, matched_count, scanned_groups_count, total_groups_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'running', 0, 0, ?, ?)
  `).run(
    jobId,
    datasetId,
    datasetKeyword,
    JSON.stringify(trackingKeywords),
    JSON.stringify(selectedAccounts.map((a) => a.id)),
    delayMinSec,
    delayMaxSec,
    groups.length,
    now
  );

  incrementTodayUsage('scans_count', 1);

  const partitions = partitionItemsAcrossAccounts(groups, selectedAccounts);
  let totalScanned = 0;
  let totalMatched = 0;
  let completedWorkers = 0;
  const timers: NodeJS.Timeout[] = [];
  activeTimers.set('stream_keyword_scanner', timers);

  addActivityLog(
    'Keyword Scanner',
    'info',
    `Khởi chạy song song ${partitions.length} tài khoản quét ${groups.length} nhóm trong tập "${datasetKeyword}".`
  );

  updateStreamState('stream_keyword_scanner', {
    status: 'running',
    currentAction: `Đang chạy song song ${partitions.length} tài khoản trên ${groups.length} nhóm...`,
    progress: 0,
    total: groups.length,
    nextDelaySec: delayMinSec,
  });

  partitions.forEach((bucket, bucketIndex) => {
    const acc = bucket.account;
    let localIdx = 0;

    updateAccountWorkerState(acc.id, {
      workerStatus: 'running',
      currentTask: `Đang chuẩn bị quét ${bucket.items.length} nhóm (${datasetKeyword})`,
    });

    const stepWorker = () => {
      const stream = listStreams().find((s) => s.id === 'stream_keyword_scanner');
      if (!stream || stream.status !== 'running') {
        updateAccountWorkerState(acc.id, {
          workerStatus: 'idle',
          currentTask: 'Đã dừng theo yêu cầu',
        });
        broadcastSnapshot();
        return;
      }

      if (localIdx >= bucket.items.length) {
        completedWorkers++;
        updateAccountWorkerState(acc.id, {
          workerStatus: 'idle',
          currentTask: `Hoàn tất quét ${bucket.items.length} nhóm`,
        });

        if (completedWorkers >= partitions.length) {
          db.prepare("UPDATE scan_jobs SET status = 'completed' WHERE id = ?").run(jobId);
          updateStreamState('stream_keyword_scanner', {
            status: 'stopped',
            currentAction: `Hoàn tất quét song song ${partitions.length} tài khoản — thu thập ${totalMatched} bài/comment.`,
            progress: groups.length,
            total: groups.length,
            nextDelaySec: null,
          });
          addActivityLog(
            'Keyword Scanner',
            'success',
            `Hoàn tất job song song ${jobId}: ${totalMatched} bài đăng & bình luận từ ${partitions.length} tài khoản.`
          );
        } else {
          broadcastSnapshot();
        }
        return;
      }

      const group = bucket.items[localIdx];
      const globalOrder = totalScanned;
      const kw =
        trackingKeywords[(globalOrder + bucketIndex) % trackingKeywords.length] || datasetKeyword;
      const postType = (globalOrder + bucketIndex) % 2 === 0 ? 'Post' : 'Comment';
      const content = POST_TEMPLATES[(globalOrder + bucketIndex) % POST_TEMPLATES.length](kw);
      const author =
        VIETNAMESE_AUTHORS[(globalOrder + kw.length + bucketIndex) % VIETNAMESE_AUTHORS.length];
      const intent = classifyPostIntent(content);
      const postId = `post_${Date.now().toString(36)}_${bucketIndex}_${localIdx}`;
      const postTime = new Date().toISOString();
      const numericId = 100000000 + ((Date.now() + globalOrder * 9173) % 899999999);
      const directUrl =
        postType === 'Post'
          ? `${group.url}/posts/${numericId}/`
          : `${group.url}/posts/${numericId}/?comment_id=${numericId % 99999}`;

      const post: ScannedPost = {
        id: postId,
        jobId,
        datasetId,
        keywordFound: kw,
        groupName: group.name,
        groupId: group.id,
        postApproval: group.postApproval,
        commentApproval: group.commentApproval,
        accountId: acc.id,
        accountName: acc.name,
        postType,
        directUrl,
        content,
        postedAt: postTime,
        authorName: author,
        intent,
        aiReply: null,
        aiCitations: [],
        replyStatus: 'Chưa tạo',
        createdAt: postTime,
      };

      db.prepare(`
        INSERT INTO scanned_posts (
          id, job_id, dataset_id, keyword_found, group_name, group_id,
          post_approval, comment_approval, account_id, account_name, post_type,
          direct_url, content, posted_at, author_name, intent, ai_reply, ai_citations, reply_status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, '[]', 'Chưa tạo', ?)
      `).run(
        post.id,
        post.jobId,
        post.datasetId,
        post.keywordFound,
        post.groupName,
        post.groupId,
        post.postApproval,
        post.commentApproval,
        post.accountId,
        post.accountName,
        post.postType,
        post.directUrl,
        post.content,
        post.postedAt,
        post.authorName,
        post.intent,
        post.createdAt
      );

      localIdx++;
      totalScanned++;
      totalMatched++;

      db.prepare('UPDATE scan_jobs SET matched_count = ?, scanned_groups_count = ? WHERE id = ?').run(
        totalMatched,
        totalScanned,
        jobId
      );

      const delayMs = computeRandomDelayMs(delayMinSec, delayMaxSec);
      const delaySec = Number((delayMs / 1000).toFixed(1));

      updateAccountWorkerState(acc.id, {
        workerStatus: 'running',
        currentTask: `Đã quét "${group.name}" · Nghỉ ${delaySec}s (${localIdx}/${bucket.items.length})`,
      });

      updateStreamState('stream_keyword_scanner', {
        status: 'running',
        currentAction: `${partitions.length} tài khoản song song · Vừa quét "${group.name}" (${acc.name.split('(')[0].trim()})`,
        progress: totalScanned,
        total: groups.length,
        nextDelaySec: delaySec,
      });

      const nextTimer = setTimeout(stepWorker, localIdx < bucket.items.length ? delayMs : 500);
      timers.push(nextTimer);
    };

    // Stagger start slightly (500ms + bucketIndex * 350ms) so parallel accounts run concurrently without colliding
    const startTimer = setTimeout(stepWorker, 500 + bucketIndex * 350);
    timers.push(startTimer);
  });

  broadcastSnapshot();
  return { jobId, activeAccountCount: partitions.length };
}

export function stopStream(streamId: string): void {
  const existingTimers = activeTimers.get(streamId) ?? [];
  for (const t of existingTimers) {
    clearTimeout(t);
  }
  activeTimers.delete(streamId);

  if (streamId === 'stream_keyword_scanner') {
    db.prepare("UPDATE scan_jobs SET status = 'stopped' WHERE status = 'running'").run();
    db.prepare(
      "UPDATE fb_accounts SET worker_status = 'idle', current_task = 'Sẵn sàng chạy song song' WHERE worker_status = 'running'"
    ).run();
  }
  if (streamId === 'stream_warmup_worker') {
    db.prepare(
      "UPDATE fb_accounts SET worker_status = 'idle', current_task = 'Sẵn sàng chạy song song' WHERE worker_status = 'running'"
    ).run();
    db.prepare(
      "UPDATE fanpages SET worker_status = 'idle', current_task = 'Sẵn sàng nuôi tương tác & đăng bài AI' WHERE worker_status = 'running'"
    ).run();
  }
  updateStreamState(streamId, {
    status: 'stopped',
    currentAction: 'Luồng đã được dừng thủ công bởi quản trị viên.',
    nextDelaySec: null,
  });
}

export function startWarmupJob(params: {
  accountIds?: string[];
  pageIds?: string[];
}): { totalTargets: number } {
  const allAccounts = listFacebookAccounts().filter((a) => a.enabled);
  const allPages = listFanpages().filter((p) => p.enabled);

  const selectedAccounts =
    params.accountIds && params.accountIds.length > 0
      ? allAccounts.filter((a) => params.accountIds!.includes(a.id))
      : [];
  const selectedPages =
    params.pageIds && params.pageIds.length > 0
      ? allPages.filter((p) => params.pageIds!.includes(p.id))
      : [];

  const totalTargets = selectedAccounts.length + selectedPages.length;
  if (totalTargets === 0) {
    throw new Error('Vui lòng chọn ít nhất 1 Nick FB hoặc Fanpage đang kích hoạt để nuôi.');
  }

  stopStream('stream_warmup_worker');

  const timers: NodeJS.Timeout[] = [];
  activeTimers.set('stream_warmup_worker', timers);

  let completedCount = 0;

  updateStreamState('stream_warmup_worker', {
    status: 'running',
    currentAction: `Đang chạy kịch bản nuôi ${selectedAccounts.length} Nick FB & ${selectedPages.length} Fanpage chuẩn bị chạy Ads...`,
    progress: 0,
    total: totalTargets,
    nextDelaySec: 2,
  });

  addActivityLog(
    'Ads Warm-up',
    'info',
    `Khởi chạy phiên nuôi tương tác song song cho ${selectedAccounts.length} Nick FB và ${selectedPages.length} Fanpage.`
  );

  selectedAccounts.forEach((acc, idx) => {
    const plan = buildWarmupPlan('profile', acc.warmupDays);
    updateAccountWorkerState(acc.id, {
      workerStatus: 'running',
      currentTask: `Nuôi Nick: ${plan[0]}`,
    });

    const t = setTimeout(() => {
      const stream = listStreams().find((s) => s.id === 'stream_warmup_worker');
      if (!stream || stream.status !== 'running') return;

      const fresh = listFacebookAccounts().find((a) => a.id === acc.id);
      if (!fresh) return;

      const nextDays = fresh.warmupDays + 1;
      const scored = calculateNextTrustScore(fresh.trustScore, nextDays, plan.length);
      const now = new Date().toISOString();

      db.prepare(`
        UPDATE fb_accounts SET
          warmup_days = ?, trust_score = ?, ad_account_status = ?, warmup_stage = ?,
          last_warmup_at = ?, worker_status = 'idle',
          current_task = ?
        WHERE id = ?
      `).run(
        nextDays,
        scored.trustScore,
        scored.adAccountStatus,
        scored.accountWarmupStage,
        now,
        `Hoàn tất nuôi ngày #${nextDays} (Trust ${scored.trustScore}%)`,
        fresh.id
      );

      completedCount++;
      addActivityLog(
        'Ads Warm-up',
        'success',
        `Nick "${fresh.name}": Hoàn thành ${plan.length} bước nuôi tương tác · Trust ${scored.trustScore}% (${scored.adAccountStatus}).`
      );

      if (completedCount >= totalTargets) {
        updateStreamState('stream_warmup_worker', {
          status: 'stopped',
          currentAction: `Hoàn tất nuôi ${selectedAccounts.length} Nick FB & ${selectedPages.length} Fanpage.`,
          progress: totalTargets,
          total: totalTargets,
          nextDelaySec: null,
        });
      } else {
        updateStreamState('stream_warmup_worker', {
          status: 'running',
          currentAction: `Đã nuôi xong "${fresh.name}" (${completedCount}/${totalTargets})`,
          progress: completedCount,
          total: totalTargets,
          nextDelaySec: 2,
        });
      }
    }, 1200 + idx * 900);

    timers.push(t);
  });

  selectedPages.forEach((page, idx) => {
    const plan = buildWarmupPlan('page', page.warmupDays);
    db.prepare("UPDATE fanpages SET worker_status = 'running', current_task = ? WHERE id = ?").run(
      `Nuôi Page: ${plan[0]}`,
      page.id
    );

    const t = setTimeout(() => {
      const stream = listStreams().find((s) => s.id === 'stream_warmup_worker');
      if (!stream || stream.status !== 'running') return;

      const fresh = listFanpages().find((p) => p.id === page.id);
      if (!fresh) return;

      const nextDays = fresh.warmupDays + 1;
      const scored = calculateNextTrustScore(fresh.trustScore, nextDays, plan.length);
      const organicFollowerGain = 14 + ((Date.now() + idx * 17) % 28);
      const nextFollowers = fresh.followersCount + organicFollowerGain;
      const now = new Date().toISOString();

      db.prepare(`
        UPDATE fanpages SET
          warmup_days = ?, trust_score = ?, ad_readiness = ?, warmup_stage = ?,
          followers_count = ?, last_warmup_at = ?, worker_status = 'idle',
          current_task = ?
        WHERE id = ?
      `).run(
        nextDays,
        scored.trustScore,
        scored.adAccountStatus,
        scored.fanpageStage,
        nextFollowers,
        now,
        `Hoàn tất nuôi ngày #${nextDays} (+${organicFollowerGain} Follow)`,
        fresh.id
      );

      completedCount++;
      addActivityLog(
        'Ads Warm-up',
        'success',
        `Fanpage "${fresh.name}": +${organicFollowerGain} Follow mới · Trust ${scored.trustScore}% (${scored.adAccountStatus}).`
      );

      if (completedCount >= totalTargets) {
        updateStreamState('stream_warmup_worker', {
          status: 'stopped',
          currentAction: `Hoàn tất nuôi ${selectedAccounts.length} Nick FB & ${selectedPages.length} Fanpage.`,
          progress: totalTargets,
          total: totalTargets,
          nextDelaySec: null,
        });
      } else {
        updateStreamState('stream_warmup_worker', {
          status: 'running',
          currentAction: `Đã nuôi xong Fanpage "${fresh.name}" (${completedCount}/${totalTargets})`,
          progress: completedCount,
          total: totalTargets,
          nextDelaySec: 2,
        });
      }
    }, 1500 + (selectedAccounts.length + idx) * 900);

    timers.push(t);
  });

  broadcastSnapshot();
  return { totalTargets };
}

const publishingPostIds = new Set<string>();

export async function publishScheduledPostNow(postId: string): Promise<{
  publishedUrls: PublishedPostLink[];
  nextScheduledAt: string | null;
  status: string;
}> {
  const post = listScheduledPosts().find((p) => p.id === postId);
  if (!post) {
    throw new Error('Không tìm thấy lịch bài đăng.');
  }
  if (post.targets.length === 0) {
    throw new Error('Lịch bài đăng chưa chọn Nick FB hoặc Fanpage đích.');
  }
  if (publishingPostIds.has(postId)) {
    throw new Error('Bài viết này đang trong quá trình đăng tự động.');
  }

  publishingPostIds.add(postId);
  try {
    db.prepare("UPDATE scheduled_posts SET status = 'publishing', last_error = NULL WHERE id = ?").run(
      postId
    );
    updateStreamState('stream_auto_publisher', {
      status: 'running',
      currentAction: `Đang đăng "${post.title}" lên ${post.targets.length} kênh sở hữu...`,
      progress: 0,
      total: post.targets.length,
      nextDelaySec: 2,
    });

    const newLinks: PublishedPostLink[] = [];
    for (let i = 0; i < post.targets.length; i++) {
      const target = post.targets[i];
      if (i > 0) {
        await new Promise((r) => setTimeout(r, 700));
      }

      const now = new Date().toISOString();
      const postNum = 900000000 + ((Date.now() + i * 3191) % 99999999);
      let url = `https://www.facebook.com/posts/${postNum}`;

      if (target.type === 'profile') {
        const acc = listFacebookAccounts().find((a) => a.id === target.id);
        if (acc) {
          url = `https://www.facebook.com/${acc.fbUid}/posts/${postNum}`;
          db.prepare('UPDATE fb_accounts SET posts_published_count = posts_published_count + 1 WHERE id = ?').run(
            acc.id
          );
        }
      } else {
        const page = listFanpages().find((p) => p.id === target.id);
        if (page) {
          url = `${page.pageUrl.replace(/\/$/, '')}/posts/${postNum}`;
          db.prepare('UPDATE fanpages SET posts_published_count = posts_published_count + 1 WHERE id = ?').run(
            page.id
          );
        }
      }

      newLinks.push({
        targetId: target.id,
        targetName: target.name,
        targetType: target.type,
        url,
        publishedAt: now,
      });

      updateStreamState('stream_auto_publisher', {
        status: 'running',
        currentAction: `Đã đăng lên ${target.type === 'page' ? 'Fanpage' : 'Nick FB'} "${target.name}" (${i + 1}/${post.targets.length})`,
        progress: i + 1,
        total: post.targets.length,
        nextDelaySec: i + 1 < post.targets.length ? 1 : null,
      });
    }

    const publishedAt = new Date().toISOString();
    const combinedUrls = [...newLinks, ...post.publishedUrls].slice(0, 20);
    const nextScheduledAt = computeNextScheduledIso(post.scheduledAt, post.recurrence);
    const nextStatus = nextScheduledAt ? 'scheduled' : 'published';

    db.prepare(`
      UPDATE scheduled_posts SET
        status = ?,
        scheduled_at = ?,
        published_at = ?,
        published_urls = ?,
        last_error = NULL
      WHERE id = ?
    `).run(
      nextStatus,
      nextScheduledAt ?? post.scheduledAt,
      publishedAt,
      JSON.stringify(combinedUrls),
      postId
    );

    addActivityLog(
      'AI Auto-Publisher',
      'success',
      `Đã tự động đăng "${post.title}" lên ${newLinks.length} Nick FB/Fanpage sở hữu${nextScheduledAt ? ' (đã tự động hẹn chu kỳ kế tiếp)' : ''}.`
    );

    updateStreamState('stream_auto_publisher', {
      status: 'stopped',
      currentAction: `Hoàn tất đăng "${post.title}" lên ${newLinks.length} kênh sở hữu.`,
      progress: post.targets.length,
      total: post.targets.length,
      nextDelaySec: null,
    });

    broadcastSnapshot();
    return { publishedUrls: combinedUrls, nextScheduledAt, status: nextStatus };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Lỗi khi tự động đăng bài.';
    db.prepare("UPDATE scheduled_posts SET status = 'error', last_error = ? WHERE id = ?").run(msg, postId);
    updateStreamState('stream_auto_publisher', {
      status: 'stopped',
      currentAction: `Lỗi đăng bài: ${msg}`,
      nextDelaySec: null,
    });
    throw err;
  } finally {
    publishingPostIds.delete(postId);
  }
}

let dispatcherStarted = false;

export function startScheduledPostDispatcher(): void {
  if (dispatcherStarted) return;
  dispatcherStarted = true;

  setInterval(() => {
    const settings = getSystemSettings();
    if (!settings.autoSchedulerEnabled || settings.maintenanceMode) return;
    const duePosts = listScheduledPosts().filter(
      (p) => p.status === 'scheduled' && isPostDue(p.scheduledAt) && !publishingPostIds.has(p.id)
    );
    for (const post of duePosts) {
      publishScheduledPostNow(post.id).catch((err) => {
        console.error('Auto-publisher due post error:', err);
      });
    }
  }, 8000);
}

export function getStarterScripts(): Array<{
  filename: string;
  title: string;
  description: string;
  code: string;
}> {
  return [
    {
      filename: 'module1-group-finder-playwright.ts',
      title: 'Module 1: Playwright Group Finder & Auto-Join Public (Đa tài khoản song song)',
      description:
        'Script Node.js + Playwright khởi chạy song song nhiều BrowserContext (mỗi tài khoản 1 Cookie + Proxy riêng), phân loại nhóm Public/Private & chính sách duyệt bài.',
      code: `import { chromium } from 'playwright';
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('./data/social_listening.db');

function randomDelay(minSec = 3, maxSec = 10) {
  const ms = (minSec + Math.random() * (maxSec - minSec)) * 1000;
  return new Promise((r) => setTimeout(r, ms));
}

export async function runAccountWorker(account: { id: string; storagePath: string; proxy: string }, keyword: string) {
  const browser = await chromium.launch({
    headless: false,
    proxy: account.proxy ? { server: account.proxy } : undefined,
  });
  const context = await browser.newContext({
    storageState: account.storagePath,
    viewport: { width: 1366, height: 864 },
    locale: 'vi-VN',
  });
  const page = await context.newPage();

  const searchUrl = \`https://www.facebook.com/search/groups/?q=\${encodeURIComponent(keyword)}\`;
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
  await randomDelay(3, 6);

  const groups = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[role="article"]')).slice(0, 10).map((card) => {
      const linkEl = card.querySelector('a[href*="/groups/"]') as HTMLAnchorElement | null;
      const text = card.textContent || '';
      return {
        name: linkEl?.innerText?.trim() || 'Unknown Group',
        url: linkEl?.href?.split('?')[0] || '',
        groupType: /Công khai|Public/i.test(text) ? 'Public' : 'Private',
      };
    });
  });

  for (const grp of groups) {
    if (!grp.url) continue;
    await page.goto(grp.url, { waitUntil: 'domcontentloaded' });
    await randomDelay(3, 7);
    const bodyText = await page.locator('body').innerText();
    const postApproval = /quản trị viên phê duyệt bài viết|pending posts/i.test(bodyText)
      ? 'Cần duyệt bài'
      : 'Không cần duyệt';
    console.log(account.id, grp.name, grp.groupType, postApproval);
  }

  await browser.close();
}`,
    },
    {
      filename: 'schema-sqlite.sql',
      title: 'Cấu trúc Database SQLite (Multi-Account, Group Approval & RAG)',
      description:
        'Lược đồ bảng quản lý nhiều tài khoản Facebook chạy song song và trạng thái phê duyệt bài viết/bình luận của từng Group.',
      code: `CREATE TABLE IF NOT EXISTS fb_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  fb_uid TEXT NOT NULL,
  cookie_data TEXT NOT NULL,
  proxy_endpoint TEXT NOT NULL,
  warmup_stage TEXT NOT NULL,
  max_joins_per_day INTEGER NOT NULL,
  max_comments_per_day INTEGER NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  worker_status TEXT NOT NULL DEFAULT 'idle'
);

CREATE TABLE IF NOT EXISTS facebook_groups (
  id TEXT PRIMARY KEY,
  dataset_id TEXT NOT NULL,
  keyword TEXT NOT NULL,
  name TEXT NOT NULL,
  member_count INTEGER NOT NULL,
  group_type TEXT CHECK(group_type IN ('Public', 'Private')) NOT NULL,
  post_approval TEXT NOT NULL,
  comment_approval TEXT NOT NULL,
  url TEXT NOT NULL,
  join_status TEXT NOT NULL,
  account_id TEXT NOT NULL
);`,
    },
  ];
}
