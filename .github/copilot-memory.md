# AI Mahjong Project Notes

## Key Architecture
- Vanilla DOM, no framework. Components return cleanup functions.
- CSS design tokens in `src/ui/styles/global.css` (dark gaming theme)
- Global `box-sizing: border-box` reset applies to all elements
- Hash router: #/ (home), #/match (game), #/settings, #/replay
- Game phases: EXCHANGE → DING_QUE → PLAYING → END

## Rendering Pipeline
- match.ts: page (100dvh flex column) → header + contentArea (flex:1)
- matchTableRenderer.ts: mainContainer → gameArea → table (CSS Grid 3×3)
- Grid rows: auto (P2) + 1fr (center) + minmax(80px, auto) (P0 hand)
- Tiles: tileView.ts renderTile() → button.mj-tile with img (zh) or text (en)
- Hand: handView.ts renderHand() → flex wrap div with sorted tile buttons

## Known Issues / Fixes Applied
- Grid row for P0 must use minmax(80px, auto) not just `auto` to prevent collapse
- `.mj-tile` needs min-width/min-height as fallback if images fail to load
- Bottom section should NOT have max-height percentage (causes circular resolution in auto grid rows)
- contentArea needs `min-height: 0` for proper flex item height calculation
- tileView img should have onerror fallback to text mode

## Build/Test
- `pnpm build` — production build
- `pnpm test:run` — 111 tests, all should pass
- `pnpm dev` — Vite dev server, port 5173
- Tests are node-only (no jsdom) — can't test DOM rendering in vitest
