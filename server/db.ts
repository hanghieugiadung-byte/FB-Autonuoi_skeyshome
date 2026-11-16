import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  ActivityLog,
  AdReadinessStatus,
  AutomationStream,
  CommentApprovalPolicy,
  DailyChartPoint,
  DailyUsage,
  DashboardSnapshot,
  DatabaseStats,
  FacebookAccount,
  FacebookGroup,
  Fanpage,
  FanpageWarmupStage,
  GroupDataset,
  KeywordChartPoint,
  KnowledgeDoc,
  KnowledgeSourceType,
  PostApprovalPolicy,
  PostGoal,
  PostRecurrence,
  PostTargetRef,
  PublishedPostLink,
  SafetyConfig,
  ScanJob,
  ScannedPost,
  ScheduledPost,
  ScheduledPostStatus,
  SystemSettings,
} from '../shared/types.ts';
import { DEFAULT_APP_PASSCODE, hashPassword, verifyPassword } from './lib/auth.ts';
import { chunkDocument } from './lib/rag.ts';

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'social_listening.db');
export const db = new DatabaseSync(DB_PATH);

function ensureColumn(table: string, column: string, definition: string): void {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS fb_accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    fb_uid TEXT NOT NULL,
    profile_url TEXT NOT NULL,
    cookie_status TEXT NOT NULL,
    cookie_data TEXT NOT NULL,
    proxy_endpoint TEXT NOT NULL,
    warmup_stage TEXT NOT NULL,
    max_joins_per_day INTEGER NOT NULL,
    max_comments_per_day INTEGER NOT NULL,
    joins_today INTEGER NOT NULL DEFAULT 0,
    comments_today INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    worker_status TEXT NOT NULL DEFAULT 'idle',
    current_task TEXT NOT NULL DEFAULT 'Sẵn sàng nhận tác vụ song song',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS group_datasets (
    id TEXT PRIMARY KEY,
    keyword TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS facebook_groups (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    keyword TEXT NOT NULL,
    name TEXT NOT NULL,
    member_count INTEGER NOT NULL,
    group_type TEXT NOT NULL,
    post_approval TEXT NOT NULL DEFAULT 'Không cần duyệt',
    comment_approval TEXT NOT NULL DEFAULT 'Tự do bình luận',
    url TEXT NOT NULL,
    join_status TEXT NOT NULL,
    account_id TEXT NOT NULL DEFAULT 'acc_01',
    account_name TEXT NOT NULL DEFAULT 'Minh Anh Marketing (Acc #01)',
    joined_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (dataset_id) REFERENCES group_datasets(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS scan_jobs (
    id TEXT PRIMARY KEY,
    dataset_id TEXT NOT NULL,
    dataset_keyword TEXT NOT NULL,
    tracking_keywords TEXT NOT NULL,
    account_ids TEXT NOT NULL DEFAULT '["acc_01"]',
    delay_min_sec INTEGER NOT NULL,
    delay_max_sec INTEGER NOT NULL,
    status TEXT NOT NULL,
    matched_count INTEGER NOT NULL,
    scanned_groups_count INTEGER NOT NULL,
    total_groups_count INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scanned_posts (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    dataset_id TEXT NOT NULL,
    keyword_found TEXT NOT NULL,
    group_name TEXT NOT NULL,
    group_id TEXT NOT NULL,
    post_approval TEXT NOT NULL DEFAULT 'Không cần duyệt',
    comment_approval TEXT NOT NULL DEFAULT 'Tự do bình luận',
    account_id TEXT NOT NULL DEFAULT 'acc_01',
    account_name TEXT NOT NULL DEFAULT 'Minh Anh Marketing (Acc #01)',
    post_type TEXT NOT NULL,
    direct_url TEXT NOT NULL,
    content TEXT NOT NULL,
    posted_at TEXT NOT NULL,
    author_name TEXT NOT NULL,
    intent TEXT NOT NULL,
    ai_reply TEXT,
    ai_citations TEXT NOT NULL,
    reply_status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS knowledge_docs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    content TEXT NOT NULL,
    chunk_count INTEGER NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'text',
    file_name TEXT,
    mime_type TEXT,
    file_size INTEGER,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS safety_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    account_name TEXT NOT NULL,
    account_warmup_stage TEXT NOT NULL,
    proxy_endpoint TEXT NOT NULL,
    cookies_configured INTEGER NOT NULL,
    max_joins_per_day INTEGER NOT NULL,
    max_comments_per_day INTEGER NOT NULL,
    delay_min_sec INTEGER NOT NULL,
    delay_max_sec INTEGER NOT NULL,
    active_start_hour INTEGER NOT NULL,
    active_end_hour INTEGER NOT NULL,
    auto_pause_on_warning INTEGER NOT NULL,
    spintax_variation INTEGER NOT NULL,
    utm_source TEXT NOT NULL,
    utm_medium TEXT NOT NULL,
    utm_campaign TEXT NOT NULL,
    target_landing_url TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS daily_usage (
    date TEXT PRIMARY KEY,
    joins_count INTEGER NOT NULL DEFAULT 0,
    comments_count INTEGER NOT NULL DEFAULT 0,
    scans_count INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS automation_streams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    module TEXT NOT NULL,
    status TEXT NOT NULL,
    current_action TEXT NOT NULL,
    progress INTEGER NOT NULL,
    total INTEGER NOT NULL,
    next_delay_sec INTEGER,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    module TEXT NOT NULL,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS fanpages (
    id TEXT PRIMARY KEY,
    owner_account_id TEXT NOT NULL,
    owner_account_name TEXT NOT NULL,
    page_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    page_url TEXT NOT NULL,
    followers_count INTEGER NOT NULL DEFAULT 0,
    warmup_days INTEGER NOT NULL DEFAULT 1,
    warmup_stage TEXT NOT NULL DEFAULT 'Mới tạo (1-7 ngày)',
    trust_score INTEGER NOT NULL DEFAULT 45,
    ad_readiness TEXT NOT NULL DEFAULT 'Đang nuôi Ads',
    posts_published_count INTEGER NOT NULL DEFAULT 0,
    last_warmup_at TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    worker_status TEXT NOT NULL DEFAULT 'idle',
    current_task TEXT NOT NULL DEFAULT 'Sẵn sàng nuôi tương tác & đăng bài AI',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS scheduled_posts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    goal TEXT NOT NULL,
    tone TEXT NOT NULL,
    use_rag INTEGER NOT NULL DEFAULT 1,
    ai_content TEXT NOT NULL,
    hashtags TEXT NOT NULL DEFAULT '[]',
    ai_citations TEXT NOT NULL DEFAULT '[]',
    per_target_variation INTEGER NOT NULL DEFAULT 1,
    targets TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    recurrence TEXT NOT NULL DEFAULT 'once',
    status TEXT NOT NULL DEFAULT 'scheduled',
    published_at TEXT,
    published_urls TEXT NOT NULL DEFAULT '[]',
    last_error TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_passcode (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    passcode_hash TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS app_sessions (
    token TEXT PRIMARY KEY,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS system_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    workspace_name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    default_timezone TEXT NOT NULL,
    max_concurrent_workers INTEGER NOT NULL,
    ai_model_name TEXT NOT NULL,
    auto_scheduler_enabled INTEGER NOT NULL,
    require_approval_before_post INTEGER NOT NULL,
    maintenance_mode INTEGER NOT NULL,
    default_proxy_pool TEXT NOT NULL,
    session_timeout_hours INTEGER NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

// Safe migrations for existing SQLite databases created prior to multi-account, approval policies, and nurturing
ensureColumn('fb_accounts', 'warmup_days', 'INTEGER NOT NULL DEFAULT 12');
ensureColumn('fb_accounts', 'trust_score', 'INTEGER NOT NULL DEFAULT 72');
ensureColumn('fb_accounts', 'ad_account_status', "TEXT NOT NULL DEFAULT 'Đang nuôi Ads'");
ensureColumn('fb_accounts', 'recovery_email', "TEXT NOT NULL DEFAULT ''");
ensureColumn('fb_accounts', 'two_factor_secret', "TEXT NOT NULL DEFAULT ''");
ensureColumn('fb_accounts', 'last_warmup_at', 'TEXT');
ensureColumn('fb_accounts', 'posts_published_count', 'INTEGER NOT NULL DEFAULT 0');

ensureColumn('facebook_groups', 'post_approval', "TEXT NOT NULL DEFAULT 'Không cần duyệt'");
ensureColumn('facebook_groups', 'comment_approval', "TEXT NOT NULL DEFAULT 'Tự do bình luận'");
ensureColumn('facebook_groups', 'account_id', "TEXT NOT NULL DEFAULT 'acc_01'");
ensureColumn('facebook_groups', 'account_name', "TEXT NOT NULL DEFAULT 'Minh Anh Marketing (Acc #01)'");

ensureColumn('scan_jobs', 'account_ids', 'TEXT NOT NULL DEFAULT \'["acc_01"]\'');

ensureColumn('scanned_posts', 'post_approval', "TEXT NOT NULL DEFAULT 'Không cần duyệt'");
ensureColumn('scanned_posts', 'comment_approval', "TEXT NOT NULL DEFAULT 'Tự do bình luận'");
ensureColumn('scanned_posts', 'account_id', "TEXT NOT NULL DEFAULT 'acc_01'");
ensureColumn('scanned_posts', 'account_name', "TEXT NOT NULL DEFAULT 'Minh Anh Marketing (Acc #01)'");

ensureColumn('knowledge_docs', 'source_type', "TEXT NOT NULL DEFAULT 'text'");
ensureColumn('knowledge_docs', 'file_name', 'TEXT');
ensureColumn('knowledge_docs', 'mime_type', 'TEXT');
ensureColumn('knowledge_docs', 'file_size', 'INTEGER');

export function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(daysAgo: number, hour = 10): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 15, 0, 0);
  return d.toISOString();
}

export function seedDatabaseIfEmpty(): void {
  const passcodeCount = db.prepare('SELECT COUNT(*) as c FROM app_passcode').get() as { c: number };
  if (passcodeCount.c === 0) {
    db.prepare(`
      INSERT INTO app_passcode (id, passcode_hash, updated_at)
      VALUES (1, ?, ?)
    `).run(hashPassword(DEFAULT_APP_PASSCODE), new Date().toISOString());
  }

  const sysSettingsCount = db.prepare('SELECT COUNT(*) as c FROM system_settings').get() as { c: number };
  if (sysSettingsCount.c === 0) {
    db.prepare(`
      INSERT INTO system_settings (
        id, workspace_name, company_name, default_timezone, max_concurrent_workers,
        ai_model_name, auto_scheduler_enabled, require_approval_before_post,
        maintenance_mode, default_proxy_pool, session_timeout_hours, updated_at
      ) VALUES (
        1, 'SocialPulse FB', 'Hệ thống Automation & Social Listening', 'Asia/Ho_Chi_Minh', 5,
        'gemini-4-hydrogen', 1, 0,
        0, 'socks5://vn-hcm-res-01.proxy:1080', 24, ?
      )
    `).run(new Date().toISOString());
  }

  const accCount = db.prepare('SELECT COUNT(*) as c FROM fb_accounts').get() as { c: number };
  if (accCount.c === 0) {
    const insertAcc = db.prepare(`
      INSERT INTO fb_accounts (
        id, name, fb_uid, profile_url, cookie_status, cookie_data, proxy_endpoint,
        warmup_stage, max_joins_per_day, max_comments_per_day, joins_today, comments_today,
        enabled, worker_status, current_task, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertAcc.run(
      'acc_01',
      'Minh Anh Marketing (Acc #01)',
      '100084920112345',
      'https://www.facebook.com/profile.php?id=100084920112345',
      'Hợp lệ',
      'c_user=100084920112345; xs=42%3AAbCdEfGh123456%3A2%3A1763200000; datr=xY9zK_hcm01;',
      'socks5://vn-hcm-res-01.proxy:1080',
      'Tin cậy (>21 ngày)',
      12,
      25,
      4,
      2,
      1,
      'idle',
      'Sẵn sàng chạy song song',
      daysAgoIso(10)
    );

    insertAcc.run(
      'acc_02',
      'Quốc Tuấn Seeding (Acc #02)',
      '100091234509876',
      'https://www.facebook.com/profile.php?id=100091234509876',
      'Hợp lệ',
      'c_user=100091234509876; xs=19%3AMnOpQrSt987654%3A2%3A1763200100; datr=mK2pL_hn02;',
      'socks5://vn-hn-res-02.proxy:1080',
      'Tin cậy (>21 ngày)',
      10,
      20,
      2,
      1,
      1,
      'idle',
      'Sẵn sàng chạy song song',
      daysAgoIso(7)
    );

    insertAcc.run(
      'acc_03',
      'Thùy Linh Care (Acc #03)',
      '100077321998811',
      'https://www.facebook.com/profile.php?id=100077321998811',
      'Hợp lệ',
      'c_user=100077321998811; xs=31%3AZxCvBnMl654321%3A2%3A1763200200; datr=qW8rT_dn03;',
      'socks5://vn-dn-res-03.proxy:1080',
      'Đang nuôi (8-21 ngày)',
      6,
      12,
      1,
      0,
      1,
      'idle',
      'Sẵn sàng chạy song song',
      daysAgoIso(3)
    );
  }

  const safetyCount = db.prepare('SELECT COUNT(*) as c FROM safety_config').get() as { c: number };
  if (safetyCount.c === 0) {
    db.prepare(`
      INSERT INTO safety_config (
        id, account_name, account_warmup_stage, proxy_endpoint, cookies_configured,
        max_joins_per_day, max_comments_per_day, delay_min_sec, delay_max_sec,
        active_start_hour, active_end_hour, auto_pause_on_warning, spintax_variation,
        utm_source, utm_medium, utm_campaign, target_landing_url
      ) VALUES (
        1, 'Minh Anh Marketing (Acc #01)', 'Tin cậy (>21 ngày)', 'socks5://vn-hcm-res-01.proxy:1080', 1,
        12, 25, 3, 10,
        8, 22, 1, 1,
        'facebook_group', 'ai_comment', 'smart_home_q4', 'https://giadungsmart.vn/uu-dai'
      )
    `).run();
  }

  const now = new Date().toISOString();
  const insertStream = db.prepare(`
    INSERT OR IGNORE INTO automation_streams (id, name, module, status, current_action, progress, total, next_delay_sec, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertStream.run('stream_group_finder', 'Worker Tìm kiếm & Auto-Join Group', 'group_finder', 'stopped', 'Sẵn sàng nhận từ khóa tìm kiếm mới', 0, 0, null, now);
  insertStream.run('stream_keyword_scanner', 'Worker Quét Bài đăng & Comment (Đa luồng)', 'keyword_scanner', 'stopped', 'Đang chờ lệnh quét tập dữ liệu Group', 0, 0, null, now);
  insertStream.run('stream_auto_comment', 'Worker Hàng đợi Auto-Comment An toàn', 'auto_comment', 'stopped', 'Sẵn sàng xử lý các bình luận đã Approve', 0, 0, null, now);
  insertStream.run('stream_warmup_worker', 'Worker Nuôi Nick FB & Fanpage (Ads Prep)', 'warmup_worker', 'stopped', 'Sẵn sàng chạy kịch bản tương tác nuôi tài nguyên Ads', 0, 0, null, now);
  insertStream.run('stream_auto_publisher', 'Worker Tự động Đăng bài AI theo lịch', 'auto_publisher', 'stopped', 'Đang theo dõi lịch đăng lên Nick FB & Fanpage sở hữu', 0, 0, null, now);

  // Backfill nurturing defaults for initial seeded accounts if still uninitialized
  db.prepare(`
    UPDATE fb_accounts
    SET warmup_days = 36, trust_score = 92, ad_account_status = 'Sẵn sàng chạy Ads',
        recovery_email = 'minhanh.mkt@mailcare.vn', two_factor_secret = 'M4N8 K9P2 Q7R5 T3V6',
        posts_published_count = CASE WHEN posts_published_count = 0 THEN 6 ELSE posts_published_count END
    WHERE id = 'acc_01' AND trust_score = 72
  `).run();
  db.prepare(`
    UPDATE fb_accounts
    SET warmup_days = 26, trust_score = 86, ad_account_status = 'Sẵn sàng chạy Ads',
        recovery_email = 'quoctuan.ads@mailcare.vn', two_factor_secret = 'J2H7 L9M4 N6P8 Q3S5',
        posts_published_count = CASE WHEN posts_published_count = 0 THEN 4 ELSE posts_published_count END
    WHERE id = 'acc_02' AND trust_score = 72
  `).run();
  db.prepare(`
    UPDATE fb_accounts
    SET warmup_days = 11, trust_score = 64, ad_account_status = 'Đang nuôi Ads',
        recovery_email = 'thuylinh.care@mailcare.vn', two_factor_secret = 'W5X3 Y8Z2 A4C7 E9G2',
        posts_published_count = CASE WHEN posts_published_count = 0 THEN 1 ELSE posts_published_count END
    WHERE id = 'acc_03' AND trust_score = 72
  `).run();

  const pageCount = db.prepare('SELECT COUNT(*) as c FROM fanpages').get() as { c: number };
  if (pageCount.c === 0) {
    const insertPage = db.prepare(`
      INSERT INTO fanpages (
        id, owner_account_id, owner_account_name, page_id, name, category, description, page_url,
        followers_count, warmup_days, warmup_stage, trust_score, ad_readiness, posts_published_count,
        last_warmup_at, enabled, worker_status, current_task, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'idle', 'Sẵn sàng nuôi tương tác & đăng bài AI', ?)
    `);

    insertPage.run(
      'page_01',
      'acc_01',
      'Minh Anh Marketing (Acc #01)',
      '10293847561029',
      'Gia Dụng Smart Home Chính Hãng',
      'Đồ gia dụng & Thiết bị thông minh',
      'Chuyên phân phối Robot hút bụi, Máy lọc không khí bảo hành chính hãng 24 tháng.',
      'https://www.facebook.com/giadungsmarthome.chinhhang',
      2480,
      28,
      'Sẵn sàng chạy Ads',
      90,
      'Sẵn sàng chạy Ads',
      14,
      daysAgoIso(0, 8),
      daysAgoIso(28)
    );

    insertPage.run(
      'page_02',
      'acc_02',
      'Quốc Tuấn Seeding (Acc #02)',
      '10928374650192',
      'Review Nhà Đẹp & Giải Pháp Bếp Thông Minh',
      'Nội thất & Review sản phẩm',
      'Chia sẻ kinh nghiệm chọn thiết bị gia dụng bền bỉ cho căn hộ chung cư hiện đại.',
      'https://www.facebook.com/reviewnhadep.bepthongminh',
      840,
      14,
      'Đang nuôi tương tác (8-21 ngày)',
      72,
      'Đang nuôi Ads',
      7,
      daysAgoIso(1, 10),
      daysAgoIso(14)
    );

    insertPage.run(
      'page_03',
      'acc_03',
      'Thùy Linh Care (Acc #03)',
      '10485729103847',
      'Góc Mẹ Bỉm Chăm Nhà Sạch',
      'Gia đình & Sức khỏe không gian sống',
      'Mẹo dọn dẹp nhẹ nhàng, bảo vệ hô hấp cho bé với máy lọc khí chuẩn HEPA.',
      'https://www.facebook.com/gocmebim.nhasach',
      215,
      5,
      'Mới tạo (1-7 ngày)',
      48,
      'Chưa sẵn sàng Ads',
      2,
      daysAgoIso(1, 15),
      daysAgoIso(5)
    );
  }

  const schedCount = db.prepare('SELECT COUNT(*) as c FROM scheduled_posts').get() as { c: number };
  if (schedCount.c === 0) {
    const insertSched = db.prepare(`
      INSERT INTO scheduled_posts (
        id, title, topic, goal, tone, use_rag, ai_content, hashtags, ai_citations,
        per_target_variation, targets, scheduled_at, recurrence, status, published_at, published_urls, last_error, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
    `);

    const futureTomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const futureTwoDays = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    insertSched.run(
      'sched_01',
      'Chia sẻ mẹo xử lý lông mèo trên sàn gỗ',
      'Robot hút bụi lau nhà X10 Pro xử lý lông thú cưng',
      'Review sản phẩm',
      'Tự nhiên như người dùng chia sẻ kinh nghiệm',
      1,
      'Nuôi 2 bé mèo trong căn hộ sàn gỗ mới thấy nỗi khổ lông rụng bám thảm mỗi ngày. Sau khi đổi sang dòng X10 Pro lực hút 8.500Pa kết hợp chổi chống rối và giặt giẻ nước nóng 60°C, sàn sạch bong mà không còn mùi ẩm mốc vào mùa nồm.\n\nBạn nào nhà có thú cưng đang tìm máy hút lau rảnh tay có thể tham khảo chi tiết thông số tại: https://giadungsmart.vn/uu-dai?utm_source=facebook_group&utm_medium=auto_post&utm_campaign=smart_home_q4',
      JSON.stringify(['#RobotHutBui', '#NhaCoThuCung', '#GiaDungThongMinh']),
      JSON.stringify(['Catalog Robot Hút Bụi X10 Pro']),
      1,
      JSON.stringify([
        { type: 'page', id: 'page_01', name: 'Gia Dụng Smart Home Chính Hãng', ownerAccountId: 'acc_01' },
        { type: 'profile', id: 'acc_01', name: 'Minh Anh Marketing (Acc #01)', ownerAccountId: 'acc_01' },
      ]),
      futureTomorrow,
      'every_2_days',
      'scheduled',
      null,
      JSON.stringify([]),
      daysAgoIso(1, 9)
    );

    insertSched.run(
      'sched_02',
      'Checklist chọn máy lọc khí phòng ngủ cho bé',
      'Máy lọc không khí và bù ẩm A5 Pure cho phòng 45-60m2',
      'Chia sẻ kiến thức',
      'Chuyên gia thân thiện, dễ hiểu',
      1,
      'Thời tiết giao mùa rất dễ khiến các bé nhỏ bị hắt hơi vào sáng sớm nếu phòng kín điều hòa thiếu độ ẩm. Khi chọn máy lọc khí phòng ngủ 45-60m2, bố mẹ nên ưu tiên 2 yếu tố: màng HEPA H13 lọc bụi mịn PM2.5 và độ ồn chế độ ngủ dưới 22dB để không ảnh hưởng giấc ngủ của bé.\n\nDòng A5 Pure đáp ứng đủ cả 2 tiêu chí này với độ ồn chỉ 21dB và đang tặng kèm lõi lọc dự phòng trị giá 650k.',
      JSON.stringify(['#MayLocKhongKhi', '#ChamSocGiaDinh', '#PhongNguChoBe']),
      JSON.stringify(['Thông số Máy Lọc Không Khí A5 Pure']),
      1,
      JSON.stringify([
        { type: 'page', id: 'page_03', name: 'Góc Mẹ Bỉm Chăm Nhà Sạch', ownerAccountId: 'acc_03' },
      ]),
      futureTwoDays,
      'weekly',
      'scheduled',
      null,
      JSON.stringify([]),
      daysAgoIso(0, 14)
    );

    insertSched.run(
      'sched_03',
      'Bài tương tác cuối tuần nuôi Trust Fanpage',
      'Kinh nghiệm giữ nhà luôn thơm tho sạch sẽ trong 15 phút mỗi ngày',
      'Nuôi tương tác tự nhiên',
      'Gần gũi, hỏi đáp cộng đồng',
      0,
      'Mỗi người có 1 bí quyết riêng để dọn nhà nhanh mà vẫn có thời gian nghỉ ngơi cuối tuần. Với nhà bạn thì thiết bị gia dụng nào là "chân ái" giúp tiết kiệm nhiều công sức nhất? Chia sẻ bên dưới để mọi người cùng tham khảo nhé!',
      JSON.stringify(['#NhaSachCuaDep', '#GiaDinhHienDai']),
      JSON.stringify([]),
      1,
      JSON.stringify([
        { type: 'page', id: 'page_01', name: 'Gia Dụng Smart Home Chính Hãng', ownerAccountId: 'acc_01' },
        { type: 'page', id: 'page_02', name: 'Review Nhà Đẹp & Giải Pháp Bếp Thông Minh', ownerAccountId: 'acc_02' },
      ]),
      daysAgoIso(1, 10),
      'once',
      'published',
      daysAgoIso(1, 10),
      JSON.stringify([
        {
          targetId: 'page_01',
          targetName: 'Gia Dụng Smart Home Chính Hãng',
          targetType: 'page',
          url: 'https://www.facebook.com/giadungsmarthome.chinhhang/posts/901283746',
          publishedAt: daysAgoIso(1, 10),
        },
        {
          targetId: 'page_02',
          targetName: 'Review Nhà Đẹp & Giải Pháp Bếp Thông Minh',
          targetType: 'page',
          url: 'https://www.facebook.com/reviewnhadep.bepthongminh/posts/817263549',
          publishedAt: daysAgoIso(1, 10),
        },
      ]),
      daysAgoIso(2, 11)
    );
  }

  // Ensure existing seeded groups/posts have varied realistic approval policies
  db.prepare("UPDATE facebook_groups SET post_approval = 'Cần duyệt bài', comment_approval = 'Tự do bình luận' WHERE id IN ('grp_02', 'grp_06', 'grp_08')").run();
  db.prepare("UPDATE facebook_groups SET post_approval = 'Cần duyệt bài', comment_approval = 'Kiểm duyệt bình luận' WHERE id IN ('grp_04', 'grp_09')").run();
  db.prepare("UPDATE facebook_groups SET account_id = 'acc_02', account_name = 'Quốc Tuấn Seeding (Acc #02)' WHERE id IN ('grp_03', 'grp_05', 'grp_08', 'grp_10')").run();
  db.prepare("UPDATE scanned_posts SET post_approval = 'Cần duyệt bài', comment_approval = 'Tự do bình luận', account_id = 'acc_02', account_name = 'Quốc Tuấn Seeding (Acc #02)' WHERE id IN ('post_02', 'post_04')").run();

  const datasetCount = db.prepare('SELECT COUNT(*) as c FROM group_datasets').get() as { c: number };
  if (datasetCount.c > 0) return;

  const ds1Id = 'ds_giadung_01';
  const ds2Id = 'ds_noithat_02';

  db.prepare('INSERT INTO group_datasets (id, keyword, created_at) VALUES (?, ?, ?)').run(
    ds1Id,
    'Gia dụng thông minh',
    daysAgoIso(4, 9)
  );
  db.prepare('INSERT INTO group_datasets (id, keyword, created_at) VALUES (?, ?, ?)').run(
    ds2Id,
    'Nội thất chung cư',
    daysAgoIso(2, 14)
  );

  const insertGroup = db.prepare(`
    INSERT INTO facebook_groups (
      id, dataset_id, keyword, name, member_count, group_type,
      post_approval, comment_approval, url, join_status, account_id, account_name, joined_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedGroups: Array<[string, string, string, string, number, string, PostApprovalPolicy, CommentApprovalPolicy, string, string, string, string, string | null, string]> = [
    ['grp_01', ds1Id, 'Gia dụng thông minh', 'Hội Review Đồ Gia Dụng Thông Minh Việt Nam', 148200, 'Public', 'Không cần duyệt', 'Tự do bình luận', 'https://www.facebook.com/groups/reviewgiadungthongminh', 'Đã tham gia (Auto-Join)', 'acc_01', 'Minh Anh Marketing (Acc #01)', daysAgoIso(4, 9), daysAgoIso(4, 9)],
    ['grp_02', ds1Id, 'Gia dụng thông minh', 'Nghiện Nhà - Chia sẻ Kinh nghiệm Thiết bị Bếp', 325400, 'Public', 'Cần duyệt bài', 'Tự do bình luận', 'https://www.facebook.com/groups/nghiennhathietbibep', 'Đã tham gia (Auto-Join)', 'acc_01', 'Minh Anh Marketing (Acc #01)', daysAgoIso(4, 9), daysAgoIso(4, 9)],
    ['grp_03', ds1Id, 'Gia dụng thông minh', 'Cộng đồng Robot Hút Bụi & Máy Lọc Không Khí', 84600, 'Public', 'Không cần duyệt', 'Tự do bình luận', 'https://www.facebook.com/groups/robothutbuivn', 'Đã tham gia (Auto-Join)', 'acc_02', 'Quốc Tuấn Seeding (Acc #02)', daysAgoIso(4, 9), daysAgoIso(4, 9)],
    ['grp_04', ds1Id, 'Gia dụng thông minh', 'Chợ Gia Dụng Nội Địa Nhật - Đức Chính Hãng', 62100, 'Private', 'Cần duyệt bài', 'Kiểm duyệt bình luận', 'https://www.facebook.com/groups/chogiadungnoidia', 'Chờ duyệt (Private)', 'acc_01', 'Minh Anh Marketing (Acc #01)', null, daysAgoIso(4, 9)],
    ['grp_05', ds1Id, 'Gia dụng thông minh', 'Smart Home & Thiết Bị Tiện Ích Gia Đình', 49800, 'Public', 'Không cần duyệt', 'Tự do bình luận', 'https://www.facebook.com/groups/smarthomegiadinh', 'Đã tham gia (Auto-Join)', 'acc_02', 'Quốc Tuấn Seeding (Acc #02)', daysAgoIso(4, 9), daysAgoIso(4, 9)],
    ['grp_06', ds1Id, 'Gia dụng thông minh', 'Hội Các Mẹ Bỉm Sữa Săn Đồ Gia Dụng Tiện Lợi', 214000, 'Private', 'Cần duyệt bài', 'Tự do bình luận', 'https://www.facebook.com/groups/mebimsandogiadung', 'Chờ duyệt (Private)', 'acc_01', 'Minh Anh Marketing (Acc #01)', null, daysAgoIso(4, 9)],
    ['grp_07', ds2Id, 'Nội thất chung cư', 'Cộng Đồng Thiết Kế Nội Thất Chung Cư Vinhomes', 176500, 'Public', 'Không cần duyệt', 'Tự do bình luận', 'https://www.facebook.com/groups/noithatchungcuvin', 'Đã tham gia (Auto-Join)', 'acc_01', 'Minh Anh Marketing (Acc #01)', daysAgoIso(2, 14), daysAgoIso(2, 14)],
    ['grp_08', ds2Id, 'Nội thất chung cư', 'Tư Vấn Decor Nhà Đẹp & Đồ Bếp Âm Tủ', 93400, 'Public', 'Cần duyệt bài', 'Tự do bình luận', 'https://www.facebook.com/groups/decorbepamtu', 'Đã tham gia (Auto-Join)', 'acc_02', 'Quốc Tuấn Seeding (Acc #02)', daysAgoIso(2, 14), daysAgoIso(2, 14)],
    ['grp_09', ds2Id, 'Nội thất chung cư', 'Hội Kiến Trúc Sư & Nhà Thầu Nội Thất Hà Nội', 58900, 'Private', 'Cần duyệt bài', 'Kiểm duyệt bình luận', 'https://www.facebook.com/groups/ktsnoithathn', 'Chờ duyệt (Private)', 'acc_03', 'Thùy Linh Care (Acc #03)', null, daysAgoIso(2, 14)],
    ['grp_10', ds2Id, 'Nội thất chung cư', 'Review Nhà Thông Minh & Tự Động Hóa Căn Hộ', 41200, 'Public', 'Không cần duyệt', 'Tự do bình luận', 'https://www.facebook.com/groups/nhathongminhcanho', 'Đã tham gia (Auto-Join)', 'acc_02', 'Quốc Tuấn Seeding (Acc #02)', daysAgoIso(2, 14), daysAgoIso(2, 14)],
  ];
  for (const g of seedGroups) {
    insertGroup.run(...g);
  }

  const insertDoc = db.prepare(`
    INSERT INTO knowledge_docs (id, title, category, content, chunk_count, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const doc1 = `Robot hút bụi lau nhà X10 Pro (Mã SP: X10-PRO) là dòng flagship chuyên trị lông thú cưng và thảm dày.
Lực hút 8.500Pa kết hợp chổi chính chống rối ZeroTangle. Trạm sạc đa năng tự giặt giẻ bằng nước nóng 60 độ C và sấy khô khí nóng 45 độ C giúp chống mùi ẩm mốc hoàn toàn.
Giá niêm yết: 12.900.000đ. Giá ưu đãi tháng này: 9.490.000đ (tặng kèm 2 cặp giẻ lau + 1 chai nước lau sàn chuyên dụng).
Bảo hành chính hãng 24 tháng tại trung tâm Hà Nội, Đà Nẵng, TP.HCM. Đổi mới 1-1 trong 30 ngày đầu nếu có lỗi nhà sản xuất.`;

  const doc2 = `Máy lọc không khí và bù ẩm A5 Pure (Mã SP: A5-PURE) thiết kế cho phòng 45-60m2, đặc biệt phù hợp nhà có trẻ nhỏ và người bị viêm mũi dị ứng.
Hệ thống 3 màng lọc HEPA H13 giữ lại 99.97% bụi mịn PM2.5, phấn hoa và mùi thức ăn. Độ ồn chế độ ngủ chỉ 21dB siêu êm.
Giá bán ưu đãi: 4.890.000đ (miễn phí giao hàng toàn quốc và tặng kèm 1 lõi lọc dự phòng trị giá 650.000đ).`;

  const doc3 = `Chính sách tư vấn & chăm sóc khách hàng trên Facebook Group:
Không spam giá thô bạo ở dòng đầu tiên. Luôn đồng cảm với nhu cầu thực tế của người hỏi (diện tích nhà, có thú cưng, trẻ nhỏ hay không).
Đưa ra tối đa 2 điểm mạnh kỹ thuật giải quyết đúng vấn đề của khách, kèm mức giá tham khảo minh bạch và mời khách nhắn tin hoặc xem chi tiết thông số kỹ thuật tại trang sản phẩm.`;

  insertDoc.run('doc_01', 'Catalog Robot Hút Bụi X10 Pro', 'Sản phẩm chủ lực', doc1, chunkDocument(doc1).length, daysAgoIso(5));
  insertDoc.run('doc_02', 'Thông số Máy Lọc Không Khí A5 Pure', 'Sản phẩm chủ lực', doc2, chunkDocument(doc2).length, daysAgoIso(5));
  insertDoc.run('doc_03', 'Quy chuẩn Tone giọng Tư vấn Cộng đồng', 'Playbook Sales', doc3, chunkDocument(doc3).length, daysAgoIso(3));

  const jobId = 'job_seed_01';
  db.prepare(`
    INSERT INTO scan_jobs (id, dataset_id, dataset_keyword, tracking_keywords, account_ids, delay_min_sec, delay_max_sec, status, matched_count, scanned_groups_count, total_groups_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    jobId,
    ds1Id,
    'Gia dụng thông minh',
    JSON.stringify(['robot hút bụi', 'máy lọc không khí', 'tư vấn', 'báo giá']),
    JSON.stringify(['acc_01', 'acc_02']),
    3,
    10,
    'completed',
    6,
    4,
    4,
    daysAgoIso(1, 16)
  );

  const insertPost = db.prepare(`
    INSERT INTO scanned_posts (
      id, job_id, dataset_id, keyword_found, group_name, group_id,
      post_approval, comment_approval, account_id, account_name, post_type,
      direct_url, content, posted_at, author_name, intent, ai_reply, ai_citations, reply_status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const seedPosts: Array<[string, string, string, string, string, string, PostApprovalPolicy, CommentApprovalPolicy, string, string, string, string, string, string, string, string, string | null, string, string, string]> = [
    [
      'post_01', jobId, ds1Id, 'robot hút bụi', 'Hội Review Đồ Gia Dụng Thông Minh Việt Nam', 'grp_01',
      'Không cần duyệt', 'Tự do bình luận', 'acc_01', 'Minh Anh Marketing (Acc #01)', 'Post',
      'https://www.facebook.com/groups/reviewgiadungthongminh/posts/1029384756/',
      'Nhà mình nuôi 2 bé mèo Anh lông dài, sàn gỗ khoảng 75m2. Mọi người tư vấn giúp mình tầm 9-10 triệu nên mua robot hút bụi nào lực hút khỏe mà giẻ không bị hôi ạ?',
      daysAgoIso(0, 9), 'Nguyễn Thảo Vy', 'Hỏi mua / Cần tư vấn',
      'Nhà có 2 bé mèo thì bạn cần ưu tiên dòng có chổi chống rối và trạm tự giặt nước nóng để giẻ không bị hôi nhé. Bên mình đang có dòng X10 Pro lực hút 8.500Pa (chống rối lông thú cưng) kèm giặt giẻ nước nóng 60°C & sấy khô 45°C, đang ưu đãi còn 9.490k (bảo hành 24 tháng). Bạn cần mình gửi video test thực tế trên sàn gỗ không?',
      JSON.stringify(['Catalog Robot Hút Bụi X10 Pro']), 'Đã tạo AI', daysAgoIso(0, 9)
    ],
    [
      'post_02', jobId, ds1Id, 'máy lọc không khí', 'Nghiện Nhà - Chia sẻ Kinh nghiệm Thiết bị Bếp', 'grp_02',
      'Cần duyệt bài', 'Tự do bình luận', 'acc_02', 'Quốc Tuấn Seeding (Acc #02)', 'Comment',
      'https://www.facebook.com/groups/nghiennhathietbibep/posts/884721903/?comment_id=445102',
      'Bé nhà mình hay bị viêm mũi dị ứng sáng dậy hắt hơi liên tục. Có ai dùng máy lọc không khí phòng ngủ 45m2 mà chạy êm ban đêm cho mình xin review và báo giá với.',
      daysAgoIso(0, 11), 'Trần Hoàng Nam', 'Hỏi mua / Cần tư vấn',
      null, JSON.stringify([]), 'Chưa tạo', daysAgoIso(0, 11)
    ],
    [
      'post_03', jobId, ds1Id, 'báo giá', 'Cộng đồng Robot Hút Bụi & Máy Lọc Không Khí', 'grp_03',
      'Không cần duyệt', 'Tự do bình luận', 'acc_02', 'Quốc Tuấn Seeding (Acc #02)', 'Post',
      'https://www.facebook.com/groups/robothutbuivn/posts/771203948/',
      'Xin báo giá các mẫu robot hút bụi có trạm giặt sấy tự động dưới 10 triệu bảo hành chính hãng tại Hà Nội ạ.',
      daysAgoIso(1, 15), 'Lê Minh Tuấn', 'So sánh giá',
      'Gửi bạn tham khảo mẫu X10 Pro hiện giá niêm yết 12.900k đang ưu đãi còn 9.490k tại Hà Nội. Có sẵn trạm tự giặt giẻ nước nóng 60°C + sấy khô, bảo hành chính hãng 24 tháng và 1 đổi 1 trong 30 ngày nếu có lỗi NSX.',
      JSON.stringify(['Catalog Robot Hút Bụi X10 Pro', 'Quy chuẩn Tone giọng Tư vấn Cộng đồng']), 'Đã duyệt (Auto-Comment)', daysAgoIso(1, 15)
    ],
    [
      'post_04', jobId, ds1Id, 'tư vấn', 'Smart Home & Thiết Bị Tiện Ích Gia Đình', 'grp_05',
      'Không cần duyệt', 'Tự do bình luận', 'acc_01', 'Minh Anh Marketing (Acc #01)', 'Comment',
      'https://www.facebook.com/groups/smarthomegiadinh/posts/551902311/?comment_id=99102',
      'Chung cư 80m2 nhiều bụi mịn ngoài mặt đường thì nên ưu tiên máy lọc không khí màng HEPA H13 hay robot hút bụi trước các bác? Tư vấn giúp em với.',
      daysAgoIso(1, 18), 'Phạm Khánh Linh', 'Hỏi mua / Cần tư vấn',
      null, JSON.stringify([]), 'Chưa tạo', daysAgoIso(1, 18)
    ],
    [
      'post_05', jobId, ds1Id, 'robot hút bụi', 'Chợ Gia Dụng Nội Địa Nhật - Đức Chính Hãng', 'grp_04',
      'Cần duyệt bài', 'Kiểm duyệt bình luận', 'acc_01', 'Minh Anh Marketing (Acc #01)', 'Comment',
      'https://www.facebook.com/groups/chogiadungnoidia/posts/661029381/?comment_id=12093',
      'Con robot nhà mình cứ lau xong 2 tuần là giẻ bốc mùi chua khó chịu lắm, không biết dòng nào có sấy nóng ổn áp?',
      daysAgoIso(2, 10), 'Đỗ Quang Huy', 'Khiếu nại / Vấn đề',
      null, JSON.stringify([]), 'Chưa tạo', daysAgoIso(2, 10)
    ],
    [
      'post_06', jobId, ds1Id, 'máy lọc không khí', 'Hội Review Đồ Gia Dụng Thông Minh Việt Nam', 'grp_01',
      'Không cần duyệt', 'Tự do bình luận', 'acc_01', 'Minh Anh Marketing (Acc #01)', 'Post',
      'https://www.facebook.com/groups/reviewgiadungthongminh/posts/991230192/',
      'Mình đang so sánh máy lọc không khí A5 Pure với mấy dòng nội địa, có bác nào biết giá và độ ồn thực tế ban đêm của A5 không?',
      daysAgoIso(3, 14), 'Vũ Thu Hà', 'So sánh giá',
      'A5 Pure chạy chế độ ngủ chỉ 21dB nên gần như không nghe tiếng động vào ban đêm đâu bạn. Màng lọc HEPA H13 lọc 99.97% bụi mịn PM2.5 cho phòng 45-60m2, hiện giá ưu đãi 4.890k được tặng kèm 1 lõi lọc dự phòng trị giá 650k nhé.',
      JSON.stringify(['Thông số Máy Lọc Không Khí A5 Pure']), 'Đã gửi', daysAgoIso(3, 14)
    ],
  ];

  for (const p of seedPosts) {
    insertPost.run(...p);
  }

  db.prepare('INSERT INTO daily_usage (date, joins_count, comments_count, scans_count) VALUES (?, ?, ?, ?)').run(
    todayDateKey(),
    4,
    2,
    1
  );

  const insertLog = db.prepare(`
    INSERT INTO activity_logs (id, module, level, message, created_at) VALUES (?, ?, ?, ?, ?)
  `);
  insertLog.run('log_1', 'Group Finder', 'success', 'Chạy song song 2 tài khoản (Acc #01, Acc #02): tự động Join 4 nhóm Public trong tập "Gia dụng thông minh".', daysAgoIso(0, 9));
  insertLog.run('log_2', 'Keyword Scanner', 'info', 'Quét 4 nhóm song song, phát hiện 6 bài đăng/comment (4 nhóm đăng & comment không cần duyệt).', daysAgoIso(0, 11));
  insertLog.run('log_3', 'AI RAG Engine', 'success', 'Đã lập chỉ mục 3 tài liệu nguồn vào bộ nhớ RAG (sẵn sàng sinh nội dung).', daysAgoIso(0, 11));
}

export function listFacebookAccounts(): FacebookAccount[] {
  const rows = db.prepare('SELECT * FROM fb_accounts ORDER BY created_at ASC').all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    fbUid: String(r.fb_uid),
    profileUrl: String(r.profile_url),
    cookieStatus: r.cookie_status as FacebookAccount['cookieStatus'],
    cookieData: String(r.cookie_data),
    proxyEndpoint: String(r.proxy_endpoint),
    warmupStage: r.warmup_stage as FacebookAccount['warmupStage'],
    warmupDays: Number(r.warmup_days ?? 1),
    trustScore: Number(r.trust_score ?? 65),
    adAccountStatus: (r.ad_account_status || 'Đang nuôi Ads') as AdReadinessStatus,
    recoveryEmail: String(r.recovery_email ?? ''),
    twoFactorSecret: String(r.two_factor_secret ?? ''),
    lastWarmupAt: r.last_warmup_at ? String(r.last_warmup_at) : null,
    postsPublishedCount: Number(r.posts_published_count ?? 0),
    maxJoinsPerDay: Number(r.max_joins_per_day),
    maxCommentsPerDay: Number(r.max_comments_per_day),
    joinsToday: Number(r.joins_today),
    commentsToday: Number(r.comments_today),
    enabled: Boolean(r.enabled),
    workerStatus: r.worker_status as FacebookAccount['workerStatus'],
    currentTask: String(r.current_task),
    createdAt: String(r.created_at),
  }));
}

export function listFanpages(): Fanpage[] {
  const rows = db.prepare('SELECT * FROM fanpages ORDER BY created_at DESC').all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    ownerAccountId: String(r.owner_account_id),
    ownerAccountName: String(r.owner_account_name),
    pageId: String(r.page_id),
    name: String(r.name),
    category: String(r.category),
    description: String(r.description),
    pageUrl: String(r.page_url),
    followersCount: Number(r.followers_count ?? 0),
    warmupDays: Number(r.warmup_days ?? 1),
    warmupStage: (r.warmup_stage || 'Mới tạo (1-7 ngày)') as FanpageWarmupStage,
    trustScore: Number(r.trust_score ?? 45),
    adReadiness: (r.ad_readiness || 'Đang nuôi Ads') as AdReadinessStatus,
    postsPublishedCount: Number(r.posts_published_count ?? 0),
    lastWarmupAt: r.last_warmup_at ? String(r.last_warmup_at) : null,
    enabled: Boolean(r.enabled),
    workerStatus: (r.worker_status || 'idle') as Fanpage['workerStatus'],
    currentTask: String(r.current_task || 'Sẵn sàng'),
    createdAt: String(r.created_at),
  }));
}

export function listScheduledPosts(): ScheduledPost[] {
  const rows = db.prepare('SELECT * FROM scheduled_posts ORDER BY scheduled_at ASC, created_at DESC').all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    topic: String(r.topic),
    goal: (r.goal || 'Nuôi tương tác tự nhiên') as PostGoal,
    tone: String(r.tone),
    useRag: Boolean(r.use_rag),
    aiContent: String(r.ai_content),
    hashtags: JSON.parse(String(r.hashtags || '[]')) as string[],
    aiCitations: JSON.parse(String(r.ai_citations || '[]')) as string[],
    perTargetVariation: Boolean(r.per_target_variation),
    targets: JSON.parse(String(r.targets || '[]')) as PostTargetRef[],
    scheduledAt: String(r.scheduled_at),
    recurrence: (r.recurrence || 'once') as PostRecurrence,
    status: (r.status || 'scheduled') as ScheduledPostStatus,
    publishedAt: r.published_at ? String(r.published_at) : null,
    publishedUrls: JSON.parse(String(r.published_urls || '[]')) as PublishedPostLink[],
    lastError: r.last_error ? String(r.last_error) : null,
    createdAt: String(r.created_at),
  }));
}

export function getSafetyConfig(): SafetyConfig {
  const row = db.prepare('SELECT * FROM safety_config WHERE id = 1').get() as Record<string, unknown>;
  return {
    id: Number(row.id),
    accountName: String(row.account_name),
    accountWarmupStage: row.account_warmup_stage as SafetyConfig['accountWarmupStage'],
    proxyEndpoint: String(row.proxy_endpoint),
    cookiesConfigured: Boolean(row.cookies_configured),
    maxJoinsPerDay: Number(row.max_joins_per_day),
    maxCommentsPerDay: Number(row.max_comments_per_day),
    delayMinSec: Number(row.delay_min_sec),
    delayMaxSec: Number(row.delay_max_sec),
    activeStartHour: Number(row.active_start_hour),
    activeEndHour: Number(row.active_end_hour),
    autoPauseOnWarning: Boolean(row.auto_pause_on_warning),
    spintaxVariation: Boolean(row.spintax_variation),
    utmSource: String(row.utm_source),
    utmMedium: String(row.utm_medium),
    utmCampaign: String(row.utm_campaign),
    targetLandingUrl: String(row.target_landing_url),
  };
}

export function updateSafetyConfig(patch: Partial<SafetyConfig>): SafetyConfig {
  const current = getSafetyConfig();
  const next: SafetyConfig = { ...current, ...patch, id: 1 };
  db.prepare(`
    UPDATE safety_config SET
      account_name = ?, account_warmup_stage = ?, proxy_endpoint = ?, cookies_configured = ?,
      max_joins_per_day = ?, max_comments_per_day = ?, delay_min_sec = ?, delay_max_sec = ?,
      active_start_hour = ?, active_end_hour = ?, auto_pause_on_warning = ?, spintax_variation = ?,
      utm_source = ?, utm_medium = ?, utm_campaign = ?, target_landing_url = ?
    WHERE id = 1
  `).run(
    next.accountName,
    next.accountWarmupStage,
    next.proxyEndpoint,
    next.cookiesConfigured ? 1 : 0,
    Math.max(1, Number(next.maxJoinsPerDay)),
    Math.max(1, Number(next.maxCommentsPerDay)),
    Math.max(1, Number(next.delayMinSec)),
    Math.max(Number(next.delayMinSec), Number(next.delayMaxSec)),
    Math.min(23, Math.max(0, Number(next.activeStartHour))),
    Math.min(23, Math.max(0, Number(next.activeEndHour))),
    next.autoPauseOnWarning ? 1 : 0,
    next.spintaxVariation ? 1 : 0,
    next.utmSource,
    next.utmMedium,
    next.utmCampaign,
    next.targetLandingUrl
  );
  return getSafetyConfig();
}

export function getTodayUsage(): DailyUsage {
  const key = todayDateKey();
  let row = db.prepare('SELECT * FROM daily_usage WHERE date = ?').get(key) as Record<string, unknown> | undefined;
  if (!row) {
    db.prepare('INSERT INTO daily_usage (date, joins_count, comments_count, scans_count) VALUES (?, 0, 0, 0)').run(key);
    row = { date: key, joins_count: 0, comments_count: 0, scans_count: 0 };
  }
  return {
    date: String(row.date),
    joinsCount: Number(row.joins_count),
    commentsCount: Number(row.comments_count),
    scansCount: Number(row.scans_count),
  };
}

export function incrementTodayUsage(field: 'joins_count' | 'comments_count' | 'scans_count', amount = 1): DailyUsage {
  const key = todayDateKey();
  getTodayUsage();
  db.prepare(`UPDATE daily_usage SET ${field} = ${field} + ? WHERE date = ?`).run(amount, key);
  return getTodayUsage();
}

export function listDatasets(): GroupDataset[] {
  const rows = db.prepare(`
    SELECT
      d.id,
      d.keyword,
      d.created_at,
      COUNT(g.id) as total_groups,
      SUM(CASE WHEN g.group_type = 'Public' THEN 1 ELSE 0 END) as public_count,
      SUM(CASE WHEN g.join_status LIKE 'Đã tham gia%' THEN 1 ELSE 0 END) as joined_count,
      SUM(CASE WHEN g.post_approval = 'Không cần duyệt' OR g.comment_approval = 'Tự do bình luận' THEN 1 ELSE 0 END) as no_approval_count
    FROM group_datasets d
    LEFT JOIN facebook_groups g ON g.dataset_id = d.id
    GROUP BY d.id
    ORDER BY d.created_at DESC
  `).all() as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    keyword: String(r.keyword),
    createdAt: String(r.created_at),
    totalGroups: Number(r.total_groups ?? 0),
    publicCount: Number(r.public_count ?? 0),
    joinedCount: Number(r.joined_count ?? 0),
    noApprovalCount: Number(r.no_approval_count ?? 0),
  }));
}

export function listGroups(datasetId?: string): FacebookGroup[] {
  const rows = (
    datasetId
      ? db.prepare('SELECT * FROM facebook_groups WHERE dataset_id = ? ORDER BY member_count DESC').all(datasetId)
      : db.prepare('SELECT * FROM facebook_groups ORDER BY created_at DESC, member_count DESC').all()
  ) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    datasetId: String(r.dataset_id),
    keyword: String(r.keyword),
    name: String(r.name),
    memberCount: Number(r.member_count),
    groupType: r.group_type as FacebookGroup['groupType'],
    postApproval: (r.post_approval || 'Không cần duyệt') as PostApprovalPolicy,
    commentApproval: (r.comment_approval || 'Tự do bình luận') as CommentApprovalPolicy,
    url: String(r.url),
    joinStatus: r.join_status as FacebookGroup['joinStatus'],
    accountId: String(r.account_id || 'acc_01'),
    accountName: String(r.account_name || 'Minh Anh Marketing (Acc #01)'),
    joinedAt: r.joined_at ? String(r.joined_at) : null,
    createdAt: String(r.created_at),
  }));
}

