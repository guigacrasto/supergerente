import { useAuthStore } from '@/stores/authStore';

const DEFAULTS: Record<string, string> = {
  vendas: 'Vendas',
};

export function useLabel(key: string): string {
  const tenant = useAuthStore((s) => s.user?.tenant);
  return tenant?.customLabels?.[key] || DEFAULTS[key] || key;
}
