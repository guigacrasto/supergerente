import { useEffect, useState, useRef } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import type { Tenant } from '@/types';

interface TenantWithCount extends Tenant {
  userCount?: number;
}

export function TenantSwitcher() {
  const user = useAuthStore((s) => s.user);
  const activeTenantId = useAuthStore((s) => s.activeTenantId);
  const setActiveTenantId = useAuthStore((s) => s.setActiveTenantId);
  const [tenants, setTenants] = useState<TenantWithCount[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isSuperAdmin = user?.role === 'superadmin';

  const currentTenantId = activeTenantId || user?.tenantId;
  const currentTenant = tenants.find((t) => t.id === currentTenantId);

  useEffect(() => {
    if (!isSuperAdmin) return;
    api.get<{ tenants: TenantWithCount[] }>('/super/tenants').then((res) => {
      setTenants(res.data.tenants);
    }).catch(() => {});
  }, [isSuperAdmin]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!isSuperAdmin) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-button border border-glass-border bg-surface-secondary px-3 py-1.5 text-body-sm text-foreground hover:bg-surface-secondary/80 transition-colors cursor-pointer"
      >
        <Building2 className="h-4 w-4 text-primary" />
        <span className="max-w-[120px] truncate">{currentTenant?.name || 'Selecionar'}</span>
        <ChevronDown className={cn('h-3 w-3 text-muted transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 rounded-card border border-glass-border bg-surface p-1 shadow-lg">
          <div className="px-2 py-1.5 text-body-xs text-muted font-medium uppercase tracking-wider">
            Trocar Tenant
          </div>
          {tenants.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setActiveTenantId(t.id === user?.tenantId ? null : t.id);
                setOpen(false);
                window.location.reload();
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-button px-2 py-1.5 text-body-sm transition-colors cursor-pointer',
                t.id === currentTenantId
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground hover:bg-surface-secondary'
              )}
            >
              <div
                className="h-3 w-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: t.primaryColor || '#9566F2' }}
              />
              <span className="truncate flex-1 text-left">{t.name}</span>
              {t.id === currentTenantId && <Check className="h-3.5 w-3.5 flex-shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
