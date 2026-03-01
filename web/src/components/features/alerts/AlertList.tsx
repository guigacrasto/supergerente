import { AlertTriangle, Clock, XCircle, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui';
import { AlertCard } from './AlertCard';
import type { LucideIcon } from 'lucide-react';

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

interface AlertListProps {
  alerts48h: RawAlertLead[];
  alerts7d: RawAlertLead[];
  tarefas: RawAlertTask[];
}

interface SectionConfig {
  title: string;
  icon: LucideIcon;
  severity: 'danger' | 'warning' | 'orange';
  borderColor: string;
}

const sections: SectionConfig[] = [
  {
    title: 'Leads sem atividade +48h',
    icon: AlertTriangle,
    severity: 'danger',
    borderColor: 'border-l-danger',
  },
  {
    title: 'Leads em risco +7 dias',
    icon: Clock,
    severity: 'warning',
    borderColor: 'border-l-warning',
  },
  {
    title: 'Tarefas vencidas',
    icon: XCircle,
    severity: 'orange',
    borderColor: 'border-l-warning',
  },
];

export function AlertList({ alerts48h, alerts7d, tarefas }: AlertListProps) {
  const allEmpty =
    alerts48h.length === 0 && alerts7d.length === 0 && tarefas.length === 0;

  if (allEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="mb-4 rounded-card bg-success/10 p-4">
          <CheckCircle2 className="h-10 w-10 text-success" />
        </div>
        <h3 className="font-heading text-heading-sm mb-1">Tudo em dia!</h3>
        <p className="text-body-md text-muted">
          Nenhum alerta ativo no momento.
        </p>
      </div>
    );
  }

  const sectionData: {
    config: SectionConfig;
    items: Array<{
      key: string;
      leadName: string;
      vendedor: string;
      dias: number;
      kommoUrl: string;
    }>;
  }[] = [
    {
      config: sections[0],
      items: alerts48h.map((a) => ({
        key: `48h-${a.id}`,
        leadName: a.nome,
        vendedor: a.vendedor,
        dias: a.diasSemAtividade,
        kommoUrl: a.kommoUrl,
      })),
    },
    {
      config: sections[1],
      items: alerts7d.map((a) => ({
        key: `7d-${a.id}`,
        leadName: a.nome,
        vendedor: a.vendedor,
        dias: a.diasSemAtividade,
        kommoUrl: a.kommoUrl,
      })),
    },
    {
      config: sections[2],
      items: tarefas.map((t) => ({
        key: `task-${t.id}`,
        leadName: t.leadNome,
        vendedor: `${t.vendedor} \u00B7 ${t.texto}`,
        dias: t.diasVencida,
        kommoUrl: t.kommoUrl,
      })),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {sectionData
        .filter((s) => s.items.length > 0)
        .map(({ config, items }) => {
          const Icon = config.icon;

          return (
            <div
              key={config.severity}
              className={`rounded-card border border-glass-border bg-surface border-l-4 ${config.borderColor} light:bg-surface-light light:border-glass-border-light`}
            >
              <div className="flex items-center gap-2 border-b border-glass-border px-5 py-4 light:border-glass-border-light">
                <Icon className="h-5 w-5 text-muted" />
                <span className="font-heading text-heading-sm">
                  {config.title}
                </span>
                <Badge variant="default" className="ml-auto">
                  {items.length}
                </Badge>
              </div>
              <div className="flex flex-col gap-2 p-4">
                {items.map((item) => (
                  <AlertCard
                    key={item.key}
                    leadName={item.leadName}
                    vendedor={item.vendedor}
                    dias={item.dias}
                    kommoUrl={item.kommoUrl}
                    severity={config.severity}
                  />
                ))}
              </div>
            </div>
          );
        })}
    </div>
  );
}
