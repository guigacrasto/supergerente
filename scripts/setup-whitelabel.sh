#!/bin/bash
set -e

echo "============================================"
echo "  SuperGerente — White Label Setup"
echo "============================================"
echo ""

# 1. Collect info
read -p "Nome da marca (ex: MeuCRM): " BRAND_NAME
read -p "Descrição curta: " BRAND_DESC
read -p "Cor tema (hex, ex: #2563EB): " THEME_COLOR
echo ""
echo "--- Kommo CRM (Equipe Principal) ---"
read -p "Subdomínio Kommo: " KOMMO_SUB
read -p "Client ID: " KOMMO_CID
read -p "Client Secret: " KOMMO_CS
read -p "Redirect URI: " KOMMO_REDIR
read -p "Access Token: " KOMMO_TOKEN
echo ""
echo "--- Supabase ---"
read -p "Supabase URL: " SUPA_URL
read -p "Supabase Service Key: " SUPA_KEY
echo ""
echo "--- IA ---"
read -p "Gemini API Key: " GEMINI_KEY
echo ""
read -p "Porta do servidor (default 3000): " PORT
PORT=${PORT:-3000}

# Optional second team
echo ""
read -p "Configurar equipe secundária (amarela)? (s/n): " HAS_AMARELA
if [[ "$HAS_AMARELA" == "s" || "$HAS_AMARELA" == "S" ]]; then
  echo ""
  echo "--- Kommo CRM (Equipe Amarela) ---"
  read -p "Subdomínio Kommo: " KOMMO_AM_SUB
  read -p "Client ID: " KOMMO_AM_CID
  read -p "Client Secret: " KOMMO_AM_CS
  read -p "Redirect URI: " KOMMO_AM_REDIR
  read -p "Access Token: " KOMMO_AM_TOKEN
fi

# 2. Generate .env
echo ""
echo "Gerando .env..."
cat > .env << ENVEOF
# Branding
VITE_APP_NAME=${BRAND_NAME}
VITE_APP_SHORT_NAME=${BRAND_NAME}
VITE_APP_DESCRIPTION=${BRAND_DESC}
VITE_APP_THEME_COLOR=${THEME_COLOR}

# Kommo — Equipe Azul (principal)
KOMMO_SUBDOMAIN=${KOMMO_SUB}
KOMMO_CLIENT_ID=${KOMMO_CID}
KOMMO_CLIENT_SECRET=${KOMMO_CS}
KOMMO_REDIRECT_URI=${KOMMO_REDIR}
KOMMO_ACCESS_TOKEN=${KOMMO_TOKEN}

# Kommo — Equipe Amarela (opcional)
KOMMO_AMARELA_SUBDOMAIN=${KOMMO_AM_SUB:-}
KOMMO_AMARELA_CLIENT_ID=${KOMMO_AM_CID:-}
KOMMO_AMARELA_CLIENT_SECRET=${KOMMO_AM_CS:-}
KOMMO_AMARELA_REDIRECT_URI=${KOMMO_AM_REDIR:-}
KOMMO_AMARELA_ACCESS_TOKEN=${KOMMO_AM_TOKEN:-}

# IA
GEMINI_API_KEY=${GEMINI_KEY}

# Database
SUPABASE_URL=${SUPA_URL}
SUPABASE_SERVICE_KEY=${SUPA_KEY}

# Server
PORT=${PORT}
ENVEOF
echo "✅ .env gerado"

# 3. Install dependencies
echo ""
echo "Instalando dependências..."
npm install
npm install --prefix web
echo "✅ Dependências instaladas"

# 4. Supabase migrations
echo ""
echo "============================================"
echo "  Migrações Supabase"
echo "============================================"
echo ""
echo "Execute os seguintes SQLs no Supabase SQL Editor:"
echo ""
echo "1. docs/migrations/001-mentors.sql"
echo "2. docs/migrations/user_funnel_permissions.sql"
echo ""
echo "Também crie as tabelas: profiles, settings, token_store, token_logs"
echo "(veja docs/white-label-guide.md para os schemas completos)"
echo ""
read -p "Pressione Enter quando as migrações estiverem concluídas..."

# 5. Build
echo ""
echo "Fazendo build..."
npm run build
echo "✅ Build concluído"

# 6. Summary
echo ""
echo "============================================"
echo "  ✅ Setup concluído — ${BRAND_NAME}"
echo "============================================"
echo ""
echo "Para rodar localmente:"
echo "  npm start"
echo ""
echo "Para deploy no Railway:"
echo "  railway login"
echo "  railway up"
echo ""
echo "Para criar o primeiro admin:"
echo "  1. Acesse a URL do app e registre-se"
echo "  2. No Supabase, na tabela 'profiles', altere:"
echo "     - role → 'admin'"
echo "     - status → 'approved'"
echo "     - teams → ['azul'] (ou ['azul','amarela'])"
echo ""
echo "Documentação completa: docs/white-label-guide.md"
echo ""
