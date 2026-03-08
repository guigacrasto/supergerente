# Legal — SuperGerente

## Status Atual

### LGPD
- **Dados coletados:** nome, email, telefone (registro de usuários)
- **Dados processados:** leads e conversas do Kommo CRM (dados do cliente)
- **Base legal:** Legítimo interesse (ferramenta de trabalho) + consentimento (registro)

### Pendente
- [ ] **Termos de Uso** — documento formal
- [ ] **Política de Privacidade** — como dados são coletados, usados e armazenados
- [ ] **Consentimento de Cookies** — banner/modal (se usar tracking)
- [ ] **DPA (Data Processing Agreement)** — para clientes white-label

## Dados Pessoais Processados

| Dado | Origem | Armazenamento | Finalidade |
|------|--------|---------------|-----------|
| Nome | Registro | Supabase (profiles) | Identificação no painel |
| Email | Registro | Supabase (auth.users) | Login + comunicação |
| Telefone | Perfil (opcional) | Supabase (profiles) | Contato |
| Leads CRM | Kommo API | Cache in-memory (5min) | Métricas e análise |
| Conversas | Kommo API | Cache in-memory (1h) | Insights com IA |
| Tokens IA | Chat | Supabase (token_logs) | Monitoramento de uso |

## Retenção de Dados

| Dado | Retenção | Justificativa |
|------|----------|---------------|
| Perfis | Enquanto conta ativa | Necessário para uso |
| Tokens OAuth | Enquanto integração ativa | Necessário para API |
| Cache CRM | 5 minutos | Desempenho |
| Cache Insights | 1 hora | Desempenho |
| Token logs | Indefinido | Auditoria de custos |
| Reset tokens | 15 minutos (auto-expira) | Segurança |

## Responsabilidades

### SuperGerente (como processador)
- Processar dados do CRM do cliente
- Armazenar credenciais de forma segura
- Não compartilhar dados com terceiros
- Deletar dados quando cliente solicitar

### Cliente (como controlador)
- Garantir base legal para dados no Kommo
- Informar seus contatos sobre processamento
- Solicitar exclusão quando necessário

## Próximos Passos

1. Criar termos de uso (template jurídico BR)
2. Criar política de privacidade (LGPD compliant)
3. Implementar exclusão de conta (LGPD - direito de apagar)
4. Adicionar consentimento no registro
5. Criar DPA para clientes white-label
