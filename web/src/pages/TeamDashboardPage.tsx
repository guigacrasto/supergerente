import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useLabel } from '@/hooks/useLabels';
import {
  TrendingUp,
  Users,
  Target,
  AlertTriangle,
  BarChart3,
  ArrowLeft,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { api } from '@/lib/api';
import { stripFunilPrefix } from '@/lib/utils';
import { TEAM_LABELS } from '@/lib/constants';
import { Card, CardHeader, CardTitle, Chip, Skeleton, Badge } from '@/components/ui';
import { KPICard } from '@/components/features/dashboard/KPICard';
import { SalesRanking } from '@/components/features/dashboard/SalesRanking';

interface SummaryItem {
  nome: string;
  team: string;
  novosHoje: number;
  novosMes: number;
  ativos: number;
}

interface ActivityTeam {
  team: string;
  label: string;
  activity: {
    leadsAbandonados48h: Array<{
      id: number;
      nome: string;
      vendedor: string;
      diasSemAtividade: number;
      kommoUrl: string;
    }>;
    leadsEmRisco7d: Array<{
      id: number;
      nome: string;
      vendedor: string;
      diasSemAtividade: number;
      kommoUrl: string;
    }>;
    tarefasVencidas: Array<{
      id: number;
      texto: string;
      vendedor: string;
      leadId: number;
      leadNome: string;
      diasVencida: number;
      kommoUrl: string;
    }>;
  };
}

interface DashboardAgent {
  nome: string;
  total: number;
  ganhos: number;
  ganhosHoje: number;
  ganhosSemana: number;
  ativos: number;
}

interface DashboardData {
  agentsByTeam: Record<string, DashboardAgent[]>;
}

const TEAM_COLORS: Record<string, string> = {
  azul: '#F9AA3C',
  amarela: '#1F74EC',
};

const PIPELINE_COLORS = [
  '#9566F2', '#1F74EC', '#F9AA3C', '#10B981', '#EF4444',
  '#8B5CF6', '#3B82F6', '#F59E0B', '#06B6D4', '#EC4899',
];

const REFRESH_INTERVAL_MS = 2 * 60 * 1000;

export function TeamDashboardPage() {
  const { team } = useParams<{ team: string }>();
  const navigate = useNavigate();
  const vendasLabel = useLabel('vendas');
  const [searchParams] = useSearchParams();
  const initialPipeline = searchParams.get('pipeline') ?? '';
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [activity, setActivity] = useState<ActivityTeam[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPipeline, setSelectedPipeline] = useState<string>(initialPipeline);

  const teamColor = TEAM_COLORS[team ?? ''] ?? '#9566F2';
  const teamLabel = TEAM_LABELS[team ?? ''] ?? team;

  const fetchData = useCallback(async (isBackground = false) => {
    try {
      if (!isBackground) setLoading(true);
      const [summaryRes, activityRes, dashboardRes] = await Promise.all([
        api.get<SummaryItem[]>('/reports/summary'),
        api.get<ActivityTeam[]>('/reports/activity'),
        api.get<DashboardData>('/reports/dashboard'),
      ]);
      setSummary(summaryRes.data);
      setActivity(activityRes.data);
      setDashboard(dashboardRes.data);
    } catch (err) {
      console.error('[TeamDashboard] Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Filter data for this team only
  const teamSummary = summary.filter((s) => s.team === team);
  const teamActivity = activity.find((a) => a.team === team);
  const teamAgents = dashboard?.agentsByTeam?.[team ?? ''] ?? [];

  // Pipeline names for tabs
  const pipelineNames = teamSummary.map((s) => stripFunilPrefix(s.nome));

  // Filtered data (selected pipeline or all)
  const filteredSummary = selectedPipeline
    ? teamSummary.filter((s) => stripFunilPrefix(s.nome) === selectedPipeline)
    : teamSummary;

  // KPIs
  const totalNovosHoje = filteredSummary.reduce((sum, s) => sum + s.novosHoje, 0);
  const totalAtivos = filteredSummary.reduce((sum, s) => sum + s.ativos, 0);
  const totalNovosMes = filteredSummary.reduce((sum, s) => sum + s.novosMes, 0);
  const totalAlertas = teamActivity
    ? teamActivity.activity.leadsAbandonados48h.length +
      teamActivity.activity.leadsEmRisco7d.length +
      teamActivity.activity.tarefasVencidas.length
    : 0;

  // Agent rankings
  const rankingHoje = teamAgents.map((a) => ({
    nome: a.nome,
    vendas: a.ganhosHoje,
  }));
  const rankingSemana = teamAgents.map((a) => ({
    nome: a.nome,
    vendas: a.ganhosSemana,
  }));

  // Pipeline comparison data (for TODOS view)
  const pipelineComparisonData = teamSummary.map((s, i) => ({
    name: stripFunilPrefix(s.nome),
    novosHoje: s.novosHoje,
    novosMes: s.novosMes,
    ativos: s.ativos,
    color: PIPELINE_COLORS[i % PIPELINE_COLORS.length],
  }));

  // Pie chart data for leads distribution
  const pieData = teamSummary
    .filter((s) => s.ativos > 0)
    .map((s, i) => ({
      name: stripFunilPrefix(s.nome),
      value: s.ativos,
      color: PIPELINE_COLORS[i % PIPELINE_COLORS.length],
    }));

  // Agent chart data
  const agentChartData = teamAgents
    .map((a) => ({ name: a.nome, value: a.total }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const agentTotal = agentChartData.reduce((sum, d) => sum + d.value, 0);
  const agentBarHeight = 40;
  const agentChartHeight = Math.max(agentChartData.length * agentBarHeight + 40, 120);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="flex items-center justify-center rounded-button p-2 text-muted hover:text-white hover:bg-surface-secondary transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="font-heading text-heading-lg" style={{ color: teamColor }}>
          {teamLabel}
        </h1>
      </div>

      {/* Pipeline tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <Chip
          active={selectedPipeline === ''}
          onClick={() => setSelectedPipeline('')}
        >
          Todos
        </Chip>
        {pipelineNames.map((name) => (
          <Chip
            key={name}
            active={selectedPipeline === name}
            onClick={() => setSelectedPipeline(name)}
          >
            {name}
          </Chip>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          label="Leads Novos Hoje"
          value={totalNovosHoje}
          icon={TrendingUp}
          accent="primary"
          loading={loading}
        />
        <KPICard
          label="Leads Ativos"
          value={totalAtivos}
          icon={Users}
          accent="info"
          loading={loading}
        />
        <KPICard
          label="Novos no Mês"
          value={totalNovosMes}
          icon={Target}
          accent="success"
          loading={loading}
        />
        <KPICard
          label="Alertas Ativos"
          value={totalAlertas}
          icon={AlertTriangle}
          accent={totalAlertas > 0 ? 'danger' : 'success'}
          loading={loading}
        />
      </div>

      {/* TODOS view — Pipeline Comparison */}
      {!selectedPipeline && !loading && pipelineComparisonData.length > 0 && (
        <>
          {/* Comparison: Leads por Pipeline */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Bar chart — leads ativos por pipeline */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" style={{ color: teamColor }} />
                  Leads Ativos por Marca
                </CardTitle>
              </CardHeader>
              <div className="px-5 py-4">
                <ResponsiveContainer width="100%" height={Math.max(pipelineComparisonData.length * 40 + 40, 200)}>
                  <BarChart
                    data={pipelineComparisonData}
                    layout="vertical"
                    margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fill: '#959CA6', fontSize: 12 }}
                      axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                      tick={{ fill: '#E0E3E9', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#22182D',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px',
                        color: '#E0E3E9',
                        fontSize: '0.875rem',
                      }}
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    />
                    <Bar dataKey="ativos" name="Ativos" radius={[0, 6, 6, 0]} barSize={24}>
                      {pipelineComparisonData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Pie chart — distribuicao de leads */}
            <Card>
              <CardHeader>
                <CardTitle>Distribuição de Leads Ativos</CardTitle>
              </CardHeader>
              <div className="px-5 py-4 flex items-center justify-center">
                {pieData.length === 0 ? (
                  <p className="text-body-md text-muted py-8">Sem leads ativos.</p>
                ) : (
                  <div className="flex items-center gap-6 w-full">
                    <ResponsiveContainer width="50%" height={220}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          innerRadius={50}
                          paddingAngle={2}
                          strokeWidth={0}
                        >
                          {pieData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#22182D',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '8px',
                            color: '#E0E3E9',
                            fontSize: '0.875rem',
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-col gap-2">
                      {pieData.map((entry) => (
                        <div key={entry.name} className="flex items-center gap-2 text-body-sm">
                          <div
                            className="h-3 w-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: entry.color }}
                          />
                          <span className="text-muted truncate max-w-[140px]">{entry.name}</span>
                          <span className="font-heading font-semibold ml-auto">{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Pipeline comparison table */}
          <Card>
            <CardHeader>
              <CardTitle>Comparativo entre Marcas</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-body-sm">
                <thead>
                  <tr className="border-b border-glass-border">
                    <th className="text-left px-5 py-3 text-muted font-heading font-semibold">Marca</th>
                    <th className="text-right px-5 py-3 text-muted font-heading font-semibold">Novos Hoje</th>
                    <th className="text-right px-5 py-3 text-muted font-heading font-semibold">Novos no Mês</th>
                    <th className="text-right px-5 py-3 text-muted font-heading font-semibold">Ativos</th>
                    <th className="text-right px-5 py-3 text-muted font-heading font-semibold">% do Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pipelineComparisonData.map((p, i) => {
                    const pct = totalAtivos > 0 ? ((p.ativos / totalAtivos) * 100).toFixed(1) : '0.0';
                    return (
                      <tr
                        key={p.name}
                        className="border-b border-glass-border/50 hover:bg-surface-secondary/50 transition-colors cursor-pointer"
                        onClick={() => setSelectedPipeline(p.name)}
                      >
                        <td className="px-5 py-3 font-heading font-medium flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: PIPELINE_COLORS[i % PIPELINE_COLORS.length] }}
                          />
                          {p.name}
                        </td>
                        <td className="text-right px-5 py-3">
                          <span className="text-primary font-heading font-semibold">{p.novosHoje}</span>
                        </td>
                        <td className="text-right px-5 py-3 font-heading">{p.novosMes}</td>
                        <td className="text-right px-5 py-3 font-heading">{p.ativos}</td>
                        <td className="text-right px-5 py-3">
                          <Badge variant={Number(pct) > 20 ? 'success' : 'default'}>{pct}%</Badge>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Total row */}
                  <tr className="bg-surface-secondary/30 font-heading font-semibold">
                    <td className="px-5 py-3">Total</td>
                    <td className="text-right px-5 py-3 text-primary">{totalNovosHoje}</td>
                    <td className="text-right px-5 py-3">{totalNovosMes}</td>
                    <td className="text-right px-5 py-3">{totalAtivos}</td>
                    <td className="text-right px-5 py-3">
                      <Badge variant="success">100%</Badge>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Selected pipeline detail */}
      {selectedPipeline && !loading && (
        <Card>
          <CardHeader>
            <CardTitle>{selectedPipeline}</CardTitle>
          </CardHeader>
          <div className="p-5">
            {filteredSummary.length === 0 ? (
              <p className="text-body-md text-muted text-center py-8">
                Nenhum dado encontrado para este funil.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="flex flex-col gap-1 rounded-card border border-glass-border bg-surface-secondary p-4">
                  <span className="text-heading-lg font-heading text-primary">{filteredSummary[0].novosHoje}</span>
                  <span className="text-body-sm text-muted">Novos Hoje</span>
                </div>
                <div className="flex flex-col gap-1 rounded-card border border-glass-border bg-surface-secondary p-4">
                  <span className="text-heading-lg font-heading">{filteredSummary[0].novosMes}</span>
                  <span className="text-body-sm text-muted">Novos no Mês</span>
                </div>
                <div className="flex flex-col gap-1 rounded-card border border-glass-border bg-surface-secondary p-4">
                  <span className="text-heading-lg font-heading text-accent-blue">{filteredSummary[0].ativos}</span>
                  <span className="text-body-sm text-muted">Ativos</span>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Agent performance chart */}
      {!loading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" style={{ color: teamColor }} />
              Agentes — Atendimentos
            </CardTitle>
          </CardHeader>
          <div className="px-5 py-4">
            {agentTotal === 0 ? (
              <p className="text-center text-body-md text-muted py-8">
                Sem dados de atendimentos.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={agentChartHeight}>
                <BarChart
                  data={agentChartData}
                  layout="vertical"
                  margin={{ top: 0, right: 30, left: 0, bottom: 0 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fill: '#959CA6', fontSize: 12 }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    tick={{ fill: '#E0E3E9', fontSize: 13 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#22182D',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '8px',
                      color: '#E0E3E9',
                      fontSize: '0.875rem',
                    }}
                    formatter={(value: number | undefined) => [
                      `${value ?? 0} leads`,
                      'Total',
                    ]}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
                    {agentChartData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={teamColor}
                        fillOpacity={1 - index * 0.04}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      )}

      {/* Top Sales */}
      {!loading && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SalesRanking title={`Top ${vendasLabel} — Hoje`} data={rankingHoje} />
          <SalesRanking title={`Top ${vendasLabel} — Semana`} data={rankingSemana} />
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <Skeleton className="h-5 w-40 mb-4" />
              <Skeleton className="h-48 w-full" />
            </Card>
            <Card className="p-6">
              <Skeleton className="h-5 w-40 mb-4" />
              <Skeleton className="h-48 w-full" />
            </Card>
          </div>
          <Card className="p-6">
            <Skeleton className="h-5 w-32 mb-4" />
            <Skeleton className="h-48 w-full" />
          </Card>
        </>
      )}
    </div>
  );
}
