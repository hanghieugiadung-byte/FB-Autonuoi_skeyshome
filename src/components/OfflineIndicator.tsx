import { WifiOff } from 'lucide-react';
import { useEffect, useState } from 'react';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 z-50 inline-flex items-center gap-2 rounded-lg bg-white border border-amber-400 px-3.5 py-2 text-xs font-semibold text-amber-900 shadow-md"
    >
      <WifiOff className="h-3.5 w-3.5 text-amber-600" />
      <span>Mất kết nối mạng — Đang tạm dùng dữ liệu bộ nhớ đệm</span>
    </div>
  );
}
