import { useEffect, useState } from 'react';
import { UserPlus, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { Badge, Button, Skeleton } from '@/components/ui';
import type { Tenant } from '@/types';

interface PendingUser {
  id: string;
  name: string;
  email: string;
  status: string;
  created_at: string;
}

interface PendingUsersTableProps {
  onAssigned?: () => void;
}

export function PendingUsersTable({ onAssigned }: PendingUsersTableProps) {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTenants, setSelectedTenants] = useState<Record<string, string>>({});
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<{ users: PendingUser[] }>('/super/pending-users'),
      api.get<{ tenants: Tenant[] }>('/super/tenants'),
    ])
      .then(([usersRes, tenantsRes]) => {
        setUsers(usersRes.data.users);
        setTenants(tenantsRes.data.tenants.filter((t) => t.isActive));
      })
      .catch((err) => console.error('[PendingUsers]', err))
      .finally(() => setLoading(false));
  }, []);

  const handleAssign = async (userId: string) => {
    const tenantId = selectedTenants[userId];
    if (!tenantId) return;

    setAssigning(userId);
    try {
      await api.patch(`/super/users/${userId}/assign-tenant`, { tenantId });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      onAssigned?.();
    } catch (err) {
      console.error('[PendingUsers] Erro ao atribuir:', err);
    } finally {
      setAssigning(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
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
      <div className="flex items-center gap-2">
        <UserPlus className="h-5 w-5 text-warning" />
        <h2 className="font-heading text-heading-sm">Usuarios Pendentes</h2>
        {users.length > 0 && (
          <Badge className="bg-warning/10 text-warning border-warning/20">
            {users.length}
          </Badge>
        )}
      </div>

      {users.length === 0 ? (
        <div className="rounded-card border border-glass-border bg-surface-secondary/30 px-4 py-8 text-center text-muted">
          Nenhum usuario pendente de atribuicao.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-glass-border">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="border-b border-glass-border bg-surface-secondary/50">
                <th className="px-4 py-3 text-left font-medium text-muted">Nome</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Email</th>
                <th className="px-4 py-3 text-center font-medium text-muted">Status</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Registro</th>
                <th className="px-4 py-3 text-left font-medium text-muted">Tenant</th>
                <th className="px-4 py-3 text-right font-medium text-muted">Acao</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-glass-border last:border-0 hover:bg-surface-secondary/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-foreground">{u.name}</td>
                  <td className="px-4 py-3 text-muted">{u.email}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge className="bg-warning/10 text-warning border-warning/20">
                      {u.status || 'pending'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {u.created_at
                      ? new Date(u.created_at).toLocaleDateString('pt-BR')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={selectedTenants[u.id] || ''}
                      onChange={(e) =>
                        setSelectedTenants((prev) => ({ ...prev, [u.id]: e.target.value }))
                      }
                      className="h-9 w-full min-w-[160px] appearance-none rounded-input border border-glass-border bg-surface-secondary/60 px-2.5 text-body-sm text-[#E0E3E9] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200"
                    >
                      <option value="">Selecionar...</option>
                      {tenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      onClick={() => handleAssign(u.id)}
                      disabled={!selectedTenants[u.id] || assigning === u.id}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      {assigning === u.id ? 'Atribuindo...' : 'Atribuir'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
