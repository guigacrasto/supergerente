import { User, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentScoreCardProps {
  nome: string;
  team: string;
  mediaSentimento: number;
  mediaQualidade: number;
  totalAnalisados: number;
  isSelected: boolean;
  onClick: () => void;
}

function ScoreStars({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            'h-3.5 w-3.5',
            i <= Math.round(score)
              ? 'fill-warning text-warning'
              : 'text-muted/30'
          )}
        />
      ))}
      <span className="ml-1 text-body-sm text-muted">{score.toFixed(1)}</span>
    </div>
  );
}

export function AgentScoreCard({
  nome,
  team,
  mediaSentimento,
  mediaQualidade,
  totalAnalisados,
  isSelected,
  onClick,
}: AgentScoreCardProps) {
  const teamColor = team === 'azul' ? 'border-l-warning' : 'border-l-accent-blue';

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full flex-col gap-2 rounded-card border border-glass-border bg-surface p-4 text-left transition-colors border-l-4 cursor-pointer',
        teamColor,
        isSelected
          ? 'ring-1 ring-primary bg-surface-secondary'
          : 'hover:bg-surface-secondary/50'
      )}
    >
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-muted" />
        <span className="font-heading text-heading-sm">{nome}</span>
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-body-sm text-muted">Qualidade</span>
          <ScoreStars score={mediaQualidade} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-body-sm text-muted">Sentimento</span>
          <ScoreStars score={mediaSentimento} />
        </div>
      </div>
      <span className="text-body-sm text-muted">
        {totalAnalisados} conversa{totalAnalisados !== 1 ? 's' : ''} analisada{totalAnalisados !== 1 ? 's' : ''}
      </span>
    </button>
  );
}
