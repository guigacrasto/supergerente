# iPhoneAgent — Design Document

**Data:** 2026-02-28
**Tipo:** Projeto novo separado
**Objetivo:** Bot WhatsApp inteligente para gestao de compra e venda de iPhones

---

## Visao Geral

Bot WhatsApp que monitora grupos de vendedores, extrai precos de mercado, cruza com listas de fornecedores (tambem recebidas via WhatsApp), aplica taxas (frete + imposto + cambio), calcula margens e alerta sobre oportunidades de compra. Mantem historico de precos e tendencias.

## Decisoes de Arquitetura

- **Plataforma:** Bot WhatsApp direto (sem app/PWA separado)
- **Arquitetura:** Monolito Node.js (TypeScript + Express)
- **WhatsApp API:** Evolution API (self-hosted)
- **IA:** Google Gemini 2.5 Flash (extracao + analise + estrategia)
- **Database:** Supabase (PostgreSQL)
- **Deploy:** Railway (single service)
- **Cambio:** API publica brasileira (awesomeapi) para cotacao USD/BRL diaria

## Arquitetura

```
+-------------------------------------------------+
|                  iPhoneAgent                     |
|              (TypeScript + Express)              |
|                                                  |
|  +----------+  +----------+  +--------------+   |
|  | WhatsApp |  | Gemini   |  |  Supabase    |   |
|  | Listener |->| Parser   |->|  (PostgreSQL)|   |
|  |(webhooks)|  |(extracao) |  |              |   |
|  +----------+  +----------+  +--------------+   |
|       ^              |                           |
|  +----------+  +------------------+              |
|  |Evolution |  | Analyzer Engine  |              |
|  |  API     |  | (margem, alertas,|              |
|  |          |  |  tendencias)     |              |
|  +----------+  +------------------+              |
+-------------------------------------------------+
```

**Fluxo:**
1. Evolution API recebe mensagens dos grupos -> webhook POST para o servidor
2. Gemini classifica a mensagem: lista de preco de fornecedor? oferta de venda? irrelevante?
3. Dados extraidos (modelo, storage, cor, preco, fornecedor) -> salvos no Supabase
4. Engine de analise cruza preco de compra (fornecedor + taxas) vs preco de venda (mercado)
5. Se margem > threshold configuravel -> alerta proativo no WhatsApp privado

## Modelo de Dados

### Tabelas

| Tabela | Campos-chave | Proposito |
|--------|-------------|-----------|
| `suppliers` | id, name, whatsapp_group_id, default_fees (JSON) | Fornecedores cadastrados |
| `supplier_prices` | id, supplier_id, model, storage, color, price, currency, captured_at | Precos de fornecedores (extraidos das mensagens) |
| `market_prices` | id, model, storage, color, sale_price, source_group_id, captured_at | Precos de venda no mercado (extraidos dos grupos) |
| `fees_config` | id, label, type (flat/percent), value, currency | Taxas configuraveis (frete, imposto, cambio) |
| `opportunities` | id, supplier_price_id, market_price_id, buy_cost, sell_price, margin_pct, status | Oportunidades identificadas |
| `price_history` | id, model, storage, avg_supplier_price, avg_market_price, date | Snapshot diario para tendencias |
| `exchange_rates` | id, date, from_currency, to_currency, rate, source | Cotacao diaria USD->BRL |
| `settings` | key, value | Configs do bot (threshold de margem, grupos monitorados, etc.) |

**Notas:**
- `supplier_prices` e `market_prices` sao append-only (historico completo)
- `price_history` e um resumo diario agregado via cron job
- `fees_config` permite taxas por fornecedor ou globais
- Cambio puxado automaticamente via API publica brasileira (awesomeapi)

## Motor de Inteligencia (Gemini) — 3 Camadas

### Camada 1 — Extrator (reativo, por mensagem)
- Recebe mensagem bruta dos grupos
- Classifica e extrai dados estruturados (modelo, preco, etc.)
- OCR em imagens de tabelas de preco (Gemini Vision)
- Roda a cada mensagem que chega

