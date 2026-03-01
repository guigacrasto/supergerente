export const TEAMS = ['azul', 'amarela'] as const;

export const TEAM_LABELS: Record<string, string> = {
  azul: 'Equipe Azul',
  amarela: 'Equipe Amarela',
};

export const ALERT_TYPE_LABELS: Record<string, string> = {
  todos: 'Todos',
  risco48h: '+48h',
  risco7d: '+7 dias',
  tarefas: 'Tarefas',
};

export const STORAGE_KEYS = {
  token: 'kommo_token',
  user: 'kommo_user',
  theme: 'ak_theme',
} as const;
