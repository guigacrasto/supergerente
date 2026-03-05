import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { api } from '@/lib/api';
import { useFilterStore } from '@/stores/filterStore';
import { usePipelines } from '@/hooks/usePipelines';
import { Card, Skeleton, EmptyState } from '@/components/ui';
import { AgentFilters } from '@/components/features/agents/AgentFilters';
import { AgentTable } from '@/components/features/agents/AgentTable';

const FIXED_COLS = ['Agente', 'Total Leads', 'Venda Ganha', 'Venda Perdida', 'Conversão %'];

type AgentRow = Record<string, string | number | undefined>;

function AgentsLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-heading-lg">Relatorio de Performance</h1>
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 min-w-[160px]">
              <Skeleton className="h-4 w-16 mb-2" />
              <Skeleton className="h-10 w-full rounded-button" />
            </div>
          ))}
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-24 rounded-button" />
            <Skeleton className="h-10 w-24 rounded-button" />
          </div>
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="p-4 space-y-3">
          <Skeleton className="h-10 w-full" />
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </Card>
    </div>
  );
}

export function AgentsPage() {
  const [data, setData] = useState<AgentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const filterAgente = useFilterStore((s) => s.filterAgente);
  const filterFunil = useFilterStore((s) => s.filterFunil);
  const filterEquipe = useFilterStore((s) => s.filterEquipe);
  const sortCol = useFilterStore((s) => s.sortCol);
  const sortDir = useFilterStore((s) => s.sortDir);

  const { pipelines } = usePipelines();

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const res = await api.get<AgentRow[]>('/reports/agents');
        if (!cancelled) {
          setData(res.data);
        }
      } catch (err) {
        console.error('[AgentsPage] Erro ao carregar dados:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <AgentsLoadingSkeleton />;
  }

  // Extract funnel columns (everything not in FIXED_COLS)
  const funnelCols: string[] =
    data.length > 0
      ? Object.keys(data[0]).filter((k) => !FIXED_COLS.includes(k))
      : [];

  // Extract unique agent names for filter options
  const agentOptions: string[] = [
    ...new Set<string>(data.map((r) => String(r.Agente ?? ''))),
  ]
    .filter(Boolean)
    .sort();

  // Build funnel-to-team mapping from pipelines
  const funilToTeam = new Map<string, string>(
    pipelines.map((p) => [p.name.replace(/^FUNIL\s+/i, '').trim(), p.team])
  );

  // Client-side filtering
  const filteredRows = data.filter((row) => {
    if (filterAgente && row.Agente !== filterAgente) return false;
    if (filterFunil && !row[filterFunil]) return false;
    if (filterEquipe) {
      const teamFunils = funnelCols.filter(
        (col) => funilToTeam.get(col) === filterEquipe
      );
      if (teamFunils.length > 0 && !teamFunils.some((col) => row[col])) {
        return false;
      }
    }
    return true;
  });

  // Client-side sorting
  const sortedRows =
    sortCol && filteredRows.length > 0
      ? [...filteredRows].sort((a, b) => {
          const parse = (v: string | number | undefined) => {
            const s = String(v ?? '')
              .replace(/\s*\(.*?\)/g, '')
              .replace('%', '')
              .trim();
            const n = parseFloat(s);
            return isNaN(n) ? s.toLowerCase() : n;
          };
          const an = parse(a[sortCol]);
          const bn = parse(b[sortCol]);
          if (an < bn) return sortDir === 'asc' ? -1 : 1;
          if (an > bn) return sortDir === 'asc' ? 1 : -1;
          return 0;
        })
      : filteredRows;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-heading-lg">Relatorio de Performance</h1>

      <AgentFilters
        agentOptions={agentOptions}
        funnelOptions={funnelCols}
        onFilter={() => {
          /* Filters are reactive via store */
        }}
      />

      {sortedRows.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Nenhum dado encontrado"
          description="Ajuste os filtros ou aguarde os dados serem carregados."
        />
      ) : (
        <AgentTable rows={sortedRows} funnelCols={funnelCols} />
      )}
    </div>
  );
}
