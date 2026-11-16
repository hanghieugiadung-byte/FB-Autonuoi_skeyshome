import { Eye, EyeOff, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import type { SystemSettings } from '../../shared/types';
import { apiFetch, saveAuthToken } from '../utils/authToken';

interface LoginViewProps {
  systemSettings: SystemSettings | null;
  onUnlockSuccess: (payload: { systemSettings: SystemSettings }) => void;
}

export function LoginView({ systemSettings, onUnlockSuccess }: LoginViewProps) {
  const [passcode, setPasscode] = useState('');
  const [showPasscode, setShowPasscode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!passcode.trim()) {
      setErrorMsg('Vui lòng nhập mật mã truy cập.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Mật mã truy cập không đúng.');
        return;
      }
      if (data.token) {
        saveAuthToken(String(data.token));
      }
      onUnlockSuccess({ systemSettings: data.systemSettings });
    } catch {
      setErrorMsg('Không thể kết nối tới máy chủ xác thực.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black flex flex-col justify-center items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-xl bg-blue-600 text-white flex items-center justify-center">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-black">
            {(() => {
              const name = (systemSettings?.workspaceName || 'SocialPulse FB').trim();
              if (name.endsWith(' FB')) {
                return (
                  <>
                    {name.slice(0, -3)} <span className="text-red-600">FB</span>
                  </>
                );
              }
              return (
                <>
                  {name} <span className="text-red-600">FB</span>
                </>
              );
            })()}
          </h1>
          <p className="text-sm text-neutral-800">
            {systemSettings?.companyName || 'Hệ thống Automation & Social Listening'}
          </p>
        </div>

        {/* Passcode Gate Card */}
        <div className="bg-white border border-neutral-300 border-t-4 border-t-blue-600 rounded-xl p-6 sm:p-8 space-y-5">
          <div>
            <h2 className="font-display text-lg font-bold text-black">
              Nhập mật mã truy cập
            </h2>
            <p className="text-xs text-neutral-800 mt-1">
              Workspace cá nhân yêu cầu nhập mật mã bảo vệ mỗi khi truy cập hệ thống.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="access-passcode"
                className="block text-xs font-bold text-black mb-1.5"
              >
                Mật mã truy cập (Passcode)
              </label>
              <div className="relative">
                <Lock className="h-4 w-4 text-red-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="access-passcode"
                  type={showPasscode ? 'text' : 'password'}
                  autoFocus
                  autoComplete="current-password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Nhập mật mã..."
                  className="w-full h-11 pl-9 pr-10 rounded-lg border border-neutral-400 bg-white text-base font-mono tracking-wider text-black placeholder:text-neutral-500 placeholder:font-sans placeholder:tracking-normal focus:border-blue-600 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPasscode((prev) => !prev)}
                  aria-label={showPasscode ? 'Ẩn mật mã' : 'Hiện mật mã'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-neutral-700 hover:text-black"
                >
                  {showPasscode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-2 text-xs text-neutral-700">
                Mật mã mặc định: <span className="font-mono font-bold text-blue-700">8889</span> (có thể đổi trong mục Cài đặt).
              </p>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="px-3.5 py-2.5 rounded-lg bg-white border-2 border-red-600 text-xs font-semibold text-red-700"
              >
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold transition-colors"
            >
              <KeyRound className="h-4 w-4" />
              <span>{submitting ? 'Đang kiểm tra...' : 'Mở khóa Hệ thống'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
