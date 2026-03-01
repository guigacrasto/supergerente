import { useAuthStore } from '@/stores/authStore';

export function TopBar() {
  const user = useAuthStore((s) => s.user);
  const initial = user?.name?.charAt(0).toUpperCase() || '?';

  return (
    <header className="flex h-14 items-center justify-between border-b border-glass-border bg-surface px-6 light:bg-surface-light light:border-glass-border-light">
      <span className="text-body-md text-muted">
        Ola, <span className="font-heading font-semibold text-[#E0E3E9] light:text-[#23272C]">{user?.name || 'Usuario'}</span>
      </span>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent-blue font-heading text-body-md font-semibold text-white">
        {initial}
      </div>
    </header>
  );
}
