import { TrendingUp, Users, Target } from 'lucide-react';
import { Card, CardHeader, CardTitle } from '@/components/ui';

interface TeamKPICardProps {
  label: string;
  team: string;
  novosHoje: number;
  ativos: number;
  novosMes: number;
}

export function TeamKPICard({
  label,
  team,
  novosHoje,
  ativos,
  novosMes,
}: TeamKPICardProps) {
  const titleColor = team === 'azul' ? 'text-accent-blue' : 'text-warning';
  const accentBorder = team === 'azul' ? 'border-l-accent-blue' : 'border-l-warning';

  return (
    <Card className={`border-l-4 ${accentBorder}`}>
      <CardHeader>
        <CardTitle className={titleColor}>{label}</CardTitle>
      </CardHeader>
      <div className="grid grid-cols-3 gap-4 px-5 pb-5">
        <div className="flex flex-col items-center gap-1 rounded-button bg-surface-secondary p-3">
          <TrendingUp className={`h-4 w-4 ${titleColor}`} />
          <span className="font-heading text-heading-sm">{novosHoje}</span>
          <span className="text-body-sm text-muted">Hoje</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-button bg-surface-secondary p-3">
          <Users className={`h-4 w-4 ${titleColor}`} />
          <span className="font-heading text-heading-sm">{ativos}</span>
          <span className="text-body-sm text-muted">Ativos</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded-button bg-surface-secondary p-3">
          <Target className={`h-4 w-4 ${titleColor}`} />
          <span className="font-heading text-heading-sm">{novosMes}</span>
          <span className="text-body-sm text-muted">Mes</span>
        </div>
      </div>
    </Card>
  );
}
