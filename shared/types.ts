export type GroupType = 'Public' | 'Private';

export type PostApprovalPolicy = 'Không cần duyệt' | 'Cần duyệt bài';
export type CommentApprovalPolicy = 'Tự do bình luận' | 'Kiểm duyệt bình luận';

export type JoinStatus =
  | 'Chờ tham gia'
  | 'Đang tham gia'
  | 'Đã tham gia (Auto-Join)'
  | 'Chờ duyệt (Private)'
  | 'Tạm hoãn (Quota)'
  | 'Lỗi';

export type AdReadinessStatus = 'Chưa sẵn sàng Ads' | 'Đang nuôi Ads' | 'Sẵn sàng chạy Ads';

export interface FacebookAccount {
  id: string;
  name: string;
  fbUid: string;
  profileUrl: string;
  cookieStatus: 'Hợp lệ' | 'Cần làm mới';
  cookieData: string;
  proxyEndpoint: string;
  warmupStage: 'Mới (1-7 ngày)' | 'Đang nuôi (8-21 ngày)' | 'Tin cậy (>21 ngày)';
  warmupDays: number;
  trustScore: number;
  adAccountStatus: AdReadinessStatus;
  recoveryEmail: string;
  twoFactorSecret: string;
  lastWarmupAt: string | null;
  postsPublishedCount: number;
  maxJoinsPerDay: number;
  maxCommentsPerDay: number;
  joinsToday: number;
  commentsToday: number;
  enabled: boolean;
  workerStatus: 'idle' | 'running' | 'paused' | 'error';
  currentTask: string;
  createdAt: string;
}

export interface GroupDataset {
  id: string;
  keyword: string;
  createdAt: string;
  totalGroups: number;
  publicCount: number;
  joinedCount: number;
  noApprovalCount: number;
}

export interface FacebookGroup {
  id: string;
  datasetId: string;
  keyword: string;
  name: string;
  memberCount: number;
  groupType: GroupType;
  postApproval: PostApprovalPolicy;
  commentApproval: CommentApprovalPolicy;
  url: string;
  joinStatus: JoinStatus;
  accountId: string;
  accountName: string;
  joinedAt: string | null;
  createdAt: string;
}

export type PostSourceType = 'Post' | 'Comment';

export type LeadIntent =
  | 'Hỏi mua / Cần tư vấn'
  | 'So sánh giá'
  | 'Khiếu nại / Vấn đề'
  | 'Thảo luận chung';

export type ReplyStatus =
  | 'Chưa tạo'
  | 'Đã tạo AI'
  | 'Đã duyệt (Auto-Comment)'
  | 'Đã gửi'
  | 'Đã Copy';

export interface ScannedPost {
  id: string;
  jobId: string;
  datasetId: string;
  keywordFound: string;
  groupName: string;
  groupId: string;
  postApproval: PostApprovalPolicy;
  commentApproval: CommentApprovalPolicy;
  accountId: string;
  accountName: string;
  postType: PostSourceType;
  directUrl: string;
  content: string;
  postedAt: string;
  authorName: string;
  intent: LeadIntent;
  aiReply: string | null;
  aiCitations: string[];
  replyStatus: ReplyStatus;
  createdAt: string;
}

export interface ScanJob {
  id: string;
  datasetId: string;
  datasetKeyword: string;
  trackingKeywords: string[];
  accountIds: string[];
  delayMinSec: number;
  delayMaxSec: number;
  status: 'running' | 'paused' | 'stopped' | 'completed';
  matchedCount: number;
  scannedGroupsCount: number;
  totalGroupsCount: number;
  createdAt: string;
}

export type KnowledgeSourceType = 'text' | 'document' | 'image' | 'audio' | 'video';

export interface KnowledgeDoc {
  id: string;
  title: string;
  category: string;
  content: string;
  chunkCount: number;
  sourceType: KnowledgeSourceType;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  updatedAt: string;
}

export interface RagChunkMatch {
  docId: string;
  docTitle: string;
  snippet: string;
  score: number;
}