### Camada 2 — Consultor (reativo, por pergunta do usuario)
- Usuario manda pergunta em linguagem natural no chat privado
- Gemini recebe a pergunta + contexto dos dados no Supabase (precos atuais, historico, taxas)
- Responde com analise fundamentada nos dados reais
- Ex: "Vale comprar iPhone 16 Pro 256 agora?" -> analise com dados de margem, tendencia, recomendacao

### Camada 3 — Estrategista (proativo, autonomo)
- Roda periodicamente (a cada 6h ou quando detecta mudanca significativa)
- Analisa tendencias: preco subindo ou descendo? margem aumentando?
- Detecta eventos: fornecedor com promocao relampago, queda brusca de preco
- Manda recomendacoes claras com acao sugerida
- Resumo diario com ranking das melhores oportunidades

### System Prompt
O bot tera um system prompt rico com:
- Margem minima aceitavel do usuario
- Modelos que mais compra/vende
- Historico de decisoes anteriores
- Regras de negocio configuraveis

## Comandos do Bot

| Comando | Descricao |
|---------|-----------|
| `/precos iPhone 16 Pro 256GB` | Preco medio compra vs venda com margem |
| `/fornecedores` | Lista fornecedores ativos e ultimo preco |
| `/oportunidades` | Melhores margens encontradas agora |
| `/tendencia iPhone 15 128GB` | Evolucao de preco (ultimos 30 dias) |
| `/cotacao` | Cotacao USD/BRL do dia |
| `/taxas` | Taxas configuradas |
| `/taxas frete 150` | Atualiza taxa de frete |
| `/margem 15` | Configura threshold de alerta (15%) |
| `/grupos` | Lista grupos monitorados |
| `/ajuda` | Lista de comandos |

## Estrutura do Projeto

```
iphone-agent/
├── package.json
├── tsconfig.json
├── .env
├── railway.toml
├── src/
│   ├── index.ts                <- Express server + bootstrap
│   ├── config.ts               <- env vars tipadas
│   ├── routes/
│   │   ├── webhook.ts          <- POST /webhook (Evolution API)
│   │   └── health.ts           <- GET /health
│   ├── services/
│   │   ├── whatsapp.ts         <- enviar mensagens via Evolution API
│   │   ├── gemini/
│   │   │   ├── extractor.ts    <- Camada 1: extrai dados de mensagens
│   │   │   ├── consultant.ts   <- Camada 2: responde perguntas
│   │   │   └── strategist.ts   <- Camada 3: analise proativa
│   │   ├── analyzer.ts         <- engine de margem e oportunidades
│   │   ├── exchange.ts         <- cotacao USD/BRL diaria
│   │   └── scheduler.ts        <- cron jobs (resumo diario, tendencias)
│   ├── handlers/
│   │   ├── message-handler.ts  <- roteia mensagem: grupo vs privado
│   │   ├── group-handler.ts    <- processa mensagens de grupos
│   │   └── command-handler.ts  <- processa comandos do chat privado
│   ├── database/
│   │   ├── supabase.ts         <- client Supabase
│   │   ├── migrations/         <- SQL das tabelas
│   │   └── queries/            <- queries tipadas por entidade
│   ├── types/
│   │   └── index.ts            <- interfaces TypeScript
│   └── utils/
│       ├── parser.ts           <- helpers de parse/normalizacao
│       └── logger.ts           <- logging estruturado
└── docs/
    └── plans/
```

## Dependencias

- `express` — servidor HTTP
- `@google/generative-ai` — Gemini SDK
- `@supabase/supabase-js` — Supabase client
- `axios` — chamadas HTTP (Evolution API, cotacao)
- `node-cron` — scheduler para tarefas periodicas
- `zod` — validacao de dados extraidos
- `winston` — logging
- `typescript` — tipagem
