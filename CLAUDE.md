# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run setup          # Install deps, generate Prisma client, run migrations
npm run dev            # Start dev server with Turbopack (http://localhost:3000)
npm run build          # Production build
npm run lint           # Run ESLint
npm run test           # Run all tests with Vitest
npx vitest <file>      # Run a single test file
npm run db:reset       # Reset database (destructive)
```

## Architecture

UIGen is an AI-powered React component generator with live preview. Users describe components in chat, and the AI generates code that renders in real-time.

### Core Data Flow

1. **Chat API** (`src/app/api/chat/route.ts`): Streams AI responses using Vercel AI SDK. The AI uses two tools to modify a virtual file system:
   - `str_replace_editor`: Create files, replace text, insert at line
   - `file_manager`: Rename/delete files

2. **Virtual File System** (`src/lib/file-system.ts`): In-memory file system (no disk writes). The `VirtualFileSystem` class manages files and is serialized to/from the database for persistence.

3. **Preview Rendering** (`src/lib/transform/jsx-transformer.ts`): Transforms JSX/TSX using Babel standalone, creates blob URLs, and generates an import map. The preview loads React from esm.sh CDN.

### Context Providers

The app uses nested React contexts in `MainContent`:
- `FileSystemProvider`: Manages virtual file system state, handles tool calls from AI
- `ChatProvider`: Wraps Vercel AI SDK's `useChat`, syncs file system with chat API

### Key Patterns

- **Path aliases**: Use `@/` for imports (e.g., `@/components/Button`)
- **Generated code convention**: AI-generated components live in the virtual FS at `/App.jsx` (entry point) and `/components/`
- **Mock provider**: Without `ANTHROPIC_API_KEY`, the app uses `MockLanguageModel` in `src/lib/provider.ts` that returns static responses

### Database

SQLite via Prisma. Reference `prisma/schema.prisma` for the data structure:
- `User`: Auth (email/password with bcrypt)
- `Project`: Stores serialized messages and file system data as JSON strings

### Testing

Vitest with jsdom for React component tests. Tests are co-located in `__tests__` directories.

## Code Style

- Use comments sparingly. Only for complex code.