export function listScanJobs(): ScanJob[] {
  const rows = db.prepare('SELECT * FROM scan_jobs ORDER BY created_at DESC').all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    datasetId: String(r.dataset_id),
    datasetKeyword: String(r.dataset_keyword),
    trackingKeywords: JSON.parse(String(r.tracking_keywords)),
    accountIds: JSON.parse(String(r.account_ids || '["acc_01"]')),
    delayMinSec: Number(r.delay_min_sec),
    delayMaxSec: Number(r.delay_max_sec),
    status: r.status as ScanJob['status'],
    matchedCount: Number(r.matched_count),
    scannedGroupsCount: Number(r.scanned_groups_count),
    totalGroupsCount: Number(r.total_groups_count),
    createdAt: String(r.created_at),
  }));
}

export function listScannedPosts(datasetId?: string): ScannedPost[] {
  const rows = (
    datasetId
      ? db.prepare('SELECT * FROM scanned_posts WHERE dataset_id = ? ORDER BY posted_at DESC').all(datasetId)
      : db.prepare('SELECT * FROM scanned_posts ORDER BY posted_at DESC').all()
  ) as Array<Record<string, unknown>>;

  return rows.map((r) => ({
    id: String(r.id),
    jobId: String(r.job_id),
    datasetId: String(r.dataset_id),
    keywordFound: String(r.keyword_found),
    groupName: String(r.group_name),
    groupId: String(r.group_id),
    postApproval: (r.post_approval || 'Không cần duyệt') as PostApprovalPolicy,
    commentApproval: (r.comment_approval || 'Tự do bình luận') as CommentApprovalPolicy,
    accountId: String(r.account_id || 'acc_01'),
    accountName: String(r.account_name || 'Minh Anh Marketing (Acc #01)'),
    postType: r.post_type as ScannedPost['postType'],
    directUrl: String(r.direct_url),
    content: String(r.content),
    postedAt: String(r.posted_at),
    authorName: String(r.author_name),
    intent: r.intent as ScannedPost['intent'],
    aiReply: r.ai_reply ? String(r.ai_reply) : null,
    aiCitations: JSON.parse(String(r.ai_citations || '[]')),
    replyStatus: r.reply_status as ScannedPost['replyStatus'],
    createdAt: String(r.created_at),
  }));
}

