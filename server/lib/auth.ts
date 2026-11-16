import crypto from 'node:crypto';
import type { PermissionKey, UserRole } from '../../shared/types.ts';

export const ALL_PERMISSIONS: Array<{
  key: PermissionKey;
  label: string;
  description: string;
}> = [
  {
    key: 'view_dashboard',
    label: 'Xem Dashboard Báo cáo',
    description: 'Xem thống kê realtime, biểu đồ và nhật ký hoạt động',
  },
  {
    key: 'manage_fb_accounts',
    label: 'Quản lý Tài khoản FB',
    description: 'Thêm, bật/tắt, xóa tài khoản Facebook & cấu hình Proxy/Cookie',
  },
  {
    key: 'manage_nurture',
    label: 'Nuôi Nick & Fanpage Ads',
    description: 'Tạo Profile mẫu, tạo Fanpage mới và chạy phiên nuôi Trust',
  },
  {
    key: 'manage_publisher',
    label: 'Lịch Đăng bài AI',
    description: 'Gọi AI viết bài, lên lịch đăng & đăng ngay lên FB/Fanpage',
  },
  {
    key: 'run_group_finder',
    label: 'Tìm kiếm & Join Group',
    description: 'Tìm Group theo từ khóa, Auto-Join Public và xóa tập dữ liệu',
  },
  {
    key: 'run_scanner',
    label: 'Quét Nội dung & Comment',
    description: 'Chạy/dừng luồng quét bài viết và comment trong Group',
  },
  {
    key: 'manage_ai_rag',
    label: 'AI Content & Kho RAG',
    description: 'Tải lên tài liệu đa phương tiện, sinh trả lời AI & duyệt Auto-Comment',
  },
  {
    key: 'manage_safety',
    label: 'Cấu hình An toàn & UTM',
    description: 'Thay đổi giới hạn Anti-Ban, delay và cấu hình UTM tracking',
  },
  {
    key: 'manage_system_admin',
    label: 'Quản trị Hệ thống & Phân quyền',
    description: 'Quản lý User, cấp Role/quyền hạn và thiết lập hệ thống',
  },
];

export const DEFAULT_ROLE_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  admin: ALL_PERMISSIONS.map((p) => p.key),
  manager: [
    'view_dashboard',
    'manage_fb_accounts',
    'manage_nurture',
    'manage_publisher',
    'run_group_finder',
    'run_scanner',
    'manage_ai_rag',
    'manage_safety',
  ],
  operator: [
    'view_dashboard',
    'manage_nurture',
    'manage_publisher',
    'run_group_finder',
    'run_scanner',
    'manage_ai_rag',
  ],
  viewer: ['view_dashboard'],
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Quản trị viên (Admin)',
  manager: 'Quản lý Chiến dịch',
  operator: 'Nhân viên Vận hành',
  viewer: 'Chỉ xem Báo cáo',
};

export function hashPassword(password: string, existingSalt?: string): string {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex) return false;
  const actualBuf = crypto.scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (actualBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(actualBuf, expectedBuf);
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function parseCookieValue(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(pair.slice(idx + 1).trim());
    }
  }
  return null;
}

export function userHasPermission(
  user: { role: UserRole; permissions: PermissionKey[]; active: boolean } | null | undefined,
  permission: PermissionKey
): boolean {
  if (!user || !user.active) return false;
  if (user.role === 'admin') return true;
  return user.permissions.includes(permission);
}
