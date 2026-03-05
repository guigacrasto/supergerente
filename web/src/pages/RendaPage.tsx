import { useEffect, useState, useCallback } from 'react';
import { CalendarDays } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Chip, Skeleton } from '@/components/ui';

interface IncomeRow {
  faixa: string;
  volume: number;
  fechamentos: number;
  conversao: string;
  ticketMedio: number;
}

interface IncomeData {
  faixas: IncomeRow[];
}

type TeamFilter = '' | 'azul' | 'amarela';

function getDefaultFrom(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RendaPage() {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<IncomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(getDefaultFrom);
  const [to, setTo] = useState(getToday);
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('');

  const userTeams = user?.teams ?? [];
  const hasMultipleTeams = userTeams.length > 1;

  const fetchData = useCallback(async (fromDate: string, toDate: string) => {
    try {
      setLoading(true);
      const res = await api.get<IncomeData>('/reports/income', {
        params: { from: fromDate, to: toDate },
      });
      setData(res.data);
    } catch (err) {
      console.error('[RendaPage] Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(from, to);
  }, [from, to, fetchData]);

  const faixas = data?.faixas ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Date range + Team filter */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-button border border-glass-border bg-surface-secondary px-3 py-2 text-body-md text-foreground focus:outline-none focus:border-primary transition-colors"
          />
          <span className="text-muted text-body-sm">at&eacute;</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-button border border-glass-border bg-surface-secondary px-3 py-2 text-body-md text-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        {hasMultipleTeams && (
          <div className="flex items-center gap-2">
            <Chip active={teamFilter === ''} onClick={() => setTeamFilter('')}>
              Todas
            </Chip>
            {userTeams.includes('azul') && (
              <Chip active={teamFilter === 'azul'} onClick={() => setTeamFilter('azul')}>
                Azul
              </Chip>
            )}
            {userTeams.includes('amarela') && (
              <Chip active={teamFilter === 'amarela'} onClick={() => setTeamFilter('amarela')}>
                Amarela
              </Chip>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-card border border-glass-border bg-surface">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-secondary text-muted text-body-sm">
              <th className="px-4 py-3 text-left font-medium">Faixa</th>
              <th className="px-4 py-3 text-right font-medium">Volume</th>
              <th className="px-4 py-3 text-right font-medium">Fechamentos</th>
              <th className="px-4 py-3 text-right font-medium">Convers&atilde;o %</th>
              <th className="px-4 py-3 text-right font-medium">Ticket M&eacute;dio</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  <td className="border-t border-glass-border px-4 py-3">
                    <Skeleton className="h-5 w-32" />
                  </td>
                  <td className="border-t border-glass-border px-4 py-3 text-right">
                    <Skeleton className="ml-auto h-5 w-12" />
                  </td>
                  <td className="border-t border-glass-border px-4 py-3 text-right">
                    <Skeleton className="ml-auto h-5 w-12" />
                  </td>
                  <td className="border-t border-glass-border px-4 py-3 text-right">
                    <Skeleton className="ml-auto h-5 w-16" />
                  </td>
                  <td className="border-t border-glass-border px-4 py-3 text-right">
                    <Skeleton className="ml-auto h-5 w-20" />
                  </td>
                </tr>
              ))
            ) : faixas.length === 0 ? (
              <tr>
                <td colSpan={5} className="border-t border-glass-border px-4 py-8 text-center text-muted text-body-md">
                  Nenhum dado encontrado no per&iacute;odo selecionado.
                </td>
              </tr>
            ) : (
              faixas.map((faixa) => (
                <tr key={faixa.faixa} className="hover:bg-surface-secondary/50 transition-colors">
                  <td className="border-t border-glass-border px-4 py-3 text-body-md text-foreground font-medium">
                    {faixa.faixa}
                  </td>
                  <td className="border-t border-glass-border px-4 py-3 text-right text-body-md text-foreground">
                    {faixa.volume}
                  </td>
                  <td className="border-t border-glass-border px-4 py-3 text-right text-body-md text-foreground">
                    {faixa.fechamentos}
                  </td>
                  <td className="border-t border-glass-border px-4 py-3 text-right text-body-md text-foreground">
                    {faixa.conversao}
                  </td>
                  <td className="border-t border-glass-border px-4 py-3 text-right text-body-md text-foreground">
                    R$ {faixa.ticketMedio.toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