export function listKnowledgeDocs(): KnowledgeDoc[] {
  const rows = db.prepare('SELECT * FROM knowledge_docs ORDER BY updated_at DESC').all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    title: String(r.title),
    category: String(r.category),
    content: String(r.content),
    chunkCount: Number(r.chunk_count),
    sourceType: ((r.source_type as string) || 'text') as KnowledgeSourceType,
    fileName: r.file_name ? String(r.file_name) : null,
    mimeType: r.mime_type ? String(r.mime_type) : null,
    fileSize: r.file_size !== null && r.file_size !== undefined ? Number(r.file_size) : null,
    updatedAt: String(r.updated_at),
  }));
}

export function listStreams(): AutomationStream[] {
  const rows = db.prepare('SELECT * FROM automation_streams ORDER BY id ASC').all() as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    name: String(r.name),
    module: r.module as AutomationStream['module'],
    status: r.status as AutomationStream['status'],
    currentAction: String(r.current_action),
    progress: Number(r.progress),
    total: Number(r.total),
    nextDelaySec: r.next_delay_sec !== null && r.next_delay_sec !== undefined ? Number(r.next_delay_sec) : null,
    updatedAt: String(r.updated_at),
  }));
}

export function listRecentLogs(limit = 20): ActivityLog[] {
  const rows = db.prepare('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ?').all(limit) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
    id: String(r.id),
    module: String(r.module),
    level: r.level as ActivityLog['level'],
    message: String(r.message),
    createdAt: String(r.created_at),
  }));
}

