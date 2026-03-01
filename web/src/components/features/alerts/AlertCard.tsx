import { AlertTriangle, Clock, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui';
import type { LucideIcon } from 'lucide-react';

const severityConfig: Record<
  string,
  { icon: LucideIcon; badgeVariant: 'danger' | 'warning' | 'default' }
> = {
  danger: { icon: AlertTriangle, badgeVariant: 'danger' },
  warning: { icon: Clock, badgeVariant: 'warning' },
  orange: { icon: XCircle, badgeVariant: 'warning' },
};

interface AlertCardProps {
  leadName: string;
  vendedor: string;
  dias: number;
  kommoUrl: string;
  severity: 'danger' | 'warning' | 'orange';
}

export function AlertCard({
  leadName,
  vendedor,
  dias,
  kommoUrl,
  severity,
}: AlertCardProps) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <a
      href={kommoUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-button border border-glass-border bg-surface px-4 py-3 transition-colors hover:bg-surface-secondary light:bg-surface-light light:border-glass-border-light light:hover:bg-surface-light-secondary"
    >
      <Icon className="h-4 w-4 flex-shrink-0 text-muted" />
      <div className="flex flex-1 items-center justify-between gap-2 min-w-0">
        <div className="flex flex-col min-w-0">
          <span className="text-body-md font-heading font-medium truncate">
            {leadName}
          </span>
          <span className="text-body-sm text-muted truncate">
            {vendedor}
          </span>
        </div>
        <Badge variant={config.badgeVariant} className="flex-shrink-0">
          {dias}d
        </Badge>
      </div>
    </a>
  );
}
