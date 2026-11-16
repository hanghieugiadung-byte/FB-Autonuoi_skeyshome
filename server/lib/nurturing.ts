import type {
  AdReadinessStatus,
  FanpageWarmupStage,
  PostGoal,
  PostRecurrence,
} from '../../shared/types.ts';

export interface PersonaDraft {
  name: string;
  fbUid: string;
  recoveryEmail: string;
  twoFactorSecret: string;
  proxyEndpoint: string;
  cookieData: string;
  warmupStage: 'Mới (1-7 ngày)';
  maxJoinsPerDay: number;
  maxCommentsPerDay: number;
}

const FIRST_NAMES = [
  'Nguyễn',
  'Trần',
  'Lê',
  'Phạm',
  'Hoàng',
  'Huỳnh',
  'Phan',
  'Vũ',
  'Đặng',
  'Bùi',
];

const MIDDLE_NAMES = ['Minh', 'Thảo', 'Gia', 'Bảo', 'Khánh', 'Ngọc', 'Hoài', 'Đức', 'Thanh', 'Quỳnh'];

const LAST_NAMES = ['Anh', 'Vy', 'Huy', 'Linh', 'Khang', 'Trang', 'Nam', 'My', 'Tâm', 'Nhi'];

const PROXY_REGIONS = ['vn-hcm-res', 'vn-hn-res', 'vn-dn-res', 'vn-ct-res'];

export function generatePersonaDraft(seedIndex: number): PersonaDraft {
  const safeSeed = Math.abs(Math.floor(seedIndex));
  const first = FIRST_NAMES[safeSeed % FIRST_NAMES.length];
  const middle = MIDDLE_NAMES[(safeSeed * 3 + 1) % MIDDLE_NAMES.length];
  const last = LAST_NAMES[(safeSeed * 7 + 2) % LAST_NAMES.length];
  const fullName = `${first} ${middle} ${last}`;

  const uidSuffix = String(10000000 + ((safeSeed * 7919 + 412345) % 89999999)).padStart(8, '0');
  const fbUid = `100089${uidSuffix}`;

  const slug = `${first}${middle}${last}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

  const tagNum = 10 + (safeSeed % 90);
  const recoveryEmail = `${slug}.${tagNum}@mailcare.vn`;

  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let twoFa = '';
  for (let i = 0; i < 16; i++) {
    twoFa += chars[(safeSeed * 13 + i * 7 + 5) % chars.length];
    if (i % 4 === 3 && i < 15) twoFa += ' ';
  }

  const region = PROXY_REGIONS[safeSeed % PROXY_REGIONS.length];
  const proxyPort = 1080 + (safeSeed % 20);
  const proxyEndpoint = `socks5://${region}-${String((safeSeed % 12) + 1).padStart(2, '0')}.proxy:${proxyPort}`;

  const xsToken = `${15 + (safeSeed % 50)}%3AVnAds${tagNum}Warmup${uidSuffix.slice(0, 4)}%3A2%3A1763200${tagNum}`;
  const cookieData = `c_user=${fbUid}; xs=${xsToken}; datr=nw_${slug}_${tagNum};`;

  return {
    name: `${fullName} (Ads Warmup #${tagNum})`,
    fbUid,
    recoveryEmail,
    twoFactorSecret: twoFa,
    proxyEndpoint,
    cookieData,
    warmupStage: 'Mới (1-7 ngày)',
    maxJoinsPerDay: 3,
    maxCommentsPerDay: 5,
  };
}

export function calculateNextTrustScore(
  currentScore: number,
  warmupDaysAfterSession: number,
  completedActionsCount: number
): {
  trustScore: number;
  adAccountStatus: AdReadinessStatus;
  fanpageStage: FanpageWarmupStage;
  accountWarmupStage: 'Mới (1-7 ngày)' | 'Đang nuôi (8-21 ngày)' | 'Tin cậy (>21 ngày)';
} {
  const safeCurrent = Math.min(100, Math.max(0, Number(currentScore) || 0));
  const boost = Math.min(12, Math.max(2, completedActionsCount * 2));
  const trustScore = Math.min(100, safeCurrent + boost);

  let adAccountStatus: AdReadinessStatus = 'Chưa sẵn sàng Ads';
  if (trustScore >= 82 && warmupDaysAfterSession >= 14) {
    adAccountStatus = 'Sẵn sàng chạy Ads';
  } else if (trustScore >= 50 || warmupDaysAfterSession >= 5) {
    adAccountStatus = 'Đang nuôi Ads';
  }

  let fanpageStage: FanpageWarmupStage = 'Mới tạo (1-7 ngày)';
  if (trustScore >= 82 && warmupDaysAfterSession >= 14) {
    fanpageStage = 'Sẵn sàng chạy Ads';
  } else if (warmupDaysAfterSession >= 7 || trustScore >= 55) {
    fanpageStage = 'Đang nuôi tương tác (8-21 ngày)';
  }

  let accountWarmupStage: 'Mới (1-7 ngày)' | 'Đang nuôi (8-21 ngày)' | 'Tin cậy (>21 ngày)' =
    'Mới (1-7 ngày)';
  if (warmupDaysAfterSession > 21 || trustScore >= 88) {
    accountWarmupStage = 'Tin cậy (>21 ngày)';
  } else if (warmupDaysAfterSession >= 8 || trustScore >= 58) {
    accountWarmupStage = 'Đang nuôi (8-21 ngày)';
  }

  return {
    trustScore,
    adAccountStatus,
    fanpageStage,
    accountWarmupStage,
  };
}

