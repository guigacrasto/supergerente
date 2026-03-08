# SEO — SuperGerente

## Status Atual

SuperGerente é uma **PWA de uso interno** (atrás de login). SEO é relevante apenas se criar landing page pública de venda.

## PWA Meta Tags (Implementado)

- [x] `<title>` dinâmico via `VITE_APP_NAME`
- [x] `<meta name="description">` via `VITE_APP_DESCRIPTION`
- [x] `<meta name="theme-color">` via `VITE_APP_THEME_COLOR`
- [x] `<link rel="manifest">` (PWA manifest)
- [x] `<link rel="icon">` (favicon)
- [x] Google Fonts preload (Libre Franklin + Mulish)

## Se Landing Page For Criada

### Meta Tags Obrigatórias
- [ ] Title único por página (max 60 chars)
- [ ] Meta description (max 155 chars)
- [ ] Canonical URL
- [ ] Open Graph: og:title, og:description, og:image, og:url
- [ ] Twitter Card: twitter:card, twitter:title, twitter:image

### Estrutura
- [ ] H1 único por página
- [ ] Headings em ordem hierárquica (h1 → h2 → h3)
- [ ] URLs amigáveis (/funcionalidades, /precos, /contato)
- [ ] Sitemap.xml
- [ ] robots.txt

### Performance
- [ ] LCP < 2.5s
- [ ] FID < 100ms
- [ ] CLS < 0.1
- [ ] Imagens WebP com lazy loading
- [ ] Code splitting por rota

## Notas

- SPA (React) precisa de SSR/SSG para SEO (Next.js ou Astro para landing page)
- O painel interno (atrás de login) não precisa de SEO
- Se decidir criar landing page, considerar domínio separado ou subdomínio
