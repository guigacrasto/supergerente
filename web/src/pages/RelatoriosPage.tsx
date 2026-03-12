import { useState, useRef, useCallback, useEffect } from 'react';
import { FileDown, Loader2, CheckSquare, Square, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui';
import { TimeFilter } from '@/components/features/filters/TimeFilter';
import { GroupFilter } from '@/components/features/filters/GroupFilter';
import { exportMultipleElementsToPdf } from '@/lib/pdf-export';

interface Section {
  key: string;
  label: string;
  endpoint: string;
}

const SECTIONS: Section[] = [
  { key: 'dashboard', label: 'Dashboard', endpoint: '/reports/all' },
  { key: 'diario', label: 'Diário', endpoint: '/reports/daily' },
  { key: 'tmf', label: 'TMF', endpoint: '/reports/tmf' },
  { key: 'motivos', label: 'Motivos Perda', endpoint: '/reports/loss-reasons' },
  { key: 'renda', label: 'Renda', endpoint: '/reports/income' },
  { key: 'profissao', label: 'Profissão', endpoint: '/reports/profession' },
  { key: 'ddd', label: 'DDD', endpoint: '/reports/ddd' },
  { key: 'agentes', label: 'Agentes', endpoint: '/reports/agents' },
  { key: 'ranking', label: 'Ranking', endpoint: '/reports/ranking' },
  { key: 'alertas', label: 'Alertas', endpoint: '/reports/activity' },
];

interface SectionData {
  key: string;
  label: string;
  data: unknown;
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '-';
  if (typeof val === 'number') return val.toLocaleString('pt-BR');
  return String(val);
}

function SectionPreview({ section }: { section: SectionData }) {
  const data = section.data as Record<string, unknown>;

  // Render a summary table from the top-level data
  const entries = Object.entries(data).filter(
    ([, v]) => typeof v === 'string' || typeof v === 'number'
  );

  const arrayEntries = Object.entries(data).filter(
    ([, v]) => Array.isArray(v)
  );

  return (
    <div className="flex flex-col gap-4">
      {/* KPI summary */}
      {entries.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {entries.map(([key, val]) => (
            <div
              key={key}
              className="rounded-card border border-glass-border bg-surface-secondary/50 p-3"
            >
              <span className="text-body-sm text-muted block">{key}</span>
              <span className="font-heading text-heading-sm text-foreground">
                {formatValue(val)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Table previews */}
      {arrayEntries.map(([key, val]) => {
        const arr = val as Record<string, unknown>[];
        if (arr.length === 0) return null;
        const cols = Object.keys(arr[0]);
        const rows = arr.slice(0, 10);

        return (
          <div key={key} className="overflow-x-auto rounded-card border border-glass-border bg-surface">
            <div className="px-4 py-2 border-b border-glass-border bg-surface-secondary/30">
              <span className="text-body-sm text-muted font-medium">{key} ({arr.length} registros)</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="bg-surface-secondary text-muted text-body-sm">
                  {cols.map((col) => (
                    <th key={col} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="hover:bg-surface-secondary/50 transition-colors">
                    {cols.map((col) => (
                      <td key={col} className="border-t border-glass-border px-3 py-2 text-body-sm text-foreground whitespace-nowrap">
                        {formatValue(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
                {arr.length > 10 && (
                  <tr>
                    <td colSpan={cols.length} className="border-t border-glass-border px-3 py-2 text-center text-body-sm text-muted">
                      +{arr.length - 10} registros...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

export function RelatoriosPage() {
  const user = useAuthStore((s) => s.user);
  const [selected, setSelected] = useState<Set<string>>(new Set(['dashboard', 'ranking']));
  const [teamFilter, setTeamFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [grupos, setGrupos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [sectionData, setSectionData] = useState<SectionData[]>([]);

  const previewRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const userTeams = user?.teams ?? [];

  // Fetch grupos for filter
  useEffect(() => {
    api.get('/reports/all').then((res) => {
      const gruposByTeam = res.data.gruposByTeam as Record<string, string[]> | undefined;
      if (gruposByTeam) {
        setGrupos([...new Set(Object.values(gruposByTeam).flat())].sort());
      }
    }).catch(() => {});
  }, []);

  const toggleSection = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === SECTIONS.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(SECTIONS.map((s) => s.key)));
    }
  };

  const loadData = useCallback(async () => {
    if (selected.size === 0) return;
    setLoading(true);
    setSectionData([]);

    const results: SectionData[] = [];

    for (const section of SECTIONS) {
      if (!selected.has(section.key)) continue;

      try {
        const params: Record<string, string> = {};
        if (teamFilter) params.team = teamFilter;
        if (groupFilter) params.group = groupFilter;

        const res = await api.get(section.endpoint, { params });
        results.push({
          key: section.key,
          label: section.label,
          data: res.data,
        });
      } catch {
        results.push({
          key: section.key,
          label: section.label,
          data: { erro: 'Falha ao carregar dados' },
        });
      }
    }

    setSectionData(results);
    setLoading(false);
  }, [selected, teamFilter, groupFilter]);

  const handleExport = async () => {
    if (sectionData.length === 0) {
      await loadData();
      // Wait for render
      await new Promise((r) => setTimeout(r, 500));
    }

    setExporting(true);
    try {
      // Wait for DOM to render
      await new Promise((r) => setTimeout(r, 300));

      const elements: Array<{ element: HTMLElement; title: string }> = [];
      for (const section of sectionData.length > 0 ? sectionData : []) {
        const el = sectionRefs.current.get(section.key);
        if (el) {
          elements.push({ element: el, title: section.label });
        }
      }

      if (elements.length > 0) {
        const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
        await exportMultipleElementsToPdf(elements, `relatorio-${dateStr}`);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-heading-md flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          Relatórios
        </h1>
        <p className="mt-1 text-body-md text-muted">
          Gere relatórios PDF combinados com as seções desejadas
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <TimeFilter teams={userTeams} selected={teamFilter} onChange={(t) => { setTeamFilter(t); setGroupFilter(''); }} />
        <GroupFilter grupos={grupos} selected={groupFilter} onChange={setGroupFilter} />
      </div>

      {/* Section Selection */}
      <div className="rounded-card border border-glass-border bg-surface backdrop-blur-glass p-5">
        <div className="flex items-center justify-between mb-4">
          <span className="font-heading text-heading-sm">Selecione as seções</span>
          <button
            onClick={toggleAll}
            className="text-body-sm text-primary hover:text-primary-600 transition-colors cursor-pointer"
          >
            {selected.size === SECTIONS.length ? 'Desmarcar todas' : 'Selecionar todas'}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {SECTIONS.map((section) => {
            const isSelected = selected.has(section.key);
            return (
              <button
                key={section.key}
                onClick={() => toggleSection(section.key)}
                className={cn(
                  'flex items-center gap-2 rounded-button px-3 py-2.5 text-body-md font-medium transition-all duration-200 cursor-pointer border',
                  isSelected
                    ? 'border-primary/30 bg-primary/10 text-primary'
                    : 'border-glass-border bg-surface-secondary/40 text-muted hover:text-foreground hover:border-white/10'
                )}
              >
                {isSelected ? (
                  <CheckSquare className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <Square className="h-4 w-4 flex-shrink-0" />
                )}
                {section.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          onClick={loadData}
          disabled={selected.size === 0 || loading}
          loading={loading}
        >
          Carregar Preview
        </Button>
        <Button
          variant="primary"
          onClick={handleExport}
          disabled={selected.size === 0 || exporting}
          loading={exporting}
        >
          <FileDown className="h-4 w-4" />
          {exporting ? 'Gerando PDF...' : 'Gerar Relatório PDF'}
        </Button>
        {selected.size === 0 && (
          <span className="text-body-sm text-muted">Selecione pelo menos uma seção</span>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-3 text-body-md text-muted">Carregando dados...</span>
        </div>
      )}

      {/* Preview sections */}
      {sectionData.length > 0 && (
        <div ref={previewRef} className="flex flex-col gap-8">
          {sectionData.map((section) => (
            <div
              key={section.key}
              ref={(el) => {
                if (el) sectionRefs.current.set(section.key, el);
              }}
              className="rounded-card border border-glass-border bg-surface backdrop-blur-glass p-5"
            >
              <h2 className="font-heading text-heading-sm text-primary mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {section.label}
              </h2>
              <SectionPreview section={section} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