export function computeNextScheduledIso(
  currentIso: string,
  recurrence: PostRecurrence
): string | null {
  if (recurrence === 'once') {
    return null;
  }

  const base = new Date(currentIso);
  if (Number.isNaN(base.getTime())) {
    return null;
  }

  const daysToAdd =
    recurrence === 'daily' ? 1 : recurrence === 'every_2_days' ? 2 : 7;

  const next = new Date(base.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  return next.toISOString();
}

export function isPostDue(scheduledAtIso: string, nowMs: number = Date.now()): boolean {
  const scheduledMs = new Date(scheduledAtIso).getTime();
  if (Number.isNaN(scheduledMs)) return false;
  return scheduledMs <= nowMs;
}

export function buildWarmupPlan(
  targetType: 'profile' | 'page',
  warmupDays: number
): string[] {
  if (targetType === 'profile') {
    if (warmupDays <= 7) {
      return [
        'Lướt News Feed tự nhiên 3-5 phút, đọc bài viết dài',
        'Xem 2 video Facebook Watch / Reels không tua nhanh',
        'Thả cảm xúc (Like/Love) nhẹ 3-4 bài bạn bè & Page uy tín',
        'Xác minh email khôi phục & bảo mật 2FA trước khi tương tác Group',
      ];
    }
    if (warmupDays <= 21) {
      return [
        'Bình luận tương tác tự nhiên 2-3 bài viết không chứa link',
        'Tham gia 2 Group Public cùng tệp khách hàng mục tiêu',
        'Đăng 1 bài chia sẻ đời sống / kinh nghiệm lên tường cá nhân',
        'Mở trình quản lý Fanpage & chuẩn bị quyền Quản trị viên BM',
      ];
    }
    return [
      'Duy trì tương tác đều đặn 5-10 phút/ngày giữ độ Trust > 85%',
      'Kiểm tra chất lượng tài khoản (Account Quality) trước khi tạo TKQC',
      'Đăng bài định kỳ & tương tác chéo giữa Nick và Fanpage sở hữu',
    ];
  }

  if (warmupDays <= 7) {
    return [
      'Hoàn thiện Avatar, Cover, Mô tả chuẩn SEO & nút CTA Nhắn tin',
      'Đăng 1-2 bài chia sẻ giá trị thuần túy (chưa gắn link bán hàng)',
      'Mời danh sách bạn bè từ Nick chủ sở hữu thích Fanpage',
    ];
  }
  if (warmupDays <= 21) {
    return [
      'Đăng đều đặn 1 bài/ngày bằng AI kết hợp hình ảnh/video sản phẩm',
      'Trả lời bình luận & inbox mẫu để tăng tỷ lệ phản hồi Page',
      'Chạy tương tác mồi nhẹ chuẩn bị liên kết Business Manager',
    ];
  }
  return [
    'Fanpage đủ độ Trust cao — sẵn sàng chạy chiến dịch Ads chuyển đổi/tin nhắn',
    'Duy trì lịch đăng bài tự động 3-5 bài/tuần giữ tương tác tự nhiên',
  ];
}

export function buildFallbackPostDraft(params: {
  topic: string;
  goal: PostGoal;
  tone: string;
  utmLink?: string;
}): { postText: string; hashtags: string[] } {
  const { topic, goal, tone, utmLink } = params;
  const cleanTopic = topic.trim() || 'Giải pháp nhà thông minh';

  const openerMap: Record<PostGoal, string> = {
    'Nuôi tương tác tự nhiên': `Cuối tuần mọi người thường dành thời gian chăm chút gì cho góc nhỏ của mình? Riêng mình dạo này khá tâm đắc với chủ đề "${cleanTopic}".`,
    'Bán hàng / Chốt đơn': `Nếu bạn đang tìm giải pháp tối ưu cho "${cleanTopic}", đừng bỏ qua lựa chọn đang được nhiều gia đình tin dùng nhất tháng này.`,
    'Review sản phẩm': `Chia sẻ trải nghiệm thực tế sau thời gian sử dụng liên tục "${cleanTopic}" — điểm nào thật sự đáng tiền và lưu ý cho người mới:`,
    'Chia sẻ kiến thức': `3 kinh nghiệm thực tế giúp bạn tiết kiệm chi phí và chọn đúng "${cleanTopic}" phù hợp nhu cầu gia đình:`,
    'Khuyến mãi': `Ưu đãi đặc biệt dành riêng cho thành viên theo dõi Page: cơ hội sở hữu trọn bộ "${cleanTopic}" với mức giá tốt nhất trong tháng.`,
  };

  const body =
    tone.toLowerCase().includes('chuyên gia')
      ? 'Ưu tiên thiết kế bền bỉ, vận hành êm ái và chế độ bảo hành minh bạch luôn là tiêu chí hàng đầu giúp sử dụng lâu dài không lo phát sinh.'
      : 'Điều quan trọng nhất vẫn là sự tiện lợi hàng ngày, dễ thao tác cho cả gia đình và chính sách hỗ trợ sau mua rõ ràng.';

  const cta = utmLink
    ? `\n\n👉 Tham khảo thông số & ưu đãi chi tiết tại đây: ${utmLink}`
    : '\n\n💬 Bạn đang quan tâm khía cạnh nào nhất? Để lại bình luận bên dưới để cùng trao đổi nhé!';

  const slugTag = cleanTopic
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join('');

  const hashtags = [
    `#${slugTag || 'SocialPulse'}`,
    '#KinhNghiemThucTe',
    '#GiaDinhThongMinh',
  ];

  return {
    postText: `${openerMap[goal]}\n\n${body}${cta}`,
    hashtags,
  };
}
