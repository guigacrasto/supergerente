import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useChatStore } from '@/stores/chatStore';
import type { Pipeline, Mentor } from '@/types';

export function usePipelines() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setMentors = useChatStore((s) => s.setMentors);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;

    let cancelled = false;
    setLoading(true);

    const fetchAll = async () => {
      try {
        const [pipRes, mentorRes] = await Promise.all([
          api.get<Pipeline[]>('/pipelines'),
          api.get<Mentor[]>('/chat/mentors'),
        ]);
        if (!cancelled) {
          setPipelines(pipRes.data);
          setMentors(mentorRes.data);
        }
      } catch (err) {
        console.error('[usePipelines] Erro ao carregar dados:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, setMentors]);

  const byTeam = useCallback(
    (team: string) => pipelines.filter((p) => p.team === team),
    [pipelines]
  );

  return { pipelines, byTeam, loading } as const;
}