export function addActivityLog(module: string, level: ActivityLog['level'], message: string): ActivityLog {
  const entry: ActivityLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    module,
    level,
    message,
    createdAt: new Date().toISOString(),
  };
  db.prepare('INSERT INTO activity_logs (id, module, level, message, created_at) VALUES (?, ?, ?, ?, ?)').run(
    entry.id,
    entry.module,
    entry.level,
    entry.message,
    entry.createdAt
  );
  return entry;
}

export function getDashboardSnapshot(): DashboardSnapshot {
  const groupStats = db.prepare(`
    SELECT
      COUNT(*) as total_groups,
      SUM(CASE WHEN join_status LIKE 'Đã tham gia%' THEN 1 ELSE 0 END) as joined_groups,
      SUM(CASE WHEN post_approval = 'Không cần duyệt' THEN 1 ELSE 0 END) as no_approval_groups
    FROM facebook_groups
  `).get() as { total_groups: number; joined_groups: number; no_approval_groups: number };

  const postStats = db.prepare(`
    SELECT
      SUM(CASE WHEN post_type = 'Post' THEN 1 ELSE 0 END) as posts_count,
      SUM(CASE WHEN post_type = 'Comment' THEN 1 ELSE 0 END) as comments_count,
      SUM(CASE WHEN ai_reply IS NOT NULL AND ai_reply != '' THEN 1 ELSE 0 END) as ai_count,
      SUM(CASE WHEN reply_status IN ('Đã duyệt (Auto-Comment)', 'Đã gửi') THEN 1 ELSE 0 END) as approved_count
    FROM scanned_posts
  `).get() as Record<string, number>;

  const accounts = listFacebookAccounts();
  const fanpages = listFanpages();
  const scheduledPosts = listScheduledPosts();
  const jobs = listScanJobs();
  const keywordSet = new Set<string>();
  for (const ds of listDatasets()) keywordSet.add(ds.keyword);
  for (const job of jobs) {
    for (const kw of job.trackingKeywords) keywordSet.add(kw);
  }

  const rawDaily = db.prepare(`
    SELECT
      substr(posted_at, 1, 10) as d,
      SUM(CASE WHEN post_type = 'Post' THEN 1 ELSE 0 END) as posts,
      SUM(CASE WHEN post_type = 'Comment' THEN 1 ELSE 0 END) as comments
    FROM scanned_posts
    GROUP BY d
    ORDER BY d ASC
    LIMIT 10
  `).all() as Array<{ d: string; posts: number; comments: number }>;

  const dailySeries: DailyChartPoint[] = rawDaily.map((r) => ({
    date: r.d.slice(5),
    posts: Number(r.posts ?? 0),
    comments: Number(r.comments ?? 0),
  }));

  const rawKeywords = db.prepare(`
    SELECT keyword_found as kw, COUNT(*) as c
    FROM scanned_posts
    GROUP BY keyword_found
    ORDER BY c DESC
    LIMIT 8
  `).all() as Array<{ kw: string; c: number }>;

  const keywordSeries: KeywordChartPoint[] = rawKeywords.map((r) => ({
    keyword: String(r.kw),
    count: Number(r.c),
  }));

  const adsReadyAssetsCount =
    accounts.filter((a) => a.adAccountStatus === 'Sẵn sàng chạy Ads').length +
    fanpages.filter((p) => p.adReadiness === 'Sẵn sàng chạy Ads').length;

  return {
    totals: {
      groupsScanned: Number(groupStats.total_groups ?? 0),
      publicGroupsJoined: Number(groupStats.joined_groups ?? 0),
      noApprovalGroups: Number(groupStats.no_approval_groups ?? 0),
      keywordsTracked: keywordSet.size,
      postsCollected: Number(postStats.posts_count ?? 0),
      commentsCollected: Number(postStats.comments_count ?? 0),
      aiRepliesGenerated: Number(postStats.ai_count ?? 0),
      approvedAutoComments: Number(postStats.approved_count ?? 0),
      activeAccounts: accounts.filter((a) => a.enabled).length,
      runningAccounts: accounts.filter((a) => a.workerStatus === 'running').length,
      fanpagesCount: fanpages.length,
      adsReadyAssetsCount,
      scheduledPostsCount: scheduledPosts.filter((p) => p.status === 'scheduled').length,
      publishedPostsCount: scheduledPosts.filter((p) => p.status === 'published').length,
    },
    dailySeries,
    keywordSeries,
    streams: listStreams(),
    accounts,
    fanpages,
    usageToday: getTodayUsage(),
    safetyConfig: getSafetyConfig(),
    recentLogs: listRecentLogs(15),
  };
}

