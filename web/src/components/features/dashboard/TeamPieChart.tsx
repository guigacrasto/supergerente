import { useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardHeader, CardTitle, Chip } from '@/components/ui';
import { stripFunilPrefix } from '@/lib/utils';

interface SummaryItem {
  nome: string;
  team: string;
  novosHoje: number;
  novosMes: number;
  ativos: number;
}

interface TeamPieChartProps {
  data: SummaryItem[];
}

const TEAM_COLORS: Record<string, string> = {
  azul: '#1F74EC',
  amarela: '#F9AA3C',
};

const TEAM_NAMES: Record<string, string> = {
  azul: 'Equipe Azul',
  amarela: 'Equipe Amarela',
};

type TeamFilter = 'todas' | 'azul' | 'amarela';

const RADIAN = Math.PI / 180;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderCustomLabel(props: any) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  if (percent < 0.05) return null;

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={13}
      fontWeight={600}
    >
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export function TeamPieChart({ data }: TeamPieChartProps) {
  const [teamFilter, setTeamFilter] = useState<TeamFilter>('todas');

  // Agrupar por equipe
  const teamTotals = data.reduce<Record<string, number>>((acc, item) => {
    const team = item.team;
    acc[team] = (acc[team] || 0) + item.ativos;
    return acc;
  }, {});

  // Dados para o grafico
  const isFiltered = teamFilter !== 'todas';

  const chartData = isFiltered
    ? data
        .filter((item) => item.team === teamFilter)
        .map((item) => ({
          name: stripFunilPrefix(item.nome),
          value: item.ativos,
        }))
        .filter((d) => d.value > 0)
    : Object.entries(teamTotals)
        .map(([team, value]) => ({
          name: TEAM_NAMES[team] || team,
          value,
          team,
        }))
        .filter((d) => d.value > 0);

  const colors = isFiltered
    ? chartData.map((_, i) => {
        const base = TEAM_COLORS[teamFilter] || '#9566F2';
        const opacity = 1 - i * 0.15;
        return adjustOpacity(base, Math.max(opacity, 0.4));
      })
    : chartData.map((d) => TEAM_COLORS[(d as { team?: string }).team || ''] || '#9566F2');

  const total = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atendimentos por Equipe</CardTitle>
      </CardHeader>

      <div className="px-5 pt-3 pb-1">
        <div className="flex flex-wrap gap-2">
          <Chip
            active={teamFilter === 'todas'}
            onClick={() => setTeamFilter('todas')}
          >
            Todas
          </Chip>
          <Chip
            active={teamFilter === 'azul'}
            onClick={() => setTeamFilter('azul')}
          >
            Azul
          </Chip>
          <Chip
            active={teamFilter === 'amarela'}
            onClick={() => setTeamFilter('amarela')}
          >
            Amarela
          </Chip>
        </div>
      </div>

      <div className="px-5 py-4">
        {total === 0 ? (
          <p className="text-center text-body-md text-muted py-8">
            Sem dados de atendimentos.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
                labelLine={false}
                label={renderCustomLabel}
              >
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index]} />
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
                formatter={(value) => [`${value} ativos`]}
              />
              <Legend
                wrapperStyle={{ fontSize: '0.75rem', color: '#959CA6' }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

/** Aplica opacidade a uma cor hex */
function adjustOpacity(hex: string, opacity: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}
