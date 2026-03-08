import { useEffect, useState } from 'react';
import { Building2, Pencil, Plus } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Skeleton } from '@/components/ui';
import type { Tenant } from '@/types';

interface TenantWithCount extends Tenant {
  userCount?: number;
}

interface TenantTableProps {
  onEdit: (tenant: TenantWithCount) => void;
  onNew: () => void;
}

export function TenantTable({ onEdit, onNew }: TenantTableProps) {
  const [tenants, setTenants] = useState<TenantWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ tenants: TenantWithCount[] }>('/super/tenants')
      .then((res) => setTenants(res.data.tenants))
      .catch((err) => console.error('[TenantTable]', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-card border border-glass-border bg-surface-secondary p-4">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-3 w-1/2 mt-2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-heading-sm">Tenants</h2>
        <Button onClick={onNew} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Novo Tenant
        </Button>
      </div>

      <div className="overflow-x-auto rounded-card border border-glass-border">
        <table className="w-full text-body-sm">
          <thead>
            <tr className="border-b border-glass-border bg-surface-secondary/50">
              <th className="px-4 py-3 text-left font-medium text-muted">Nome</th>
              <th className="px-4 py-3 text-left font-medium text-muted">Slug</th>
              <th className="px-4 py-3 text-center font-medium text-muted">Usuarios</th>
              <th className="px-4 py-3 text-center font-medium text-muted">Status</th>
              <th className="px-4 py-3 text-center font-medium text-muted">Cor</th>
              <th className="px-4 py-3 text-right font-medium text-muted">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => (
              <tr key={t.id} className="border-b border-glass-border last:border-0 hover:bg-surface-secondary/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted" />
                    <span className="font-medium text-foreground">{t.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted font-mono">{t.slug}</td>
                <td className="px-4 py-3 text-center">{t.userCount ?? 0}</td>
                <td className="px-4 py-3 text-center">
                  <Badge className={t.isActive ? 'bg-success/10 text-success border-success/20' : 'bg-danger/10 text-danger border-danger/20'}>
                    {t.isActive ? 'Ativo' : 'Inativo'}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-center">
                  <div
                    className="mx-auto h-5 w-5 rounded-full border border-glass-border"
                    style={{ backgroundColor: t.primaryColor || '#9566F2' }}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onEdit(t)}
                    className="inline-flex items-center gap-1 rounded-button px-2 py-1 text-body-sm text-muted hover:text-foreground hover:bg-surface-secondary transition-colors cursor-pointer"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </button>
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  Nenhum tenant cadastrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
