# Broomit – notes for Claude

- Read `docs/architecture.md` before changing structure; update it when a decision changes.
- `src/engine/` must not import React. UI lives in `src/app/`, `src/features/` and `src/design/`.
- All UI colors, radii and shadows come from `src/design/tokens.css`.
- UI text is English. Conversation with the project owner is in German.
- Run `npm run check` before every commit; it must pass.
- Every visible tool must actually work. No placeholder UI.
