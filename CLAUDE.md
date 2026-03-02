# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. Users describe components in natural language; Claude AI generates them in a virtual file system and renders them in an iframe preview — no files are ever written to disk.

## Commands

```bash
npm run setup       # Initial setup: install deps + generate Prisma client + run migrations
npm run dev         # Start dev server with Turbopack
npm run build       # Production build
npm run lint        # ESLint
npm test            # Run all Vitest tests
npm run db:reset    # Reset SQLite database (destructive)
```

Run a single test file:
```bash
npx vitest run src/lib/tools/__tests__/str-replace.test.ts
```

Run tests in watch mode:
```bash
npx vitest src/lib/tools/__tests__/str-replace.test.ts
```

The `dev` script requires `NODE_OPTIONS='--require ./node-compat.cjs'` (already baked into the npm script) due to a Node.js 25+ Web Storage SSR compatibility issue.

## Environment

- Copy `.env` and set `ANTHROPIC_API_KEY` for real AI generation. Without it, a `MockLanguageModel` in `src/lib/provider.ts` returns static sample components.
- Database: SQLite at `prisma/dev.db`. Schema in `prisma/schema.prisma` — always read this file first when working on anything database or schema related.

## Architecture

### Data Flow

1. User types in `ChatInterface` → `ChatContext` sends messages + current file system state to `POST /api/chat`
2. `api/chat/route.ts` calls `streamText` (Vercel AI SDK) with the Claude model and two tools: `str_replace` (create/edit files) and `file_manager` (rename/delete)
3. Tool calls stream back and are executed by `FileSystemContext`, updating the in-memory virtual file system
4. `PreviewFrame` watches the file system, Babel-transforms `/App.jsx` client-side, and renders it in an iframe using ESM imports from `esm.sh`

### Key Modules

- **`src/lib/file-system.ts`** — Virtual file system (in-memory tree). No disk I/O; serializes to JSON for DB persistence.
- **`src/lib/contexts/file-system-context.tsx`** — React context wrapping the file system; handles AI tool call execution.
- **`src/lib/contexts/chat-context.tsx`** — Manages chat state via Vercel AI SDK's `useChat`; coordinates with file system.
- **`src/lib/tools/str-replace.ts`** — Defines the `str_replace` AI tool (create, view, edit files).
- **`src/lib/tools/file-manager.ts`** — Defines the `file_manager` AI tool (rename, delete).
- **`src/lib/transform/jsx-transformer.ts`** — Babel standalone transformation + ESM import mapping for browser preview.
- **`src/lib/provider.ts`** — Returns `anthropic('claude-haiku-4-5')` or `MockLanguageModel` depending on env.
- **`src/lib/prompts/generation.tsx`** — System prompt instructing Claude to use Tailwind, keep `/App.jsx` as entry point, and use `@/` import alias.
- **`src/lib/auth.ts`** — JWT utilities (jose); 7-day sessions.
- **`src/actions/`** — Server actions for auth (`signUp`, `signIn`, `signOut`, `getUser`) and project CRUD.

### AI Tool Constraints

- Max 10,000 output tokens per response; max 40 agentic steps (4 for mock provider)
- Ephemeral prompt caching is enabled for the system prompt
- All generated components must use `/App.jsx` as the root entry point and `@/` for cross-file imports

### State Persistence

Projects store two JSON blobs in SQLite: `messages` (chat history array) and `data` (file system snapshot). Anonymous users' work is tracked in localStorage via `src/lib/anon-work-tracker.ts` and can be migrated on sign-up.

### Preview Rendering

`PreviewFrame` creates an iframe with an inline `importmap` pointing packages to `esm.sh`. Babel standalone transforms JSX in the browser. CSS imports are stripped (no-op). Missing modules get empty placeholder exports to avoid hard crashes.

## Comments

Use comments sparingly. Only comment complex or non-obvious code.

## Testing

Tests use Vitest + jsdom + `@testing-library/react`. Config is in `vitest.config.mts`. Test files live in `__tests__/` directories alongside the modules they test.
