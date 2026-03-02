import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  PieChart,
  MessageSquare,
  BarChart3,
  AlertTriangle,
  Brain,
  LogOut,
  Settings,
  ChevronRight,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';
import { useSidebarStore } from '@/stores/sidebarStore';
import { usePipelines } from '@/hooks/usePipelines';
import { TEAM_LABELS, APP_SHORT_NAME, APP_NAME } from '@/lib/constants';
import { stripFunilPrefix } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: PieChart },
  { to: '/chat', label: 'Chat IA', icon: MessageSquare },
  { to: '/agents', label: 'Agentes', icon: BarChart3 },
  { to: '/alerts', label: 'Alertas', icon: AlertTriangle },
  { to: '/insights', label: 'Insights', icon: Brain },
] as const;

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const { collapsed, toggle } = useSidebarStore();
  const { byTeam } = usePipelines();
  const navigate = useNavigate();
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});

  const toggleTeam = (team: string) =>
    setExpandedTeams((prev) => ({ ...prev, [team]: !prev[team] }));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside
      className={cn(
        'flex h-screen flex-col bg-sidebar text-white transition-[width] duration-200 ease-out',
        collapsed ? 'w-[68px]' : 'w-[260px]'
      )}
    >
      {/* Logo */}
      <div className={cn('flex items-center px-5 py-5', collapsed ? 'justify-center' : 'gap-3')}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-button bg-gradient-to-br from-primary to-accent-blue font-heading text-heading-sm text-white">
          {APP_SHORT_NAME}
        </div>
        {!collapsed && (
          <span className="font-heading text-heading-sm text-white truncate">
            {APP_NAME}
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === '/'}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center rounded-button px-3 py-2.5 text-body-md font-medium transition-colors duration-150',
                    collapsed ? 'justify-center' : 'gap-3',
                    isActive
                      ? 'border-l-2 border-primary bg-primary/20 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  )
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Team accordion sections — hidden when collapsed */}
        {!collapsed && (
          <div className="mt-6 space-y-2">
            {(['azul', 'amarela'] as const).map((team) => {
              const teamPipelines = byTeam(team);
              if (teamPipelines.length === 0) return null;
              const expanded = !!expandedTeams[team];

              return (
                <div key={team}>
                  <button
                    onClick={() => toggleTeam(team)}
                    className="flex w-full items-center gap-2 rounded-button px-3 py-2 text-body-sm font-heading font-semibold uppercase tracking-wider text-white/50 hover:text-white/80 transition-colors cursor-pointer"
                  >
                    {expanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    {TEAM_LABELS[team] || team}
                  </button>
                  {expanded && (
                    <ul className="ml-4 space-y-0.5">
                      {teamPipelines.map((p) => (
                        <li key={p.id}>
                          <span className="block rounded-button px-3 py-1.5 text-body-sm text-white/60">
                            {stripFunilPrefix(p.name)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 px-3 py-3 space-y-1">
        {/* Collapse toggle */}
        <button
          onClick={toggle}
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className={cn(
            'flex w-full items-center rounded-button px-3 py-2 text-body-md text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer',
            collapsed ? 'justify-center' : 'gap-3'
          )}
        >
          {collapsed ? (
            <ChevronsRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronsLeft className="h-5 w-5" />
              Recolher
            </>
          )}
        </button>

        {/* Admin link */}
        {user?.role === 'admin' && (
          <NavLink
            to="/admin"
            title={collapsed ? 'Admin' : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center rounded-button px-3 py-2 text-body-md transition-colors',
                collapsed ? 'justify-center' : 'gap-3',
                isActive
                  ? 'bg-primary/20 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )
            }
          >
            <Settings className="h-5 w-5 shrink-0" />
            {!collapsed && 'Admin'}
          </NavLink>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          title={collapsed ? 'Sair' : undefined}
          className={cn(
            'flex w-full items-center rounded-button px-3 py-2 text-body-md text-white/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer',
            collapsed ? 'justify-center' : 'gap-3'
          )}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && 'Sair'}
        </button>
      </div>
    </aside>
  );
}
