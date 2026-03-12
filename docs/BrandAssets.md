# Brand Assets — SuperGerente

## Identidade Visual

- **Nome:** SuperGerente
- **Sigla:** SG
- **Tagline:** Painel de gestao comercial inteligente
- **Estilo:** Cleverwise (dark purple, glassmorphism)

## Logo

O simbolo e composto por 3 poligonos geometricos formando um "S" abstrato.
Texto em duas linhas: "SUPER" (cima) + "GERENTE" (baixo).

### Arquivos (em `brand_assets/`)

| Arquivo | Descricao |
|---|---|
| `logo.svg` | Logo completa — colorida, fundo transparente |
| `logo-dark.svg` | Logo completa — preta, fundo transparente |
| `logo-on-purple.svg` | Logo completa — branca sobre fundo gradiente roxo |
| `symbol.svg` | Simbolo isolado — colorido, fundo transparente |
| `symbol-dark.svg` | Simbolo isolado — preto, fundo transparente |
| `symbol-on-purple.svg` | Simbolo branco sobre fundo gradiente roxo |
| `symbol-512.png` | Icone PWA 512x512 |
| `symbol-192.png` | Icone PWA 192x192 |
| `favicon.png` | Favicon 32x32 |
| `manual-da-marca.pdf` | Manual da marca completo (designer) |
| `manual-da-marca.ai` | Arquivo fonte Adobe Illustrator |

### Fonte do Logo

Fonte customizada/proprietaria — diferente das fontes do sistema (Libre Franklin + Mulish).
Referencia no arquivo `.ai` do manual da marca.

## Cores do Logo (Gradientes)

| Gradiente | De | Para |
|---|---|---|
| Principal | `#5f41bc` | `#706dee` |
| Secundario | `#7c00ff` | `#706dee` |
| Terciario | `#8d68f3` | `#706dee` |

## Paleta de Cores — UI

### Dark Theme (padrao)

| Token | Hex | Uso |
|---|---|---|
| `bg-primary` | `#12081E` | Background principal |
| `bg-surface` | `#22182D` | Superficies/cards |
| `bg-elevated` | `#2F233C` | Headers de tabela, hover |
| `sidebar` | `#270E5F` | Sidebar fixa |
| `accent` | `#9566F2` | Cor de destaque principal |
| `accent-secondary` | `#1F74EC` | Destaque secundario / gradientes |
| `accent-glow` | `rgba(149,102,242,0.1)` | Glow sutil |
| `text-primary` | `#E0E3E9` | Texto principal |
| `text-secondary` | `#959CA6` | Labels, captions |
| `glass-border` | `rgba(255,255,255,0.08)` | Bordas glass |
| `success` | `#10b981` | Ganhos, positivo |
| `warning` | `#f59e0b` | Alertas, atencao |
| `danger` | `#ef4444` | Erros, perdas |

### Light Theme

| Token | Hex | Uso |
|---|---|---|
| `bg-primary` | `#F4F5F7` | Fundo principal |
| `bg-surface` | `#FFFFFF` | Cards |
| `bg-elevated` | `#EEF4FE` | Headers, hover |
| `sidebar` | `#270E5F` | Sidebar (mesmo do dark) |
| `text-primary` | `#23272C` | Texto principal |
| `text-secondary` | `#645B6D` | Labels |
| `glass-border` | `rgba(0,0,0,0.08)` | Bordas |

### Gradientes

- **Accent:** `linear-gradient(135deg, #9566F2, #1F74EC)` — botoes primarios, avatar, chat
- **Logo:** `linear-gradient(90deg, #5f41bc, #706dee)` — elementos de marca
- **Radial BG:** `radial-gradient(circle at top right, rgba(149,102,242,0.03), transparent)`

## Tipografia

| Uso | Fonte | Peso |
|---|---|---|
| **Logo** | Customizada (ver manual) | — |
| **Headings** | Libre Franklin | 500-700 |
| **Body** | Mulish | 400-600 |

## Componentes Visuais

- **Cards:** Glassmorphism com `backdrop-blur`, bordas sutis
- **Cantos:** 12px cards, 8px botoes, 20px pills
- **Profundidade:** Sem sombras pesadas — hierarquia via backgrounds e bordas
- **Icones:** lucide-react
- **Espacamento:** Generoso, tokens consistentes (4/8/16/24/32/40px)

## PWA

- Theme color: `#9566F2`
- Background color: `#12081E`
- Display: standalone
- Icones: `web/public/icons/` (192px, 512px, maskable)
- Favicon: `web/public/icons/favicon-32.png`