export function verifyAppPasscode(passcode: string): boolean {
  const row = db.prepare('SELECT passcode_hash FROM app_passcode WHERE id = 1').get() as
    | { passcode_hash: string }
    | undefined;
  if (!row) {
    // Auto-seed default passcode 8889 if missing
    db.prepare('INSERT OR REPLACE INTO app_passcode (id, passcode_hash, updated_at) VALUES (1, ?, ?)').run(
      hashPassword(DEFAULT_APP_PASSCODE),
      new Date().toISOString()
    );
    return passcode === DEFAULT_APP_PASSCODE;
  }
  return verifyPassword(passcode, String(row.passcode_hash));
}

export function updateAppPasscode(newPasscode: string): void {
  db.prepare('INSERT OR REPLACE INTO app_passcode (id, passcode_hash, updated_at) VALUES (1, ?, ?)').run(
    hashPassword(newPasscode),
    new Date().toISOString()
  );
}

export function createAppSession(token: string, expiresAt: string): void {
  db.prepare(`
    INSERT INTO app_sessions (token, expires_at, created_at)
    VALUES (?, ?, ?)
  `).run(token, expiresAt, new Date().toISOString());
}

export function isAppSessionValid(token: string): boolean {
  if (!token) return false;
  const row = db
    .prepare('SELECT expires_at FROM app_sessions WHERE token = ?')
    .get(token) as { expires_at: string } | undefined;
  if (!row) return false;

  if (new Date(row.expires_at).getTime() <= Date.now()) {
    db.prepare('DELETE FROM app_sessions WHERE token = ?').run(token);
    return false;
  }
  return true;
}

