import { useEffect, useState } from 'react';
import { Brain } from 'lucide-react';
import { api } from '@/lib/api';
import { PageSpinner, EmptyState } from '@/components/ui';
import { AgentScoreCard } from '@/components/features/insights/AgentScoreCard';
import { ConversationCard } from '@/components/features/insights/ConversationCard';

interface ConversationInsight {
  leadId: number;
  leadNome: string;
  vendedor: string;
  sentimentScore: number;
  qualityScore: number;
  resumo: string;
  pontosPositivos: string[];
  pontosMelhoria: string[];
  analisadoEm: string;
}

interface AgentInsightSummary {
  nome: string;
  team: string;
  mediaSentimento: number;
  mediaQualidade: number;
  totalAnalisados: number;
  insights: ConversationInsight[];
}

export function InsightsPage() {
  const [data, setData] = useState<AgentInsightSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        const res = await api.get<AgentInsightSummary[]>('/insights/conversations');
        if (!cancelled) {
          setData(res.data);
          if (res.data.length > 0) {
            setSelectedAgent(res.data[0].nome);
          }
        }
      } catch (err) {
        console.error('[InsightsPage] Erro ao carregar dados:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <PageSpinner />;
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-heading text-heading-lg">Insights de Atendimento</h1>
        <EmptyState
          icon={Brain}
          title="Nenhuma analise disponivel"
          description="As conversas dos atendentes serao analisadas automaticamente. Aguarde a proxima atualizacao."
        />
      </div>
    );
  }

  const selected = data.find((a) => a.nome === selectedAgent);
  const conversations = selected?.insights ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-heading text-heading-lg">Insights de Atendimento</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        {/* Agent list */}
        <div className="flex flex-col gap-3">
          <h2 className="font-heading text-heading-sm text-muted">Agentes</h2>
          {data.map((agent) => (
            <AgentScoreCard
              key={agent.nome}
              nome={agent.nome}
              team={agent.team}
              mediaSentimento={agent.mediaSentimento}
              mediaQualidade={agent.mediaQualidade}
              totalAnalisados={agent.totalAnalisados}
              isSelected={selectedAgent === agent.nome}
              onClick={() => setSelectedAgent(agent.nome)}
            />
          ))}
        </div>

        {/* Conversations */}
        <div className="flex flex-col gap-4">
          <h2 className="font-heading text-heading-sm text-muted">
            Conversas analisadas — {selected?.nome ?? ''}
          </h2>
          {conversations.length === 0 ? (
            <p className="text-body-md text-muted py-8 text-center">
              Selecione um agente para ver as conversas.
            </p>
          ) : (
            conversations.map((c) => (
              <ConversationCard
                key={c.leadId}
                {...c}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
