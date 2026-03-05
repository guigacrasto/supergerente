# SuperGerente

Painel de gestão comercial inteligente integrado ao Kommo CRM, com chat IA e relatórios automatizados.

## 🚀 Funcionalidades

- **Integração Nativa**: Conexão direta com a API v4 do Kommo CRM.
- **Relatórios Customizados**: Scripts prontos para análise de funis específicos (Tryvion, Matriz, etc).
- **Métricas de Marketing**: Cálculo de taxa de conversão, ticket médio e volume financeiro.
- **Análise de Agente**: Distribuição de leads e performance individual.
- **Dashboard Aprimorado**: KPIs por equipe, graficos de barras horizontais por agente, rankings de vendas.
- **Insights de Atendimento**: Analise automatica de conversas com IA (sentimento + qualidade + resumo).
- **MCP Server**: Pronto para ser usado com o Claude Desktop ou qualquer cliente MCP.

## 🛠️ Instalação

1. Clone o repositório.
2. Configure o arquivo `.env` (use `.env.example` como base).
3. Instale as dependências:
   ```bash
   npm install
   ```
4. Compile o projeto:
   ```bash
   npm run build
   ```

## 📊 Relatórios Disponíveis

O projeto conta com scripts especializados em `src/scripts/`:

- `report_tryvion_marketing.ts`: Conversão e métricas financeiras do funil Tryvion.
- `report_matriz_recent.ts`: Leads que entraram no funil Matriz nos últimos 3 dias.
- `list_agents_brands.ts`: Mapeamento de quais agentes atendem quais funis.

Para rodar qualquer relatório:
```bash
npx tsx src/scripts/NOME_DO_SCRIPT.ts
```

## 🔐 Configuração do MCP

Para usar no Claude Desktop, adicione ao seu arquivo de configuração:

```json
{
  "mcpServers": {
    "supergerente": {
      "command": "node",
      "args": ["/CAMINHO/PARA/PROJETO/build/index.js"],
      "env": {
        "KOMMO_SUBDOMAIN": "seu-subdominio",
        "KOMMO_ACCESS_TOKEN": "seu-token"
      }
    }
  }
}
```

## 📝 Documentação Adicional

- [Manual do Agente](docs/MANUAL_AGENTE.md): Guia para gestores sobre como interagir com a IA.
- [Guia de Relatórios](docs/RELATORIOS.md): Detalhes técnicos dos scripts de extração.
- [Próximos Passos](TODO.md): Roteiro de desenvolvimento para a versão web.
