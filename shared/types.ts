import { supabase } from '../supabaseClient';
import { Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type { AdminUser, PermissionKey, SystemSettings, UserRole } from '../../shared/types';
import { saveAuthToken } from '../utils/authToken';

interface LoginViewProps {
  systemSettings: SystemSettings | null;
  onLoginSuccess: (payload: { user: AdminUser; systemSettings: SystemSettings }) => void;
}

const ALL_PERMISSIONS: PermissionKey[] = [
  'view_dashboard',
  'manage_fb_accounts',
  'manage_nurture',
  'manage_publisher',
  'run_group_finder',
  'run_scanner',
  'manage_ai_rag',
  'manage_safety',
  'manage_system_admin',
];

export function LoginView({ systemSettings, onLoginSuccess }: LoginViewProps) {
  const [username, setUsername] = useState('admin@socialpulse.vn');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!username.trim() || !password) {
      setErrorMsg('Vui lòng nhập đầy đủ Email/Tên đăng nhập và Mật khẩu.');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: username.trim(),
        password: password,
      });

      if (error) {
        setErrorMsg('Lỗi đăng nhập: ' + error.message);
        return;
      }

      if (data.session) {
        saveAuthToken(data.session.access_token);
      }

      // 1. Xác định Role chuẩn chữ thường theo shared/types.ts
      const emailLower = username.toLowerCase();
      const userRole: UserRole = emailLower.includes('manager')
        ? 'manager'
        : emailLower.includes('operator')
        ? 'operator'
        : 'admin';

      // 2. Cấp mảng quyền tương ứng với Role
      const userPermissions: PermissionKey[] =
        userRole === 'admin'
          ? ALL_PERMISSIONS
          : userRole === 'manager'
          ? ALL_PERMISSIONS.filter((p) => p !== 'manage_system_admin')
          : ['view_dashboard', 'manage_nurture', 'manage_publisher', 'run_scanner'];

      const now = new Date().toISOString();

      // 3. Khởi tạo AdminUser khớp 100% interface
      const loggedInUser: AdminUser = {
        id: data.user?.id || '1',
        username: username.trim(),
        fullName:
          userRole === 'admin'
            ? 'Quản trị viên Hệ thống'
            : userRole === 'manager'
            ? 'Quản lý Vận hành'
            : 'Nhân viên Vận hành',
        role: userRole,
        permissions: userPermissions,
        active: true,
        lastLoginAt: now,
        createdAt: now,
      };

      // 4. Khởi tạo SystemSettings đầy đủ các trường chuỗi để tránh lỗi .split()
      const fullSystemSettings: SystemSettings = systemSettings || {
        id: 1,
        workspaceName: 'SocialPulse FB',
        companyName: 'Hệ thống Social Listening & Marketing Automation',
        defaultTimezone: 'Asia/Ho_Chi_Minh',
        maxConcurrentWorkers: 5,
        aiModelName: 'gemini-2.5-flash',
        autoSchedulerEnabled: true,
        requireApprovalBeforePost: false,
        maintenanceMode: false,
        defaultProxyPool: 'http://127.0.0.1:8080',
        sessionTimeoutHours: 24,
        updatedAt: now,
      };

      onLoginSuccess({
        user: loggedInUser,
        systemSettings: fullSystemSettings,
      });
    } catch {
      setErrorMsg('Không thể kết nối tới máy chủ xác thực.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillCredential = (email: string, pass: string) => {
    setUsername(email);
    setPassword(pass);
    setErrorMsg(null);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col justify-center items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            {systemSettings?.workspaceName || 'SocialPulse FB'}
          </h1>
          <p className="text-sm text-slate-600">
            {systemSettings?.companyName || 'Hệ thống Social Listening & Marketing Automation'}
          </p>
        </div>

        {/* Maintenance Warning */}
        {systemSettings?.maintenanceMode && (
          <div
            role="status"
            className="p-3.5 rounded-xl bg-white border-2 border-amber-400 text-xs font-medium text-amber-900"
          >
            Hệ thống đang ở chế độ bảo trì. Chỉ tài khoản Quản trị viên (Admin) mới được phép đăng nhập.
          </div>
        )}

        {/* Login Form Card */}
        <div className="bg-white border border-slate-200 border-t-4 border-t-blue-600 rounded-xl p-6 sm:p-8 shadow-xs space-y-5">
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Đăng nhập Quản trị Hệ thống
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Xác thực tài khoản để truy cập Workspace và các phân hệ được phân quyền.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-username"
                className="block text-xs font-semibold text-slate-800 mb-1.5"
              >
                Email / Tên đăng nhập
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin@socialpulse.vn"
                  className="w-full h-10 pl-9 pr-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-slate-800 mb-1.5"
              >
                Mật khẩu
              </label>
              <div className="relative">
                <Lock className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu..."
                  className="w-full h-10 pl-9 pr-10 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-900"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="px-3.5 py-2.5 rounded-lg bg-white border border-red-300 text-xs font-medium text-red-700"
              >
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
            >
              <KeyRound className="h-4 w-4" />
              <span>{submitting ? 'Đang xác thực...' : 'Đăng nhập Hệ thống'}</span>
            </button>
          </form>
        </div>

        {/* Initial Setup Credentials Helper */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="text-xs font-semibold text-slate-800">
            Tài khoản Setup mặc định (Nhấn để điền nhanh &amp; kiểm thử phân quyền):
          </div>
          <div className="grid grid-cols-1 gap-2 text-xs">
            <button
              type="button"
              onClick={() => fillCredential('admin@socialpulse.vn', 'Admin@123456')}
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-blue-200 bg-white hover:border-blue-400 text-left"
            >
              <div>
                <div className="font-semibold text-blue-800">Quản trị viên (Admin - Toàn quyền)</div>
                <div className="font-mono text-slate-700 mt-0.5">
                  admin@socialpulse.vn · Admin@123456
                </div>
              </div>
              <span className="font-semibold text-blue-700 shrink-0">Chọn</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => fillCredential('manager@socialpulse.vn', 'Manager@123')}
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:border-indigo-400 text-left"
              >
                <div className="font-semibold text-indigo-800">Manager</div>
                <div className="font-mono text-[11px] text-slate-700 truncate">
                  manager@socialpulse.vn
                </div>
              </button>
              <button
                type="button"
                onClick={() => fillCredential('operator@socialpulse.vn', 'Operator@123')}
                className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:border-teal-400 text-left"
              >
                <div className="font-semibold text-teal-800">Operator</div>
                <div className="font-mono text-[11px] text-slate-700 truncate">
                  operator@socialpulse.vn
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
