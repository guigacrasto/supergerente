import { useEffect, useState } from 'react';
import { Building2, Users, Shield, Activity, UserPlus } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { Skeleton, EmptyState } from '@/components/ui';
import { TenantTable } from '@/components/features/super/TenantTable';
import { TenantForm } from '@/components/features/super/TenantForm';
import { PendingUsersTable } from '@/components/features/super/PendingUsersTable';
import type { Tenant } from '@/types';

interface TenantWithCount extends Tenant {
  userCount?: number;
}

interface SuperStats {
  totalTenants: number;
  activeTenants: number;
  totalUsers: number;
  pendingUsers: number;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  loading,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  loading: boolean;
  color: string;
}) {
  return (
    <div className="rounded-card border border-glass-border bg-surface p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-button ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-body-sm text-muted">{label}</span>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-20" />
      ) : (
        <span className="font-heading text-heading-md text-foreground">{value}</span>
      )}
    </div>
  );
}

export function SuperAdminPage() {
  const user = useAuthStore((s) => s.user);
  const [stats, setStats] = useState<SuperStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantWithCount | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const isSuperAdmin = user?.role === 'superadmin';

  useEffect(() => {
    if (!isSuperAdmin) return;
    setLoadingStats(true);
    api.get<SuperStats>('/super/stats')
      .then((res) => setStats(res.data))
      .catch((err) => console.error('[SuperAdmin]', err))
      .finally(() => setLoadingStats(false));
  }, [isSuperAdmin, refreshKey]);

  const handleEdit = (tenant: TenantWithCount) => {
    setEditingTenant(tenant);
    setFormOpen(true);
  };

  const handleNew = () => {
    setEditingTenant(null);
    setFormOpen(true);
  };

  const handleSaved = () => {
    setFormOpen(false);
    setEditingTenant(null);
    setRefreshKey((k) => k + 1);
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <EmptyState
          icon={Shield}
          title="Acesso restrito a super-admins"
          description="Você não tem permissão para acessar esta página."
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-heading text-heading-md">Super Admin</h1>
        <p className="mt-1 text-body-md text-muted">
          Gerencie tenants, usuários e configurações globais.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Building2}
          label="Total Tenants"
          value={stats?.totalTenants ?? 0}
          loading={loadingStats}
          color="bg-primary/10 text-primary"
        />
        <KpiCard
          icon={Activity}
          label="Tenants Ativos"
          value={stats?.activeTenants ?? 0}
          loading={loadingStats}
          color="bg-success/10 text-success"
        />
        <KpiCard
          icon={Users}
          label="Total Usuários"
          value={stats?.totalUsers ?? 0}
          loading={loadingStats}
          color="bg-info/10 text-info"
        />
        <KpiCard
          icon={UserPlus}
          label="Pendentes"
          value={stats?.pendingUsers ?? 0}
          loading={loadingStats}
          color="bg-warning/10 text-warning"
        />
      </div>

      {/* Pending Users */}
      <PendingUsersTable onAssigned={() => setRefreshKey((k) => k + 1)} />

      {/* Tenant Table */}
      <TenantTable
        key={refreshKey}
        onEdit={handleEdit}
        onNew={handleNew}
      />

      {/* Tenant Form Modal */}
      {formOpen && (
        <TenantForm
          tenant={editingTenant}
          onClose={() => { setFormOpen(false); setEditingTenant(null); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
