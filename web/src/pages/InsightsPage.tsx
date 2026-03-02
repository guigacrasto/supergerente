import { useEffect, useState, useCallback } from 'react';
import { Brain, Loader2, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import { PageSpinner, EmptyState, Button } from '@/components/ui';
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

interface InsightsResponse {
  insights: AgentInsightSummary[];
  processing: boolean;
}

const POLL_INTERVAL_MS = 15_000; // 15 seconds

export function InsightsPage() {
  const [data, setData] = useState<AgentInsightSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isInitial: boolean) => {
    try {
      const res = await api.get<InsightsResponse>('/insights/conversations');
      const { insights, processing: isProcessing } = res.data;
      setData(insights);
      setProcessing(isProcessing);
      if (isInitial && insights.length > 0) {
        setSelectedAgent(insights[0].nome);
      }
    } catch (err) {
      console.error('[InsightsPage] Erro ao carregar dados:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Poll while processing
  useEffect(() => {
    if (!processing) return;

    const timer = setInterval(() => fetchData(false), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [processing, fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await api.post<InsightsResponse>('/insights/refresh');
      const { insights, processing: isProcessing } = res.data;
      setData(insights);
      setProcessing(isProcessing);
      if (insights.length > 0 && !selectedAgent) {
        setSelectedAgent(insights[0].nome);
      }
    } catch (err) {
      console.error('[InsightsPage] Erro ao atualizar:', err);
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return <PageSpinner />;
  }

  if (data.length === 0 && !processing) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-heading-lg">Insights de Atendimento</h1>
          <Button
            variant="secondary"
            size="sm"
            loading={refreshing}
            onClick={handleRefresh}
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar Insights
          </Button>
        </div>
        <EmptyState
          icon={Brain}
          title="Nenhuma analise disponivel"
          description="Clique em 'Atualizar Insights' para analisar as conversas dos atendentes."
        />
      </div>
    );
  }

  if (data.length === 0 && processing) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-heading-lg">Insights de Atendimento</h1>
          <Button
            variant="secondary"
            size="sm"
            loading={true}
            onClick={handleRefresh}
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar Insights
          </Button>
        </div>
        <div className="flex flex-col items-center gap-4 py-16">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-body-md text-muted text-center max-w-md">
            Analisando conversas dos atendentes com IA... Isso pode levar alguns minutos na primeira vez.
          </p>
          <p className="text-body-sm text-muted/60">
            A pagina atualiza automaticamente quando estiver pronto.
          </p>
        </div>
      </div>
    );
  }

  const selected = data.find((a) => a.nome === selectedAgent);
  const conversations = selected?.insights ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="font-heading text-heading-lg">Insights de Atendimento</h1>
        <Button
          variant="secondary"
          size="sm"
          loading={refreshing || processing}
          onClick={handleRefresh}
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar Insights
        </Button>
      </div>

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
