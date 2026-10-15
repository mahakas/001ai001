# MAHAK Platform

MAHAK is a ChatGPT-like, API-first AI platform with a modern web experience,
general AI chat, customizable private teachers, projects, multimodal file
interaction, memory, voice, educational knowledge, AI model orchestration, and
a complete administrative and AI-operations platform.

This repository is a **pnpm workspace monorepo** that currently implements
**R01 — Platform Foundation & Application Shell** (see [ROADMAP.md](ROADMAP.md)
for the full phased roadmap). R01 establishes a stable, responsive, RTL/LTR,
themed application shell with reserved entry points for every later product
module — without implementing any of them.

## Workspace layout

```text
apps/
  web/          # User Experience layer — React 19 / Vite 7 shell (R01)
  api/          # Application/API layer — FastAPI, shell contract endpoint (R01)
packages/
  contracts/    # Shared, dependency-free contract definitions (TypeScript)
specs/
  001-platform-app-shell/   # R01 spec, plan, tasks, contracts, data model
```

## R01 scope (what is implemented)

- A single application shell with exactly three primary regions: sidebar /
  navigation, header, and main content.
- Persistent primary navigation with a collapsible/expandable sidebar.
- Responsive desktop / tablet / mobile presentation, including a mobile overlay
  navigation drawer.
- RTL/LTR direction foundation for Persian (`fa`), Arabic (`ar`), and English
  (`en`).
- Light / Dark / System theme foundation.
- Shell-level accessibility (semantic regions, keyboard focus, focus trap,
  skip-to-main, accessible names, contrast).
- Shell application states: whole-frame loading, per-region loading, empty,
  error, unavailable, and offline.
- A public vs authenticated shell-mode boundary defined as a **contract only**
  — R01 implements no authentication.
- Eight reserved navigation destinations, one per future product module
  (General AI Chat, conversations, projects, Private Teacher, files, search,
  settings, Admin Control Center), each showing the defined unavailable state.
- `GET /api/v1/shell` — the stable shell contract endpoint.

### Explicitly out of scope (later roadmap entries)

Authentication, chat/streaming, conversation history, projects, file upload,
the AI model gateway, Private Teacher, knowledge/RAG, memory, voice, Admin
functionality, billing, and production deployment. `KNOWLEDGE`, `MEMORY`,
`VOICE`, and `AI_MODEL_GATEWAY` exist as **identity-only seams** — no
destination, no slot, no implementation.

## Prerequisites

- **Node.js** `>= 20.19` (developed against `24.21.0`)
- **pnpm** `10.x`
- **Python** `>= 3.12` (developed against `3.13`)
- A modern desktop or mobile browser (current or previous major version)

## Install

```bash
pnpm install                       # all workspace packages
```

The Python API uses its own environment:

```bash
cd apps/api
python -m venv .venv
.venv\Scripts\activate             # Windows
pip install -e ".[test]"
cd ../..
```

## Run

### Web (Vite dev server — port 5173)

```bash
pnpm --filter @mahak/web dev
```

Open <http://localhost:5173>. The shell defaults to a first-visit state (System
theme, RTL for Persian). Use `http://localhost:5173/?shellMode=authenticated`
to exercise the authenticated navigation set.

### API (FastAPI — port 8000)

```bash
cd apps/api
uvicorn mahak_api.main:app --reload
```

Shell contract: <http://localhost:8000/api/v1/shell>

> The web shell is fully functional with the API unreachable — theme,
> direction, viewport class, sidebar state, and offline indication all resolve
> locally (client resilience rule).

## Validation

```bash
pnpm typecheck            # tsc across workspace (web + contracts)
pnpm lint                 # ESLint (--max-warnings=0)
pnpm test                 # Vitest (web) + pytest (api)
pnpm test:e2e             # Playwright E2E (web)
python -m compileall apps/api   # Python compilation gate
```

See [apps/web/README.md](apps/web/README.md) and [apps/api/README.md](apps/api/README.md)
for detailed per-app instructions, and
[specs/001-platform-app-shell/quickstart.md](specs/001-platform-app-shell/quickstart.md)
for ten runnable end-to-end validation scenarios.

## Governance & documentation

- [ROADMAP.md](ROADMAP.md) — the authoritative feature decomposition and
  dependency order.
- `.specify/memory/constitution.md` — the governing engineering contract
  (principles I–V).
- `specs/001-platform-app-shell/` — the R01 specification (`spec.md`), plan
  (`plan.md`), tasks (`tasks.md`), data model (`data-model.md`), contracts
  (`contracts/`), and quickstart.