export function deleteAppSession(token: string): void {
  db.prepare('DELETE FROM app_sessions WHERE token = ?').run(token);
}

export function getSystemSettings(): SystemSettings {
  const row = db.prepare('SELECT * FROM system_settings WHERE id = 1').get() as Record<
    string,
    unknown
  >;
  return {
    id: Number(row.id),
    workspaceName: String(row.workspace_name),
    companyName: String(row.company_name),
    defaultTimezone: String(row.default_timezone),
    maxConcurrentWorkers: Number(row.max_concurrent_workers),
    aiModelName: String(row.ai_model_name),
    autoSchedulerEnabled: Boolean(row.auto_scheduler_enabled),
    requireApprovalBeforePost: Boolean(row.require_approval_before_post),
    maintenanceMode: Boolean(row.maintenance_mode),
    defaultProxyPool: String(row.default_proxy_pool),
    sessionTimeoutHours: Number(row.session_timeout_hours),
    updatedAt: String(row.updated_at),
  };
}

export function updateSystemSettings(patch: Partial<SystemSettings>): SystemSettings {
  const current = getSystemSettings();
  const next: SystemSettings = {
    ...current,
    ...patch,
    id: 1,
    updatedAt: new Date().toISOString(),
  };

  db.prepare(`
    UPDATE system_settings SET
      workspace_name = ?,
      company_name = ?,
      default_timezone = ?,
      max_concurrent_workers = ?,
      ai_model_name = ?,
      auto_scheduler_enabled = ?,
      require_approval_before_post = ?,
      maintenance_mode = ?,
      default_proxy_pool = ?,
      session_timeout_hours = ?,
      updated_at = ?
    WHERE id = 1
  `).run(
    next.workspaceName.trim() || 'SocialPulse FB',
    next.companyName.trim() || 'Hệ thống Automation & Social Listening',
    next.defaultTimezone.trim() || 'Asia/Ho_Chi_Minh',
    Math.min(20, Math.max(1, Number(next.maxConcurrentWorkers || 5))),
    next.aiModelName.trim() || 'gemini-4-hydrogen',
    next.autoSchedulerEnabled ? 1 : 0,
    next.requireApprovalBeforePost ? 1 : 0,
    next.maintenanceMode ? 1 : 0,
    next.defaultProxyPool.trim() || 'socks5://vn-hcm-res-01.proxy:1080',
    Math.min(720, Math.max(1, Number(next.sessionTimeoutHours || 24))),
    next.updatedAt
  );

  return getSystemSettings();
}

export function getDatabaseStats(): DatabaseStats {
  const countOf = (table: string) => {
    const r = db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as { c: number };
    return Number(r.c ?? 0);
  };
  return {
    accountsCount: countOf('fb_accounts'),
    fanpagesCount: countOf('fanpages'),
    groupsCount: countOf('facebook_groups'),
    postsCount: countOf('scanned_posts'),
    knowledgeDocsCount: countOf('knowledge_docs'),
    scheduledPostsCount: countOf('scheduled_posts'),
    logsCount: countOf('activity_logs'),
  };
}

