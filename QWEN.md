# Chris Hartwig Website Project

## Project Overview

This is a modern web application built with the Astro framework, React, Tailwind CSS, and Cloudflare Workers. It serves as the website for chris-hartwig.com, featuring a static frontend with dynamic API capabilities via Cloudflare Workers.

The project follows the architecture described in `docs/setup.md`, combining:
- Astro 5 for static site generation
- React 19 for interactive components
- Tailwind CSS 4 for styling
- Cloudflare Workers for API endpoints and dynamic functionality
- TypeScript with strict configuration
- ESLint and Vitest for code quality and testing

## Architecture

The project uses a hybrid approach:
- **Static Frontend**: Astro generates static HTML/CSS/JS assets in the `dist/` directory
- **Serverless API**: Cloudflare Workers (`src/worker.ts`) handle dynamic requests via Hono routing
- **Asset Serving**: Static assets are served directly, with API requests handled separately
- **Path Aliases**: Uses `@/*` → `src/*` for clean imports

## Building and Running

### Development
```bash
# Frontend development server only
npm run ui

# Full stack: builds Astro and runs Cloudflare Worker with Wrangler
npm run dev
```

### Production
```bash
# Build static assets
npm run build

# Preview production build locally
npm run preview

# Deploy flow: build assets and deploy to Cloudflare
```

### Code Quality
```bash
# Type checking (TypeScript + Astro templates)
npm run check

# Linting (TypeScript, React, Astro, JavaScript)
npm run lint

# Unit tests
npm run test

# Interactive test UI
npm run test:ui
```

### Cleanup
```bash
# Clean build artifacts
npm run clean
```

## Key Files and Directories

- `astro.config.mjs` - Astro configuration with React integration
- `wrangler.jsonc` - Cloudflare Workers configuration
- `src/worker.ts` - Main worker entry point with Hono routing
- `worker-configuration.d.ts` - Generated Cloudflare binding types
- `src/pages/` - Astro page components
- `src/components/` - Reusable components (Astro and React)
- `src/layouts/` - Layout components
- `src/styles/` - Global styles and CSS
- `src/types/` - TypeScript type definitions

## Development Conventions

### Code Structure
- Use `@/*` path aliases for imports from the `src/` directory
- Place Astro components in `src/components/` and pages in `src/pages/`
- Use Tailwind utility classes for styling
- Write TypeScript with strict mode enabled
- Components should be self-contained with proper prop typing

### Testing
- Write unit tests with Vitest
- Place test files alongside source files or in a `tests/` directory
- Use descriptive test names and follow AAA (Arrange, Act, Assert) pattern

### Linting
- Follow ESLint rules for TypeScript, React, and Astro files
- Code should pass all linting rules with no warnings
- Use Prettier for consistent formatting (if configured)

### Project Dependencies
The project includes:
- Core: astro, react, react-dom
- Astro integrations: @astrojs/react
- Styling: @tailwindcss/postcss, tailwindcss, autoprefixer
- Development: typescript, vitest, jsdom, @vitest/ui
- Linting: eslint, @typescript-eslint, eslint-plugin-astro, eslint-plugin-react
- Cloudflare: wrangler, hono