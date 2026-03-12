# Guidelines Visuais — SuperGerente

## Logo

### Versoes disponiveis

| Arquivo | Descricao | Uso |
|---|---|---|
| `logo.svg` | Logo completa colorida (gradiente roxo) | Fundo escuro/transparente |
| `logo-dark.svg` | Logo completa preta | Fundo claro |
| `logo-on-purple.svg` | Logo branca sobre fundo roxo | Redes sociais, materiais |
| `symbol.svg` | Simbolo isolado colorido | Favicon, icone PWA, espacos pequenos |
| `symbol-dark.svg` | Simbolo isolado preto | Fundo claro |
| `symbol-on-purple.svg` | Simbolo branco sobre fundo roxo | Materiais de marca |
| `symbol-512.png` | Simbolo 512x512 PNG | PWA icon |
| `symbol-192.png` | Simbolo 192x192 PNG | PWA icon |
| `favicon.png` | Simbolo 32x32 PNG | Favicon |

### Regras de uso

- O simbolo e composto por 3 triangulos/poligonos que formam um "S" geometrico
- O texto "SUPER" fica na primeira linha, "GERENTE" na segunda
- Manter proporcao original — nao distorcer
- Area de respiro minima: equivalente a altura do simbolo ao redor
- Manual completo: `manual-da-marca.pdf` / `manual-da-marca.ai`

## Estilo Visual — Cleverwise

- **Tema:** Dark-first com suporte a light
- **Glassmorphism:** `backdrop-blur` + bordas sutis (`rgba(255,255,255,0.08)`)
- **Profundidade:** Hierarquia via backgrounds, sem sombras pesadas
- **Cantos:** 12px cards, 8px botoes, 20px pills
- **Espacamento:** Generoso e consistente (tokens: 4/8/16/24/32/40px)
- **Icones:** lucide-react (nunca emojis como icones)

## PWA

- Theme color: `#9566F2`
- Background color: `#12081E`
- Display: standalone