export interface SafetyConfig {
  id: number;
  accountName: string;
  accountWarmupStage: 'Mới (1-7 ngày)' | 'Đang nuôi (8-21 ngày)' | 'Tin cậy (>21 ngày)';
  proxyEndpoint: string;
  cookiesConfigured: boolean;
  maxJoinsPerDay: number;
  maxCommentsPerDay: number;
  delayMinSec: number;
  delayMaxSec: number;
  activeStartHour: number;
  activeEndHour: number;
  autoPauseOnWarning: boolean;
  spintaxVariation: boolean;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  targetLandingUrl: string;
}

export interface DailyUsage {
  date: string;
  joinsCount: number;
  commentsCount: number;
  scansCount: number;
}

export type FanpageWarmupStage =
  | 'Mới tạo (1-7 ngày)'
  | 'Đang nuôi tương tác (8-21 ngày)'
  | 'Sẵn sàng chạy Ads';

export interface Fanpage {
  id: string;
  ownerAccountId: string;
  ownerAccountName: string;
  pageId: string;
  name: string;
  category: string;
  description: string;
  pageUrl: string;
  followersCount: number;
  warmupDays: number;
  warmupStage: FanpageWarmupStage;
  trustScore: number;
  adReadiness: AdReadinessStatus;
  postsPublishedCount: number;
  lastWarmupAt: string | null;
  enabled: boolean;
  workerStatus: 'idle' | 'running';
  currentTask: string;
  createdAt: string;
}

export type PostGoal =
  | 'Nuôi tương tác tự nhiên'
  | 'Bán hàng / Chốt đơn'
  | 'Review sản phẩm'
  | 'Chia sẻ kiến thức'
  | 'Khuyến mãi';

export type PostRecurrence = 'once' | 'daily' | 'every_2_days' | 'weekly';

export type ScheduledPostStatus = 'scheduled' | 'publishing' | 'published' | 'paused' | 'error';

export interface PostTargetRef {
  type: 'profile' | 'page';
  id: string;
  name: string;
  ownerAccountId: string;
}

export interface PublishedPostLink {
  targetId: string;
  targetName: string;
  targetType: 'profile' | 'page';
  url: string;
  publishedAt: string;
}

export interface ScheduledPost {
  id: string;
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
  status: ScheduledPostStatus;
  publishedAt: string | null;
  publishedUrls: PublishedPostLink[];
  lastError: string | null;
  createdAt: string;
}

export interface AutomationStream {
  id: string;
  name: string;
  module: 'group_finder' | 'keyword_scanner' | 'auto_comment' | 'warmup_worker' | 'auto_publisher';
  status: 'running' | 'paused' | 'stopped';
  currentAction: string;
  progress: number;
  total: number;
  nextDelaySec: number | null;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  module: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
  createdAt: string;
}

export interface DailyChartPoint {
  date: string;
  posts: number;
  comments: number;
}

export interface KeywordChartPoint {
  keyword: string;
  count: number;
}

export interface DashboardSnapshot {
  totals: {
    groupsScanned: number;
    publicGroupsJoined: number;
    noApprovalGroups: number;
    keywordsTracked: number;
    postsCollected: number;
    commentsCollected: number;
    aiRepliesGenerated: number;
    approvedAutoComments: number;
    activeAccounts: number;
    runningAccounts: number;
    fanpagesCount: number;
    adsReadyAssetsCount: number;
    scheduledPostsCount: number;
    publishedPostsCount: number;
  };
  dailySeries: DailyChartPoint[];
  keywordSeries: KeywordChartPoint[];
  streams: AutomationStream[];
  accounts: FacebookAccount[];
  fanpages: Fanpage[];
  usageToday: DailyUsage;
  safetyConfig: SafetyConfig;
  recentLogs: ActivityLog[];
}

export interface SystemSettings {
  id: number;
  workspaceName: string;
  companyName: string;
  defaultTimezone: string;
  maxConcurrentWorkers: number;
  aiModelName: string;
  autoSchedulerEnabled: boolean;
  requireApprovalBeforePost: boolean;
  maintenanceMode: boolean;
  defaultProxyPool: string;
  sessionTimeoutHours: number;
  updatedAt: string;
}

export interface DatabaseStats {
  accountsCount: number;
  fanpagesCount: number;
  groupsCount: number;
  postsCount: number;
  knowledgeDocsCount: number;
  scheduledPostsCount: number;
  logsCount: number;
}
