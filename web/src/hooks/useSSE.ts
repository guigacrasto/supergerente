import { useEffect, useRef, useState } from 'react';
import { STORAGE_KEYS } from '@/lib/constants';

interface SSETeamData {
  team: string;
  geral: {
    total: number;
    ganhos: number;
    perdidos: number;
    ativos: number;
    conversao: string;
    novosHoje: number;
    novosSemana: number;
    novosMes: number;
  };
  atualizadoEm: string;
}

interface SSEPayload {
  teams: SSETeamData[];
}

export function useSSE() {
  const [data, setData] = useState<SSEPayload | null>(null);
  const [connected, setConnected] = useState(false);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEYS.token);
    if (!token) return;

    // EventSource doesn't support custom headers, so pass token as query param
    // The backend needs to handle this — for now, we'll use a workaround
    // Since our API is on the same origin, we can use fetch-based SSE instead

    let aborted = false;

    async function connect() {
      try {
        const response = await fetch('/api/reports/stream', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'text/event-stream',
          },
        });

        if (!response.ok || !response.body) return;

        setConnected(true);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!aborted) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const payload = JSON.parse(line.slice(6)) as SSEPayload;
                setData(payload);
              } catch {
                // ignore parse errors
              }
            }
          }
        }
      } catch {
        // connection lost
      } finally {
        setConnected(false);
        // Reconnect after 5s if not aborted
        if (!aborted) {
          setTimeout(connect, 5000);
        }
      }
    }

    connect();

    return () => {
      aborted = true;
      sourceRef.current?.close();
    };
  }, []);

  return { data, connected };
}
