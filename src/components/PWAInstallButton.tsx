import { Download, Smartphone, X } from 'lucide-react';
import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        aria-label="Cài đặt ứng dụng Web lên thiết bị"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-200 bg-white hover:border-emerald-400 text-xs font-semibold text-emerald-700 whitespace-nowrap shrink-0"
      >
        <Download className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Cài đặt App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          aria-label="Hướng dẫn cài đặt ứng dụng trên iOS"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-blue-400 text-xs font-semibold text-slate-800 whitespace-nowrap shrink-0"
        >
          <Smartphone className="h-3.5 w-3.5 text-blue-600" />
          <span>Cài trên iOS</span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          >
            <div className="w-full max-w-sm rounded-xl bg-white border border-slate-200 p-6 shadow-xl space-y-4">
              <div className="flex items-start justify-between gap-3">
                <h3 id="ios-install-title" className="font-display text-base font-bold text-slate-900">
                  Cài đặt SocialPulse lên iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Đóng hướng dẫn cài đặt"
                  className="p-1 text-slate-500 hover:text-slate-900"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ol className="space-y-2 text-sm text-slate-700 list-decimal pl-5">
                <li>Nhấn biểu tượng <strong>Chia sẻ (Share)</strong> trên thanh công cụ Safari.</li>
                <li>Cuộn xuống và chọn <strong>Thêm vào Màn hình chính (Add to Home Screen)</strong>.</li>
                <li>Nhấn <strong>Thêm (Add)</strong> để dùng như ứng dụng độc lập mọi lúc.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full h-10 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold"
              >
                Đã hiểu
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
}
