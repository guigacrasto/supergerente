import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface Props {
  timestamp?: string;
  className?: string;
}

export function LiveTimestamp({ timestamp, className }: Props) {
  const [, setTick] = useState(0);

  // Force re-render every minute to update "X min ago" text
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!timestamp) return null;

  return (
    <div className={`flex items-center gap-1.5 text-body-sm text-muted ${className || ''}`}>
      <RefreshCw className="h-3.5 w-3.5 animate-spin-slow" />
      <span>Atualizado às {timestamp}</span>
    </div>
  );
}
