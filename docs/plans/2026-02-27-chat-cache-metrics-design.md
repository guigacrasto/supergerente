# Chat: Cache + Métricas Pré-computadas + Histórico de Conversa — Design

**Data:** 2026-02-27

## Decisões

- **Cache:** stale-while-revalidate, TTL 30 min. Primeira carga espera (~90s). Subsequentes são instantâneas. Refresh ocorre em background sem bloquear o usuário.
- **Métricas:** pré-calculadas no servidor antes de chamar a IA. Contexto rico (~3-5 KB), sem passar leads brutos.
- **Histórico:** session-based. Frontend gera um `sessionId` (UUID), manda em cada request. Servidor armazena histórico por sessão em memória (limpo após 30 min de inatividade).

## Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/api/cache/crm-cache.ts` |
| Modificar | `src/api/routes/chat.ts` |

## Módulo de Cache (`crm-cache.ts`)

Exporta uma função `getCrmMetrics(service)` que:
1. Retorna cache imediatamente se fresco
2. Se expirado: retorna cache antigo + dispara `fetchAndCompute()` em background
3. Se sem cache: aguarda fetch completo

### Métricas calculadas

**Por vendedor × funil:**
- `ganhos` (status_id === 142), `perdidos` (status_id === 143), `ativos` (restante)
- `conversao` = ganhos / (ganhos + perdidos) × 100
- `novosSemana` (created_at >= 7 dias), `novosMes` (created_at >= 30 dias)

**Resumo por funil:**
- Totais agregados, conversão geral, novos semana/mês

**Resumo geral:**
- Total todos os funis, top 5 por conversão, top 5 por volume, novos hoje/semana/mês

### Interface TypeScript

```typescript
interface VendedorMetrics {
  nome: string;
  funil: string;
  total: number;
  ganhos: number;
  perdidos: number;
  ativos: number;
  conversao: string; // "23.4%"
  novosSemana: number;
  novosMes: number;
}

interface FunilMetrics {
  nome: string;
  total: number;
  ganhos: number;
  perdidos: number;
  ativos: number;
  conversao: string;
  novosSemana: number;
  novosMes: number;
}

interface CrmMetrics {
  funis: Record<string, FunilMetrics>;
  vendedores: VendedorMetrics[];
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
```

## Rota de Chat (`chat.ts`)

### Request
```json
{ "message": "string", "sessionId": "uuid (opcional)" }
```

### Response
```json
{ "response": "string", "sessionId": "uuid" }
```

### Fluxo interno
1. `getCrmMetrics(service)` → métricas do cache
2. Monta `systemPrompt` estruturado com as métricas
3. Recupera ou cria sessão pelo `sessionId`
4. `model.startChat({ systemInstruction: systemPrompt, history: session.history })`
5. Envia mensagem, recebe resposta
6. Appenda `[user, model]` ao `session.history`
7. Retorna `{ response, sessionId }`

### Limpeza de sessões
- Sessions sem atividade há mais de 30 min são removidas automaticamente no início de cada request

## O que a IA consegue responder

- "Quem converteu mais esse mês?" ✅
- "Qual a taxa de conversão geral?" ✅
- "Quantos leads novos essa semana?" ✅
- "Ranking de vendedores por leads ganhos?" ✅
- "Me fala mais sobre o segundo colocado" ✅ (histórico de conversa)
- "E no Tryvion especificamente?" ✅ (follow-up funciona)
- "Telefone do lead João" ❌ (dado não disponível no contexto — IA informa honestamente)
