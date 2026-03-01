import { Badge } from '@/components/ui';
import { useFilterStore } from '@/stores/filterStore';
import { cn } from '@/lib/utils';

const FIXED_COLS = ['Agente', 'Total Leads', 'Venda Ganha', 'Venda Perdida', 'Conversão %'];

interface AgentTableProps {
  rows: Record<string, string | number | undefined>[];
  funnelCols: string[];
}

function getConversionVariant(value: string | number | undefined): 'success' | 'warning' | 'danger' {
  const numStr = String(value ?? '0').replace('%', '').trim();
  const num = parseFloat(numStr);
  if (num >= 50) return 'success';
  if (num >= 30) return 'warning';
  return 'danger';
}

export function AgentTable({ rows, funnelCols }: AgentTableProps) {
  const sortCol = useFilterStore((s) => s.sortCol);
  const sortDir = useFilterStore((s) => s.sortDir);
  const setSort = useFilterStore((s) => s.setSort);

  const allCols = [...FIXED_COLS, ...funnelCols];

  return (
    <div className="rounded-card border border-glass-border bg-surface overflow-hidden">
      <div className="overflow-x-auto max-h-[70vh]">
        <table className="w-full border-collapse text-body-md">
          <thead>
            <tr>
              {allCols.map((col) => (
                <th
                  key={col}
                  onClick={() => setSort(col)}
                  className={cn(
                    'sticky top-0 z-10 cursor-pointer select-none whitespace-nowrap border-b border-glass-border bg-surface-secondary px-4 py-3 text-left font-heading text-body-sm font-semibold text-muted-light transition-colors hover:text-[#E0E3E9]',
                    sortCol === col && 'text-primary'
                  )}
                >
                  {col}
                  {sortCol === col && (
                    <span className="ml-1 text-primary">
                      {sortDir === 'desc' ? ' \u2193' : ' \u2191'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="border-b border-glass-border transition-colors hover:bg-surface-secondary/50"
              >
                {allCols.map((col) => {
                  const value = row[col];

                  if (col === 'Conversão %') {
                    return (
                      <td key={col} className="px-4 py-3 whitespace-nowrap">
                        <Badge variant={getConversionVariant(value)}>
                          {value ?? '0%'}
                        </Badge>
                      </td>
                    );
                  }

                  if (col === 'Ticket Medio') {
                    return (
                      <td key={col} className="px-4 py-3 whitespace-nowrap text-primary font-heading font-medium">
                        {value ?? '—'}
                      </td>
                    );
                  }

                  return (
                    <td
                      key={col}
                      className={cn(
                        'px-4 py-3 whitespace-nowrap',
                        col === 'Agente' && 'font-heading font-medium'
                      )}
                    >
                      {value ?? '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
