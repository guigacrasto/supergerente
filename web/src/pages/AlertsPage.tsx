import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useFilterStore } from '@/stores/filterStore';
import { PageSpinner } from '@/components/ui';
import { AlertFilters } from '@/components/features/alerts/AlertFilters';
import { AlertList } from '@/components/features/alerts/AlertList';

interface RawAlertLead {
  id: number;
  nome: string;
  vendedor: string;
  diasSemAtividade: number;
  kommoUrl: string;
}

interface RawAlertTask {
  id: number;
  texto: string;
  vendedor: string;
  leadId: number;
  leadNome: string;
  diasVencida: number;
  kommoUrl: string;
}

interface ActivityTeamData {
  team: string;
  label: string;
  activity: {
    leadsAbandonados48h: RawAlertLead[];
    leadsEmRisco7d: RawAlertLead[];
    tarefasVencidas: RawAlertTask[];
  };
}

export function AlertsPage() {
  const [data, setData] = useState<ActivityTeamData[]>([]);
  const [loading, setLoading] = useState(true);

  const alertFilter = useFilterStore((s) => s.alertFilter);
  const alertEquipeFilter = useFilterStore((s) => s.alertEquipeFilter);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const res = await api.get<ActivityTeamData[]>('/reports/activity');
        if (!cancelled) {
          setData(res.data);
        }
      } catch (err) {
        console.error('[AlertsPage] Erro ao carregar alertas:', err);
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
    return <PageSpinner />;
  }

  // Filter by team
  const filteredTeams = data.filter(
    (t) => alertEquipeFilter === 'todas' || t.team === alertEquipeFilter
  );

  // Aggregate alerts across teams
  const alerts48h =
    alertFilter === 'todos' || alertFilter === 'risco48h'
      ? filteredTeams.flatMap((t) => t.activity.leadsAbandonados48h)
      : [];

  const alerts7d =
    alertFilter === 'todos' || alertFilter === 'risco7d'
      ? filteredTeams.flatMap((t) => t.activity.leadsEmRisco7d)
      : [];

  const tarefas =
    alertFilter === 'todos' || alertFilter === 'tarefas'
      ? filteredTeams.flatMap((t) => t.activity.tarefasVencidas)
      : [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-heading-lg">Central de Alertas</h1>

      <AlertFilters />

      <AlertList alerts48h={alerts48h} alerts7d={alerts7d} tarefas={tarefas} />
    </div>
  );
}
