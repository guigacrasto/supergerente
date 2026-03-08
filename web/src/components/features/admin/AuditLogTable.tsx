import { useEffect, useState, useCallback } from 'react';
import { ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, Badge, Skeleton, EmptyState, Button } from '@/components/ui';

interface AuditLog {
  id: string;
  user_id: string;
  user_email: string | null;
  action: string;
  resource: string;
  method: string;
  details: Record<string, any>;
  ip: string;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  view_reports: 'Relatórios',
  view_pipelines: 'Pipelines',
  view_leads: 'Leads',
  chat_message: 'Chat IA',
  view_chat: 'Chat',
  view_insights: 'Insights',
  refresh_insights: 'Refresh Insights',
  admin_view: 'Admin',
  admin_action: 'Ação Admin',
  view_notifications: 'Notificações',
  view_predictions: 'Previsões',
};

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-info/10 text-info',
  POST: 'bg-success/10 text-success',
  PATCH: 'bg-warning/10 text-warning',
  DELETE: 'bg-danger/10 text-danger',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AuditLogTable() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get<{ logs: AuditLog[]; total: number }>(
        `/admin/audit-logs?page=${page}&limit=${limit}`
      );
      setLogs(res.data.logs);
      setTotal(res.data.total);
    } catch (err) {
      console.error('[AuditLog] Erro:', err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(total / limit);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-button bg-primary/10">
            <ClipboardList className="h-5 w-5 text-primary" />
          </div>
          <CardTitle>Log de Auditoria</CardTitle>
        </div>
        <Badge variant="accent">{total} registros</Badge>
      </CardHeader>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-surface-secondary text-muted text-body-sm">
              <th className="px-4 py-3 text-left font-medium">Data</th>
              <th className="px-4 py-3 text-left font-medium">Usuário</th>
              <th className="px-4 py-3 text-left font-medium">Ação</th>
              <th className="px-4 py-3 text-left font-medium">Método</th>
              <th className="px-4 py-3 text-left font-medium">Recurso</th>
              <th className="px-4 py-3 text-left font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j} className="border-t border-glass-border px-4 py-3">
                      <Skeleton className="h-4 w-20" />
                    </td>
                  ))}
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="border-t border-glass-border px-4 py-8 text-center">
                  <EmptyState
                    icon={ClipboardList}
                    title="Nenhum log encontrado"
                    description="Os logs de atividade aparecerão aqui."
                  />
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-surface-secondary/50 transition-colors">
                  <td className="border-t border-glass-border px-4 py-3 text-body-sm text-muted whitespace-nowrap">
                    {formatDate(log.created_at)}
                  </td>
                  <td className="border-t border-glass-border px-4 py-3 text-body-sm text-foreground">
                    {log.user_email || log.user_id?.substring(0, 8) || '—'}
                  </td>
                  <td className="border-t border-glass-border px-4 py-3">
                    <Badge variant="default">
                      {ACTION_LABELS[log.action] || log.action}
                    </Badge>
                  </td>
                  <td className="border-t border-glass-border px-4 py-3">
                    <span className={`inline-block rounded-badge px-2 py-0.5 text-[11px] font-semibold ${METHOD_COLORS[log.method] || 'bg-surface-secondary text-muted'}`}>
                      {log.method}
                    </span>
                  </td>
                  <td className="border-t border-glass-border px-4 py-3 text-body-sm text-muted font-mono">
                    {log.resource}
                  </td>
                  <td className="border-t border-glass-border px-4 py-3 text-body-sm text-muted">
                    {log.ip || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-glass-border px-4 py-3">
          <p className="text-body-sm text-muted">
            Página {page} de {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
