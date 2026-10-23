# Broomit

A digital notebook for handwriting, organizing and designing notes. Write. Organize. Create.

Broomit is built as a web app first (desktop and tablet, with Apple Pencil as the primary input),
with an architecture that can later be wrapped as native apps.

## Development

Requires Node.js 22.

```sh
npm install
npm run dev      # start the dev server
npm run check    # typecheck, lint, format check and unit tests
npm run build    # production build into dist/
```

## Repository layout

| Path          | Contents                                          |
| ------------- | ------------------------------------------------- |
| `src/app/`    | App shell, routing and providers                  |
| `src/design/` | Design tokens and shared UI components            |
| `src/engine/` | The canvas engine: plain TypeScript, no React     |
| `spikes/`     | Standalone experiments used to validate decisions |
| `docs/`       | Architecture notes and decisions                  |

See [docs/architecture.md](docs/architecture.md) for the technical decisions and the roadmap.
