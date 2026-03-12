# SuperGerente — Design Reference for Pencil.dev

## Style: Cleverwise (Dark Purple + Glassmorphism)

## Colors
- Background main: #12081E
- Surface/cards: #22182D
- Surface secondary: #2F233C
- Sidebar: #270E5F
- Accent primary (purple): #9566F2
- Accent blue: #1F74EC
- Glass border: rgba(255,255,255,0.08)
- Success: #0EB01D
- Warning: #F9AA3C
- Danger: #EF4444
- Muted text: #959CA6

## Typography
- Headings: Libre Franklin (600-700 weight, tight tracking)
- Body: Mulish (400-500 weight, 1.7 line-height)
- Heading XL: 2rem/2.5rem bold
- Heading LG: 1.375rem/1.75rem semibold
- Body MD: 0.875rem/1.25rem
- Body SM: 0.75rem/1rem

## Components
- Cards: Glassmorphism with backdrop-blur, subtle borders rgba(255,255,255,0.08)
- Border radius: Cards 12px, Buttons 8px, Badges pill (9999px)
- No heavy shadows — use backgrounds and borders for hierarchy
- Gradients: bg-gradient from #9566F2 to #1F74EC
- Icons: Lucide icon set (line style)

## Dashboard Layout
- Fixed sidebar (left, #270E5F) with logo, nav links, user avatar
- Top bar with page title, filters, notifications bell
- Main content: KPI cards row at top, then data sections
- KPI cards: glassmorphism, icon + label + value + trend percentage
- Tables: sticky header, row hover, sort indicators
- Status badges: colored pills (green/yellow/red)

## UX Patterns
- Generous spacing between sections
- Empty states with illustration + CTA
- Loading skeletons for async data
- Mobile-first responsive
- Dark theme primary, light theme secondary
