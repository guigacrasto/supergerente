import { Filter, X } from 'lucide-react';
import { Card, Select, Button } from '@/components/ui';
import { useFilterStore } from '@/stores/filterStore';

interface AgentFiltersProps {
  agentOptions: string[];
  funnelOptions: string[];
  onFilter: () => void;
}

export function AgentFilters({
  agentOptions,
  funnelOptions,
  onFilter,
}: AgentFiltersProps) {
  const filterAgente = useFilterStore((s) => s.filterAgente);
  const filterFunil = useFilterStore((s) => s.filterFunil);
  const filterEquipe = useFilterStore((s) => s.filterEquipe);
  const setAgentFilter = useFilterStore((s) => s.setAgentFilter);
  const clearAgentFilters = useFilterStore((s) => s.clearAgentFilters);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[160px]">
          <Select
            label="Agente"
            value={filterAgente}
            onChange={(e) => setAgentFilter('filterAgente', e.target.value)}
            options={[
              { value: '', label: 'Todos' },
              ...agentOptions.map((a) => ({ value: a, label: a })),
            ]}
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <Select
            label="Funil"
            value={filterFunil}
            onChange={(e) => setAgentFilter('filterFunil', e.target.value)}
            options={[
              { value: '', label: 'Todos' },
              ...funnelOptions.map((f) => ({ value: f, label: f })),
            ]}
          />
        </div>
        <div className="flex-1 min-w-[160px]">
          <Select
            label="Equipe"
            value={filterEquipe}
            onChange={(e) => setAgentFilter('filterEquipe', e.target.value)}
            options={[
              { value: '', label: 'Todas' },
              { value: 'azul', label: 'Equipe Azul' },
              { value: 'amarela', label: 'Equipe Amarela' },
            ]}
          />
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={onFilter} size="md">
            <Filter className="h-4 w-4" />
            Filtrar
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={clearAgentFilters}
          >
            <X className="h-4 w-4" />
            Limpar
          </Button>
        </div>
      </div>
    </Card>
  );
}
