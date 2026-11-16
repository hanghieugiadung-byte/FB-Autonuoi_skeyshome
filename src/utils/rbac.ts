import type { AdminUser, PermissionKey, UserRole } from '../../shared/types';

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

export function canUserAccess(
  user: AdminUser | null | undefined,
  permission: PermissionKey
): boolean {
  if (!user || !user.active) return false;
  if (user.role === 'admin') return true;
  return user.permissions.includes(permission);
}
