import {
  CheckCircle2,
  Database,
  Edit3,
  KeyRound,
  Lock,
  Plus,
  Save,
  Settings,
  Shield,
  ShieldAlert,
  Trash2,
  UserCog,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  AdminUser,
  DatabaseStats,
  PermissionKey,
  SystemSettings,
  UserRole,
} from '../../shared/types';
import { apiFetch } from '../utils/authToken';
import { formatShortDateTime } from '../utils/formatters';
import {
  ALL_PERMISSIONS,
  canUserAccess,
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_LABELS,
} from '../utils/rbac';

interface SystemAdminViewProps {
  currentUser: AdminUser;
  systemSettings: SystemSettings | null;
  onSystemSettingsUpdated: (next: SystemSettings) => void;
}

const ROLE_BADGE_CLASSES: Record<UserRole, string> = {
  admin: 'border-blue-300 text-blue-800 bg-white',
  manager: 'border-indigo-300 text-indigo-800 bg-white',
  operator: 'border-teal-300 text-teal-800 bg-white',
  viewer: 'border-slate-300 text-slate-700 bg-white',
};

export function SystemAdminView({
  currentUser,
  systemSettings: initialSettings,
  onSystemSettingsUpdated,
}: SystemAdminViewProps) {
  const canManageAdmin = canUserAccess(currentUser, 'manage_system_admin');

  const [subTab, setSubTab] = useState<'users' | 'setup' | 'security'>(
    canManageAdmin ? 'users' : 'security'
  );
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [settingsForm, setSettingsForm] = useState<SystemSettings | null>(initialSettings);
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
  const [loadingAdmin, setLoadingAdmin] = useState(false);

  // User Create / Edit Form State
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [formUsername, setFormUsername] = useState('');
  const [formFullName, setFormFullName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<UserRole>('operator');
  const [formPermissions, setFormPermissions] = useState<PermissionKey[]>(
    DEFAULT_ROLE_PERMISSIONS.operator
  );
  const [formActive, setFormActive] = useState(true);

  // Personal Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadAdminOverview = async () => {
    if (!canManageAdmin) return;
    setLoadingAdmin(true);
    try {
      const res = await apiFetch('/api/admin/overview');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users ?? []);
        if (data.systemSettings) {
          setSettingsForm(data.systemSettings);
        }
        if (data.dbStats) {
          setDbStats(data.dbStats);
        }
      }
    } finally {
      setLoadingAdmin(false);
    }
  };

  useEffect(() => {
    if (canManageAdmin) {
      loadAdminOverview();
    } else {
      setSubTab('security');
    }
  }, [canManageAdmin]);

  useEffect(() => {
    if (initialSettings && !settingsForm) {
      setSettingsForm(initialSettings);
    }
  }, [initialSettings, settingsForm]);

  const resetUserForm = () => {
    setEditingUserId(null);
    setFormUsername('');
    setFormFullName('');
    setFormPassword('');
    setFormRole('operator');
    setFormPermissions(DEFAULT_ROLE_PERMISSIONS.operator);
    setFormActive(true);
  };

  const handleRoleChange = (nextRole: UserRole) => {
    setFormRole(nextRole);
    setFormPermissions([...DEFAULT_ROLE_PERMISSIONS[nextRole]]);
  };

  const togglePermission = (key: PermissionKey) => {
    setFormPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const startEditUser = (u: AdminUser) => {
    setEditingUserId(u.id);
    setFormUsername(u.username);
    setFormFullName(u.fullName);
    setFormPassword('');
    setFormRole(u.role);
    setFormPermissions([...u.permissions]);
    setFormActive(u.active);
    setFeedback(null);
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!formFullName.trim()) {
      setFeedback({ type: 'err', text: 'Vui lòng nhập Họ và tên nhân sự.' });
      return;
    }

    if (!editingUserId) {
      if (!formUsername.trim() || formPassword.length < 6) {
        setFeedback({
          type: 'err',
          text: 'Vui lòng nhập Email/Tên đăng nhập và Mật khẩu tối thiểu 6 ký tự.',
        });
        return;
      }
    } else if (formPassword && formPassword.length < 6) {
      setFeedback({
        type: 'err',
        text: 'Mật khẩu đặt lại phải có tối thiểu 6 ký tự (hoặc để trống nếu giữ nguyên).',
      });
      return;
    }

    setSaving(true);
    try {
      const url = editingUserId
        ? `/api/admin/users/${encodeURIComponent(editingUserId)}`
        : '/api/admin/users';
      const method = editingUserId ? 'PUT' : 'POST';
      const payload = editingUserId
        ? {
            fullName: formFullName.trim(),
            role: formRole,
            permissions: formPermissions,
            active: formActive,
            ...(formPassword ? { password: formPassword } : {}),
          }
        : {
            username: formUsername.trim(),
            fullName: formFullName.trim(),
            password: formPassword,
            role: formRole,
            permissions: formPermissions,
            active: formActive,
          };

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Không thể lưu thông tin tài khoản.');
      }
      setUsers(data.users ?? []);
      setFeedback({
        type: 'ok',
        text: editingUserId
          ? `Đã cập nhật phân quyền cho tài khoản "${formUsername}".`
          : `Đã tạo tài khoản "${formUsername}" và cấp quyền ${ROLE_LABELS[formRole]}.`,
      });
      resetUserForm();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Lỗi thao tác tài khoản.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleUserActive = async (u: AdminUser) => {
    setFeedback(null);
    try {
      const res = await apiFetch(`/api/admin/users/${encodeURIComponent(u.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !u.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể thay đổi trạng thái.');
      setUsers(data.users ?? []);
      setFeedback({
        type: 'ok',
        text: `Đã ${!u.active ? 'kích hoạt lại' : 'khóa tạm thời'} tài khoản ${u.username}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Lỗi cập nhật trạng thái.',
      });
    }
  };

  const handleDeleteUser = async (u: AdminUser) => {
    setFeedback(null);
    try {
      const res = await apiFetch(`/api/admin/users/${encodeURIComponent(u.id)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể xóa tài khoản.');
      setUsers(data.users ?? []);
      if (editingUserId === u.id) resetUserForm();
      setFeedback({ type: 'ok', text: `Đã xóa tài khoản "${u.username}".` });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Lỗi xóa tài khoản.',
      });
    }
  };

  const handleSaveSystemSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settingsForm) return;
    setFeedback(null);
    setSaving(true);
    try {
      const res = await apiFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể lưu cấu hình hệ thống.');
      setSettingsForm(data.systemSettings);
      if (data.dbStats) setDbStats(data.dbStats);
      onSystemSettingsUpdated(data.systemSettings);
      setFeedback({ type: 'ok', text: 'Đã lưu cấu hình Setup Hệ thống vào SQLite.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Lỗi lưu cấu hình.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (newPassword.length < 6) {
      setFeedback({ type: 'err', text: 'Mật khẩu mới phải có tối thiểu 6 ký tự.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'err', text: 'Xác nhận mật khẩu mới không khớp.' });
      return;
    }

    setSaving(true);
    try {
      const res = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Đổi mật khẩu thất bại.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFeedback({ type: 'ok', text: 'Đã đổi mật khẩu đăng nhập thành công!' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Không thể đổi mật khẩu.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner (Pure white surface with crisp blue-slate accent) */}
      <section className="bg-white border border-slate-200 border-l-4 border-l-blue-600 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold text-slate-900">
              Quản trị Hệ thống, Setup &amp; Phân quyền Nhân sự (RBAC)
            </h2>
            <p className="text-sm text-slate-700 mt-0.5">
              Quản lý tài khoản đăng nhập hệ thống, phân quyền chi tiết theo từng Module và thiết lập thông số vận hành toàn cục.
            </p>
          </div>
        </div>

        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-white border border-slate-200 rounded-lg self-start lg:self-auto shrink-0">
          {canManageAdmin && (
            <>
              <button
                type="button"
                onClick={() => {
                  setSubTab('users');
                  setFeedback(null);
                }}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${
                  subTab === 'users'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Tài khoản &amp; Phân quyền ({users.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSubTab('setup');
                  setFeedback(null);
                }}
                className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${
                  subTab === 'setup'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Settings className="h-3.5 w-3.5" />
                <span>Cài đặt &amp; Setup Hệ thống</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setSubTab('security');
              setFeedback(null);
            }}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap ${
              subTab === 'security'
                ? 'bg-blue-600 text-white'
                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Tài khoản cá nhân &amp; Mật khẩu</span>
          </button>
        </div>
      </section>

      {feedback && (
        <div
          role={feedback.type === 'err' ? 'alert' : 'status'}
          className={`px-4 py-3 rounded-xl border bg-white text-xs font-semibold ${
            feedback.type === 'err'
              ? 'border-red-300 text-red-700'
              : 'border-emerald-300 text-emerald-700'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Sub-tab 1: Users & RBAC */}
      {subTab === 'users' && canManageAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Create or Edit User + Granular Permissions */}
          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <h3 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
                <UserCog className="h-4 w-4 text-blue-600" />
                <span>{editingUserId ? 'Cập nhật Phân quyền Tài khoản' : 'Tạo Tài khoản & Cấp quyền mới'}</span>
              </h3>
              {editingUserId && (
                <button
                  type="button"
                  onClick={resetUserForm}
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 underline"
                >
                  Hủy sửa
                </button>
              )}
            </div>

            <form onSubmit={handleSubmitUser} className="space-y-4">
              <div>
                <label
                  htmlFor="admin-user-username"
                  className="block text-xs font-semibold text-slate-800 mb-1"
                >
                  Email / Tên đăng nhập
                </label>
                <input
                  id="admin-user-username"
                  type="text"
                  disabled={Boolean(editingUserId)}
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="nhanvien@congty.vn"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white disabled:text-slate-500 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="admin-user-fullname"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Họ và tên
                  </label>
                  <input
                    id="admin-user-fullname"
                    type="text"
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="admin-user-role"
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    Vai trò (Role)
                  </label>
                  <select
                    id="admin-user-role"
                    value={formRole}
                    onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none"
                  >
                    <option value="admin">{ROLE_LABELS.admin}</option>
                    <option value="manager">{ROLE_LABELS.manager}</option>
                    <option value="operator">{ROLE_LABELS.operator}</option>
                    <option value="viewer">{ROLE_LABELS.viewer}</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="admin-user-password"
                  className="block text-xs font-semibold text-slate-800 mb-1"
                >
                  {editingUserId
                    ? 'Đặt mật khẩu mới (để trống nếu giữ nguyên)'
                    : 'Mật khẩu đăng nhập (tối thiểu 6 ký tự)'}
                </label>
                <input
                  id="admin-user-password"
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  placeholder={editingUserId ? '••••••••' : 'Nhập mật khẩu...'}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              {/* Granular Permission Checkboxes */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">
                    Ma trận Phân quyền chi tiết ({formRole === 'admin' ? ALL_PERMISSIONS.length : formPermissions.length}/{ALL_PERMISSIONS.length})
                  </span>
                  <span className="text-slate-600">
                    {formRole === 'admin' ? 'Admin có toàn quyền' : 'Tùy chỉnh từng quyền'}
                  </span>
                </div>

                <div className="border border-slate-200 rounded-lg divide-y divide-slate-200 bg-white max-h-64 overflow-y-auto">
                  {ALL_PERMISSIONS.map((perm) => {
                    const checked =
                      formRole === 'admin' || formPermissions.includes(perm.key);
                    return (
                      <label
                        key={perm.key}
                        className="flex items-start gap-2.5 p-2.5 cursor-pointer hover:border-blue-300 text-xs"
                      >
                        <input
                          type="checkbox"
                          disabled={formRole === 'admin'}
                          checked={checked}
                          onChange={() => togglePermission(perm.key)}
                          className="mt-0.5 h-4 w-4 accent-blue-600 rounded shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900">{perm.label}</div>
                          <div className="text-slate-600 leading-snug">{perm.description}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="h-4 w-4 accent-blue-600 rounded"
                />
                <span>Kích hoạt tài khoản ngay</span>
              </label>

              <button
                type="submit"
                disabled={saving}
                className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold"
              >
                {editingUserId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                <span>
                  {saving
                    ? 'Đang lưu...'
                    : editingUserId
                      ? 'Lưu Cập nhật Phân quyền'
                      : 'Tạo Tài khoản & Cấp quyền'}
                </span>
              </button>
            </form>
          </section>

          {/* Right: Users Directory */}
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 bg-white border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900">
                  Danh sách Tài khoản &amp; Phân quyền ({users.length})
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Kiểm soát truy cập từng nhân sự vào các module tự động hóa Facebook &amp; AI
                </p>
              </div>
              {loadingAdmin && (
                <span className="text-xs font-medium text-blue-700">Đang tải...</span>
              )}
            </div>

            <div className="divide-y divide-slate-200">
              {users.map((u) => {
                const isSelf = u.id === currentUser.id;
                return (
                  <article key={u.id} className="p-5 space-y-3 bg-white">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-display text-sm font-bold text-slate-900">
                            {u.fullName}
                          </h4>
                          <span
                            className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${ROLE_BADGE_CLASSES[u.role]}`}
                          >
                            {ROLE_LABELS[u.role]}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${
                              u.active
                                ? 'border-emerald-300 text-emerald-800 bg-white'
                                : 'border-red-300 text-red-700 bg-white'
                            }`}
                          >
                            {u.active ? 'Đang hoạt động' : 'Đã khóa'}
                          </span>
                          {isSelf && (
                            <span className="text-[11px] font-semibold text-blue-700">
                              · Bạn đang đăng nhập
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-700 font-mono">
                          <span>{u.username}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            Đăng nhập gần nhất:{' '}
                            {u.lastLoginAt ? formatShortDateTime(u.lastLoginAt) : 'Chưa đăng nhập'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditUser(u)}
                          aria-label={`Phân quyền tài khoản ${u.username}`}
                          className="px-2.5 py-1.5 rounded-lg border border-blue-200 bg-white hover:border-blue-400 text-xs font-semibold text-blue-700 inline-flex items-center gap-1 whitespace-nowrap"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          <span>Phân quyền</span>
                        </button>

                        {!isSelf && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleUserActive(u)}
                              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap ${
                                u.active
                                  ? 'border-amber-200 bg-white text-amber-800 hover:border-amber-400'
                                  : 'border-emerald-200 bg-white text-emerald-700 hover:border-emerald-400'
                              }`}
                            >
                              {u.active ? 'Khóa' : 'Mở khóa'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(u)}
                              aria-label={`Xóa tài khoản ${u.username}`}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-red-600 hover:border-red-300"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Granted Permissions Summary */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {u.role === 'admin' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-blue-200 bg-white text-[11px] font-medium text-blue-800">
                          <Shield className="h-3 w-3" />
                          <span>Toàn quyền Quản trị Hệ thống (9/9 modules)</span>
                        </span>
                      ) : (
                        u.permissions.map((permKey) => {
                          const meta = ALL_PERMISSIONS.find((p) => p.key === permKey);
                          return (
                            <span
                              key={permKey}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-slate-200 bg-white text-[11px] font-medium text-slate-800"
                            >
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              <span>{meta?.label ?? permKey}</span>
                            </span>
                          );
                        })
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* Sub-tab 2: System Setup & SQLite Overview */}
      {subTab === 'setup' && canManageAdmin && settingsForm && (
        <div className="space-y-6">
          {/* SQLite Database Stats Strip */}
          {dbStats && (
            <section
              aria-label="Thống kê dữ liệu SQLite"
              className="grid grid-cols-2 sm:grid-cols-4 gap-4"
            >
              {[
                { label: 'Nick FB & Fanpage', value: dbStats.accountsCount + dbStats.fanpagesCount, sub: `${dbStats.accountsCount} Nick · ${dbStats.fanpagesCount} Page` },
                { label: 'Group & Bài quét', value: dbStats.groupsCount + dbStats.postsCount, sub: `${dbStats.groupsCount} Group · ${dbStats.postsCount} Post` },
                { label: 'Kho RAG & Lịch AI', value: dbStats.knowledgeDocsCount + dbStats.scheduledPostsCount, sub: `${dbStats.knowledgeDocsCount} RAG · ${dbStats.scheduledPostsCount} Lịch` },
                { label: 'Nhân sự & Nhật ký', value: dbStats.usersCount, sub: `${dbStats.logsCount} log hệ thống` },
              ].map((card) => (
                <div
                  key={card.label}
                  className="bg-white border border-slate-200 border-t-2 border-t-blue-600 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span>{card.label}</span>
                    <Database className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="mt-1 font-mono tabular-nums text-2xl font-bold text-slate-900">
                    {card.value}
                  </div>
                  <div className="text-xs text-slate-600 mt-1 font-mono">{card.sub}</div>
                </div>
              ))}
            </section>
          )}

          {/* Setup Form */}
          <form
            onSubmit={handleSaveSystemSettings}
            className="bg-white border border-slate-200 rounded-xl p-6 space-y-6"
          >
            <div className="border-b border-slate-200 pb-4">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Thiết lập Thông số Hệ thống (System Setup)
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Cấu hình nhận diện Workspace, giới hạn luồng Worker song song, mô hình AI và chế độ bảo trì.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="sys-workspace-name"
                  className="block text-xs font-semibold text-slate-800 mb-1"
                >
                  Tên Workspace hiển thị
                </label>
                <input
                  id="sys-workspace-name"
                  type="text"
                  value={settingsForm.workspaceName}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, workspaceName: e.target.value })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="sys-company-name"
                  className="block text-xs font-semibold text-slate-800 mb-1"
                >
                  Tên Doanh nghiệp / Team Vận hành
                </label>
                <input
                  id="sys-company-name"
                  type="text"
                  value={settingsForm.companyName}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, companyName: e.target.value })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="sys-timezone"
                  className="block text-xs font-semibold text-slate-800 mb-1"
                >
                  Múi giờ mặc định (Lịch đăng AI)
                </label>
                <select
                  id="sys-timezone"
                  value={settingsForm.defaultTimezone}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, defaultTimezone: e.target.value })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  <option value="Asia/Ho_Chi_Minh">Asia/Ho_Chi_Minh (GMT+7)</option>
                  <option value="Asia/Bangkok">Asia/Bangkok (GMT+7)</option>
                  <option value="Asia/Singapore">Asia/Singapore (GMT+8)</option>
                  <option value="UTC">UTC (GMT+0)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="sys-ai-model"
                  className="block text-xs font-semibold text-slate-800 mb-1"
                >
                  Mô hình Gemini AI mặc định
                </label>
                <input
                  id="sys-ai-model"
                  type="text"
                  value={settingsForm.aiModelName}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, aiModelName: e.target.value })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="sys-max-workers"
                  className="block text-xs font-semibold text-slate-800 mb-1"
                >
                  Số luồng tài khoản chạy song song tối đa
                </label>
                <input
                  id="sys-max-workers"
                  type="number"
                  min={1}
                  max={20}
                  value={settingsForm.maxConcurrentWorkers}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      maxConcurrentWorkers: Math.max(1, Number(e.target.value)),
                    })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="sys-session-hours"
                  className="block text-xs font-semibold text-slate-800 mb-1"
                >
                  Thời hạn phiên đăng nhập (giờ)
                </label>
                <input
                  id="sys-session-hours"
                  type="number"
                  min={1}
                  max={720}
                  value={settingsForm.sessionTimeoutHours}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      sessionTimeoutHours: Math.max(1, Number(e.target.value)),
                    })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono tabular-nums text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label
                  htmlFor="sys-proxy-pool"
                  className="block text-xs font-semibold text-slate-800 mb-1"
                >
                  Proxy Pool mặc định khi khởi tạo Nick FB mới
                </label>
                <input
                  id="sys-proxy-pool"
                  type="text"
                  value={settingsForm.defaultProxyPool}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, defaultProxyPool: e.target.value })
                  }
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-200 text-xs">
              <label className="flex items-center gap-2.5 cursor-pointer text-slate-800 font-medium">
                <input
                  type="checkbox"
                  checked={settingsForm.autoSchedulerEnabled}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, autoSchedulerEnabled: e.target.checked })
                  }
                  className="h-4 w-4 accent-blue-600 rounded"
                />
                <span>Bật bộ lập lịch Auto-Publisher tự động quét &amp; đăng bài đến hạn</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-slate-800 font-medium">
                <input
                  type="checkbox"
                  checked={settingsForm.requireApprovalBeforePost}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      requireApprovalBeforePost: e.target.checked,
                    })
                  }
                  className="h-4 w-4 accent-blue-600 rounded"
                />
                <span>Yêu cầu kiểm duyệt nội dung trước khi kích hoạt Auto-Comment hàng loạt</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-amber-900 font-semibold">
                <input
                  type="checkbox"
                  checked={settingsForm.maintenanceMode}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, maintenanceMode: e.target.checked })
                  }
                  className="h-4 w-4 accent-amber-600 rounded"
                />
                <span>Bật Chế độ Bảo trì (tạm khóa thao tác của Manager/Operator/Viewer, chỉ Admin truy cập)</span>
              </label>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="h-10 px-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? 'Đang lưu...' : 'Lưu Cài đặt Hệ thống'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sub-tab 3: Own Profile Permissions & Password */}
      {subTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Thông tin Tài khoản &amp; Quyền hạn của bạn
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Tài khoản: <span className="font-mono font-semibold text-slate-900">{currentUser.username}</span> · Vai trò:{' '}
                <span className="font-semibold text-blue-700">{ROLE_LABELS[currentUser.role]}</span>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              {ALL_PERMISSIONS.map((perm) => {
                const allowed = canUserAccess(currentUser, perm.key);
                return (
                  <div
                    key={perm.key}
                    className={`p-3 rounded-lg border bg-white flex items-start gap-2.5 ${
                      allowed ? 'border-emerald-200' : 'border-slate-200 opacity-75'
                    }`}
                  >
                    {allowed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="font-semibold text-slate-900">{perm.label}</div>
                      <div className="text-slate-600 mt-0.5">
                        {allowed ? 'Được phép truy cập' : 'Chưa được cấp quyền'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
                <Lock className="h-4 w-4 text-blue-600" />
                <span>Đổi Mật khẩu Đăng nhập</span>
              </h3>
            </div>

            <form onSubmit={handleChangeOwnPassword} className="space-y-4">
              <div>
                <label
                  htmlFor="own-current-password"
                  className="block text-xs font-semibold text-slate-800 mb-1"
                >
                  Mật khẩu hiện tại
                </label>
                <input
                  id="own-current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="own-new-password"
                  className="block text-xs font-semibold text-slate-800 mb-1"
                >
                  Mật khẩu mới (tối thiểu 6 ký tự)
                </label>
                <input
                  id="own-new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="own-confirm-password"
                  className="block text-xs font-semibold text-slate-800 mb-1"
                >
                  Xác nhận mật khẩu mới
                </label>
                <input
                  id="own-confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full h-10 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-semibold"
              >
                <KeyRound className="h-4 w-4" />
                <span>{saving ? 'Đang cập nhật...' : 'Cập nhật Mật khẩu'}</span>
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
