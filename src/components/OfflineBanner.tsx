import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

interface OfflineBannerProps {
  savedAt: number | null;
  onRetry: () => void;
  isRetrying: boolean;
}

const formatAgo = (savedAt: number | null): string => {
  if (!savedAt) return 'just now';
  const diffMs = Date.now() - savedAt;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
};

const OfflineBanner: React.FC<OfflineBannerProps> = ({ savedAt, onRetry, isRetrying }) => {
  return (
    <div className="sticky top-0 z-50 bg-amber-50 border-b border-amber-200">
      <div className="container mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-amber-900">
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span>
            Showing data from {formatAgo(savedAt)} — reconnecting…
          </span>
        </div>
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="flex items-center gap-1.5 text-xs font-medium text-amber-900 hover:text-amber-700 disabled:opacity-50 px-2 py-1 rounded border border-amber-300 bg-white hover:bg-amber-50"
        >
          <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
          {isRetrying ? 'Retrying…' : 'Retry now'}
        </button>
      </div>
    </div>
  );
};

export default OfflineBanner;
