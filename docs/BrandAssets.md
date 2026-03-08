# Brand Assets — SuperGerente

## Identidade Visual

- **Nome:** SuperGerente
- **Sigla:** SG
- **Tagline:** Painel de gestão comercial inteligente
- **Estilo:** Cleverwise (dark purple, glassmorphism)

## Logo

- Logo principal: silhueta de pessoa + gráfico ascendente
- SVG em `web/public/` (logo.svg, logo-192.png, logo-512.png)
- Favicon: `web/public/favicon.ico`

## Paleta de Cores

### Primárias
| Token | Hex | Uso |
|-------|-----|-----|
| `bg-main` | `#12081E` | Background principal |
| `bg-surface` | `#22182D` | Superfícies/cards |
| `sidebar` | `#270E5F` | Sidebar fixa |
| `accent` | `#9566F2` | Cor de destaque principal |
| `accent-blue` | `#4E8CFF` | Destaque secundário |

### Status
| Token | Hex | Uso |
|-------|-----|-----|
| `success` | Verde | Ganhos, positivo |
| `warning` | Amarelo | Alertas, atenção |
| `danger` | Vermelho | Erros, perdas |

### Gradientes
- **Accent:** `bg-gradient-to-br from-primary to-accent-blue`
- **Cards:** Glassmorphism com `backdrop-blur` + bordas sutis

## Tipografia

| Uso | Fonte | Peso |
|-----|-------|------|
| **Headings** | Libre Franklin | 600-700 |
| **Body** | Mulish | 400-500 |

- Tracking tight em headings grandes
- Line-height 1.7 em body text
- Google Fonts (preload)

## Componentes Visuais

- **Cards:** Glassmorphism com `backdrop-blur-glass`, bordas sutis
- **Cantos:** `rounded-card` (12px), `rounded-button` (8px)
- **Profundidade:** Sem sombras pesadas — hierarquia via backgrounds e bordas
- **Ícones:** lucide-react (nunca emojis como ícones)
- **Espaçamento:** Generoso, tokens consistentes

## PWA

- Theme color: `#9566F2`
- Background color: `#12081E`
- Display: standalone
- Ícones: 192x192 e 512x512 PNG
