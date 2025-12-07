# Stack & Configuration

CurvaQz ships as an Astro + React front-end bundled for Cloudflare Workers with Tailwind CSS 4, TypeScript, and Vitest. This document captures the reusable boilerplate pieces: tooling, scripts, configs, and runtime wiring.

## Tooling Overview

- Astro 5 with `@astrojs/react` for React components inside `.astro` pages.
- Cloudflare Worker entry at `src/worker.ts` using Hono for routing and asset fallback.
- Tailwind CSS 4 via the new `@tailwindcss/postcss` plugin plus Autoprefixer.
- TypeScript (strict via `astro/tsconfigs/strict`) with `@/*` path aliases.
- ESLint for TypeScript, React, and Astro + a11y rules.
- Vitest for unit/integration tests.

## npm Scripts

- `npm run ui` → `astro dev` for front-end development.
- `npm run dev` → `astro build` then `wrangler dev --port 4321` to serve the built UI and Worker API together.
- `npm run build` → production build for Astro.
- `npm run preview` → preview the production build locally.
- `npm run lint` → ESLint for TS/TSX/Astro with `--max-warnings=0`.
- `npm run check` → `tsc --noEmit` and `astro check` for type + template validation.
- `npm run test` → `vitest run` (default config).

## Environment variables (newsletter)

- `PUBLIC_TURNSTILE_SITE_KEY` (public build-time): export in your build/CI env so the React newsletter form can render the widget (Astro exposes only `PUBLIC_*` to the client).
- `TURNSTILE_SECRET` (private): set via `wrangler secret put TURNSTILE_SECRET` for Turnstile siteverify on `/api/subscribe`.
- Both the public site key (at build time) and the secret (runtime) must be present for subscriptions to be accepted; redeploy after updating.

## Astro + React

- Config: `astro.config.mjs` registers `@astrojs/react` (`integrations: [react()]`).
- Pages/components live under `src/`; `public/` assets are served as-is; build output goes to `dist/`.
- Type checking: `@astrojs/check` is installed; `npm run check` combines `tsc` and `astro check`.

## Styling (Tailwind + PostCSS)

- Tailwind 4 config: `tailwind.config.js` scans `./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}` for class usage.
- PostCSS: `postcss.config.js` wires `@tailwindcss/postcss` and `autoprefixer`—no separate Tailwind CLI step needed.
- Add global styles via Tailwind directives inside your CSS (the build is handled through PostCSS in Astro).

## TypeScript Setup

- `tsconfig.json` extends `astro/tsconfigs/strict`, includes `.astro/types.d.ts`, `src/**/*`, and `worker-configuration.d.ts`.
- `compilerOptions.baseUrl` is `.` with alias `@/*` → `src/*` for clean imports in UI and Worker code.

## Linting

- Config: `.eslintrc.cjs` with overrides per file type.
  - `*.ts, *.tsx`: `@typescript-eslint/parser`, plugins `@typescript-eslint` + `react`, extends `eslint:recommended`, `plugin:@typescript-eslint/recommended`, `plugin:react/recommended`, `plugin:react/jsx-runtime`.
  - `*.astro`: `astro-eslint-parser` with `@typescript-eslint` for script blocks, extends `eslint:recommended`, `plugin:astro/recommended`, `plugin:astro/jsx-a11y-recommended`; disables `react/no-unknown-property` for Astro JSX attributes.
- Ignore: `node_modules`, `dist`, `.astro`, `public`.

## Testing

- Runner: Vitest (`npm run test` → `vitest run`) with the default config.
- Tests live in `tests/` alongside helper modules; no custom setup file is needed today.

## Cloudflare Worker Runtime

- Wrangler config: `wrangler.jsonc`
  - `main`: `src/worker.ts` (exporting `fetch`).
  - `compatibility_date`: `2024-11-21`; `tsconfig`: `tsconfig.json`.
  - Bindings: D1 (`DB`), KV namespace (`QZ_CACHE`), Durable Object (`QUIZ_SESSION` → `QuizSessionDurableObject`), static assets (`ASSETS` → `dist`), and runtime vars (`QUIZ_MODE`, `QUIZ_API_BASE`, `QUIZ_API_AUTH`, `QZ_API_CACHE_TTL_SECONDS`).
  - Observability block is pre-wired but disabled by default.
- Routing: `src/worker.ts` mounts a Hono app at `/api` with health, session, quiz, quiz-session, and leaderboard endpoints; non-API requests fall back to `ASSETS.fetch` before returning 404.
- Dev flow: `npm run dev` builds Astro and starts `wrangler dev` on port `4321`, serving the Worker and static assets together.

## Project Layout Notes

- `src/` holds both Astro/React front-end code and Worker code (incl. Durable Objects and route handlers).
- `worker-configuration.d.ts` is generated from Wrangler bindings for typed access in the Worker.
- `dist/` is the Worker-compatible build output Wrangler serves via the `ASSETS` binding.

