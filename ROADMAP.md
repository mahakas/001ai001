# MAHAK ROADMAP

## Epic

MAHAK is a ChatGPT-like, API-first AI platform with a modern web experience, general AI chat, customizable private teachers, projects, multimodal file interaction, memory, voice, educational knowledge, AI model orchestration, and a complete administrative and AI-operations platform.

Because the product spans multiple independent domains, the implementation is decomposed into independently specified and testable feature slices. Each slice receives its own `spec.md`, `plan.md`, `tasks.md`, implementation cycle, and convergence verification.

The roadmap is the source of truth for feature decomposition and dependency ordering.

---

## Status Legend

* planned
* in-progress
* done

---

# Phase A — Platform Foundation

| ID  | Sub-feature                              | Intent                                                                                                                                       | Scope boundary                                                                                                                             | Depends on | Status  | Sub-spec |
| --- | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------- | -------- |
| R01 | Platform Foundation & Application Shell  | Establish the initial MAHAK product shell and stable boundaries between frontend, backend, API, and core platform domains.                   | Includes application foundation and cross-domain contracts; excludes feature-specific business logic.                                      | —          | in-progress | [specs/001-platform-app-shell](specs/001-platform-app-shell/spec.md) |
| R02 | Identity, Authentication & Authorization | Allow users and administrators to securely register, authenticate, manage sessions, and operate according to roles and permissions.          | Includes email/password, phone/OTP, Google, CAPTCHA requirements, roles, permissions, and organization-ready boundaries; excludes billing. | R01        | in-progress | [specs/002-identity-auth](specs/002-identity-auth/spec.md) |
| R03 | User Preferences, Localization & Theme   | Provide Persian, Arabic, English, RTL/LTR behavior, and Light/Dark/System appearance plus user preferences.                                  | User experience settings only; excludes Teacher-specific language policy.                                                                  | R02        | planned | —        |
| R04 | Educational & Product Catalog            | Define configurable grades, fields, subjects, courses, chapters, topics, teacher types, and other product taxonomy required by the platform. | Catalog and relationships only; excludes source ingestion.                                                                                 | R01        | planned | —        |

---

# Phase B — Core Chat Experience

| ID  | Sub-feature                      | Intent                                                                                                             | Scope boundary                                                                             | Depends on | Status  | Sub-spec |
| --- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ---------- | ------- | -------- |
| R05 | Core AI Conversation & Streaming | Provide the fundamental conversational experience with message exchange and streaming AI responses.                | Conversation execution only; excludes Projects, Teacher, and advanced Knowledge retrieval. | R01, R02   | planned | —        |
| R06 | History, Search & Sidebar        | Provide ChatGPT-like conversation history, search, collapsible sidebar, and conversation organization.             | Conversation discovery/organization only; excludes Project semantics.                      | R05        | planned | —        |
| R07 | Projects                         | Allow users to create arbitrary Projects with chats, files, context, instructions, and memory.                     | Project container/context only; excludes Teacher Builder.                                  | R05, R06   | planned | —        |
| R08 | User Files & Attachments         | Allow users to upload supported files into conversations/projects while enforcing type, size, and lifecycle rules. | Upload/attachment lifecycle only; excludes deep ingestion and Knowledge publication.       | R02, R05   | planned | —        |

---

# Phase C — AI Model Infrastructure

| ID  | Sub-feature                            | Intent                                                                                                                          | Scope boundary                                                                             | Depends on    | Status  | Sub-spec |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------- | ------- | -------- |
| R09 | AI Model Gateway & Provider Management | Provide a unified capability-based abstraction for multiple AI providers and local models.                                      | Provider/model configuration and routing abstraction; excludes Teacher behavior.           | R01           | planned | —        |
| R10 | General AI Runtime                     | Build the general-purpose AI experience on top of the model gateway.                                                            | General AI behavior only; excludes Private Teacher and Knowledge-specific teaching policy. | R05, R09      | planned | —        |
| R11 | Intent Detection & Cross-Mode Routing  | Detect whether a request belongs to General AI, Private Teacher, Project, or another supported AI mode and route appropriately. | Routing decisions and user-visible transitions; excludes detailed Teacher pedagogy.        | R07, R09, R10 | planned | —        |

---

# Phase D — Knowledge Platform

| ID  | Sub-feature                     | Intent                                                                                                                                              | Scope boundary                                                                          | Depends on              | Status  | Sub-spec |
| --- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------- | ------- | -------- |
| R12 | Knowledge Source Management     | Allow Admin to organize, register, edit, preview, version, publish, unpublish, replace, and remove sources and attach them to educational contexts. | Source lifecycle and metadata; excludes format-specific extraction.                     | R04                     | planned | —        |
| R13 | Document Intelligence           | Process PDF, DOCX, TXT, Markdown, HTML, books, notes, and similar document sources into structured knowledge.                                       | Document formats only; excludes image/audio/video-specific pipelines.                   | R12                     | planned | —        |
| R14 | Image Intelligence              | Process educational images, scanned pages, diagrams, and image-based questions into usable knowledge and interaction context.                       | Image processing only; excludes video frames.                                           | R12                     | planned | —        |
| R15 | Audio Intelligence              | Process audio sources and transcripts for searchable and contextual AI usage.                                                                       | Audio and speech content only; excludes real-time voice conversations.                  | R12                     | planned | —        |
| R16 | Video Intelligence              | Process videos, subtitles/transcripts, metadata, timestamps, and frames while preserving their relationships.                                       | Video knowledge pipeline only; excludes interactive viewer UX.                          | R12                     | planned | —        |
| R17 | Embedding, Indexing & Retrieval | Convert processed knowledge into searchable representations and retrieve relevant context according to authorized scopes.                           | Retrieval infrastructure only; excludes Teacher pedagogy and final response generation. | R13, R14, R15, R16, R09 | planned | —        |
| R18 | Reranking, Evidence & Citation  | Improve retrieved evidence quality and expose source-aware evidence such as page, chapter, timestamp, frame, transcript, and URL references.        | Evidence construction and citation integrity; excludes UI viewer implementation.        | R17                     | planned | —        |

---

# Phase E — Private Teacher

| ID  | Sub-feature                                | Intent                                                                                                                                          | Scope boundary                                                             | Depends on         | Status  | Sub-spec |
| --- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------ | ------- | -------- |
| R19 | Private Teacher Runtime                    | Provide the core Private Teacher experience for primary school through university and exam preparation contexts.                                | Teacher runtime and teaching flow; excludes Teacher creation UI.           | R04, R09, R11, R18 | planned | —        |
| R20 | Teacher Personality & Pedagogical Profiles | Support Friendly, Strict, Child, University, Exam, and custom teaching styles with behavior that changes according to educational context.      | Teacher behavior/policy only; excludes knowledge ingestion.                | R19                | planned | —        |
| R21 | Teacher Builder & Custom Teachers          | Allow Admin and authorized users to create customized Teachers from resources, policies, personality, context, and AI capabilities.             | Teacher creation/customization only; excludes Admin AI execution workflow. | R19, R20, R26      | planned | —        |
| R22 | Teacher Knowledge Scopes & Context         | Allow a Teacher to operate across multiple authorized knowledge scopes, resources, projects, and educational contexts without losing isolation. | Context and scope management only; excludes retrieval implementation.      | R18, R19, R21      | planned | —        |

---

# Phase F — Multimodal Interaction, Memory & Voice

| ID  | Sub-feature                   | Intent                                                                                                                                                                       | Scope boundary                                                                   | Depends on    | Status  | Sub-spec |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------- | ------- | -------- |
| R23 | Interactive Source Experience | Let users interact deeply with pages, books, images, documents, transcripts, video timestamps, and citations.                                                                | Viewer and source interaction UX; excludes source processing itself.             | R08, R18      | planned | —        |
| R24 | Multilevel Memory             | Provide User, Project, Conversation, and Teacher memory with explicit scope and retention behavior.                                                                          | Memory semantics and retrieval; excludes billing.                                | R07, R19, R22 | planned | —        |
| R25 | Voice Interaction             | Support both Push-to-Talk and real-time conversational voice experiences.                                                                                                    | Voice interaction only; excludes general media ingestion already covered by R15. | R09, R19, R24 | planned | —        |
| R26 | Generated Content & AI Tools  | Support generated educational and general outputs including quizzes, tests, flashcards, study plans, code, tables, documents, images, charts, and other tool-backed content. | Generation/tool capability layer; excludes Teacher personality.                  | R09, R10, R19 | planned | —        |

---

# Phase G — Administration & AI Operations

| ID  | Sub-feature                     | Intent                                                                                                                                                           | Scope boundary                                                      | Depends on                   | Status  | Sub-spec |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------- | ------- | -------- |
| R27 | Admin Control Center            | Provide the full administrative application for managing users, Teachers, educational structure, Knowledge, models, configuration, usage, and system operations. | Admin UI and management workflows; excludes AI command execution.   | R02, R04, R09                | planned | —        |
| R28 | Admin AI Copilot                | Allow Admins to instruct MAHAK in natural language to inspect, create, process, configure, and manage platform resources.                                        | AI planning and action interface; sensitive execution requires R29. | R09, R12, R27                | planned | —        |
| R29 | Approval, Jobs & AI Operations  | Manage approval-required actions, asynchronous jobs, execution state, progress, validation, success, failure, logs, and recovery information.                    | Operational execution framework; excludes ordinary User chat.       | R27, R28                     | planned | —        |
| R30 | Knowledge Operations Automation | Allow approved AI/admin workflows to ingest, process, chunk, embed, index, publish, reprocess, replace, and validate knowledge sources.                          | Knowledge operation execution; excludes source interaction UX.      | R13, R14, R15, R16, R17, R29 | planned | —        |

---

# Phase H — Commercial, Usage & Observability

| ID  | Sub-feature                                  | Intent                                                                                                                                               | Scope boundary                                                                                         | Depends on    | Status  | Sub-spec |
| --- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------- | ------- | -------- |
| R31 | Credits, Usage & Billing                     | Track user credits, token/resource consumption, deductions, free credits, and plan-aware usage.                                                      | Credit/usage ledger and billing foundation; payment-provider integration may remain separately scoped. | R05, R09, R10 | planned | —        |
| R32 | Analytics, Audit & Observability             | Provide operational visibility into users, models, providers, tokens, credits, latency, retrieval, jobs, errors, admin actions, and system outcomes. | Observability and analytics; excludes product-specific learning evaluation.                            | R29, R31      | planned | —        |
| R33 | Security, Abuse Prevention & Data Protection | Harden authentication, uploads, AI endpoints, provider access, administrative operations, and abuse controls.                                        | Security controls and policies; excludes infrastructure deployment itself.                             | R02, R08, R29 | planned | —        |

---

# Phase I — Evaluation, API Platform & Production

| ID  | Sub-feature                         | Intent                                                                                                                                        | Scope boundary                                                                               | Depends on         | Status  | Sub-spec |
| --- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------ | ------- | -------- |
| R34 | AI & Product Evaluation             | Define measurable evaluation for Chat, Teacher, Retrieval, Evidence, Routing, Multimodal behavior, Voice, Admin AI, and regression quality.   | Evaluation framework and acceptance measurement; excludes business analytics already in R32. | R10, R18, R19, R28 | planned | —        |
| R35 | Public API & Client Readiness       | Expose stable, versioned interfaces suitable for the Web client and future Mobile, embedded, and external clients.                            | API/client contracts; excludes public SDK products unless separately specified.              | R05, R07, R19, R27 | planned | —        |
| R36 | Production Deployment & Scalability | Prepare MAHAK for reliable website deployment with scalable processing, background jobs, storage, caching, monitoring, backups, and recovery. | Production infrastructure and operations; excludes feature behavior.                         | R31, R32, R33, R35 | planned | —        |

---

# Dependency Strategy

The roadmap is intentionally dependency-driven.

The preferred first implementation path is:

R01         | R01 | ... | done | ...
→ R02
→ R03
→ R04
→ R05
→ R06
→ R07
→ R08
→ R09
→ R10
→ R11
→ R12
→ R13
→ R14
→ R15
→ R16
→ R17
→ R18
→ R19
→ R20
→ R21
→ R22
→ R23
→ R24
→ R25
→ R26
→ R27
→ R28
→ R29
→ R30
→ R31
→ R32
→ R33
→ R34
→ R35
→ R36

This is the recommended sequential product path.

Some independent slices may later be parallelized, but only when their dependencies are complete and their active Spec Kit feature state is isolated.

---

# Traceability Rules

Every sub-spec MUST reference this roadmap.

Example:

**Input**: Parent roadmap: `ROADMAP.md` → entry **R01**

Every completed sub-spec MUST link back to its roadmap entry.

The roadmap MUST link forward to the sub-spec directory once that directory is created.

Stable IDs such as `R01`, `R02`, etc. MUST NOT be renumbered after work begins.

---

# Feature Directory Convention

Each roadmap entry should eventually have its own feature directory.

The active Spec Kit integration determines the exact generated directory and file layout.

Expected conceptual structure:

```text
specs/
├── 001-platform-foundation/
│   ├── spec.md
│   ├── plan.md
│   ├── tasks.md
│   └── ...
│
├── 002-identity-auth/
│   ├── spec.md
│   ├── plan.md
│   ├── tasks.md
│   └── ...
│
├── 003-user-preferences/
│   └── ...
```

Feature directories are generated through the project's active Spec Kit workflow and MUST NOT be manually created when the generator can create them.

---

# Definition of Complete for a Roadmap Entry

A roadmap item can be marked `done` only after:

1. Its specification exists.
2. Its scope and acceptance criteria are defined.
3. Its implementation plan exists.
4. Its task breakdown exists.
5. Required implementation is complete.
6. Automated tests pass.
7. Required integration/smoke validation passes.
8. Documentation is updated where applicable.
9. Convergence identifies no unresolved implementation gaps.
10. The roadmap status is updated to `done`.

---

# Living Roadmap Rule

This roadmap is a living architectural decomposition.

When a requirement changes:

1. Update this roadmap first if the feature boundaries or dependencies change.
2. Update affected sub-specifications.
3. Reconcile plans and tasks.
4. Re-run the applicable quality gates.

A completed historical sub-spec must remain available for traceability and audit.

---

# Roadmap Governance

The roadmap defines feature decomposition and dependency ordering.

The constitution defines the permanent engineering and product rules.

Feature specifications define the behavior and acceptance criteria of each feature.

Plans define the technical implementation strategy.

Tasks define the implementation work.

Therefore:

```text
constitution.md
      ↓
ROADMAP.md
      ↓
Feature Specification
      ↓
Plan
      ↓
Tasks
      ↓
Implementation
      ↓
Verification / Convergence
```

The roadmap MUST NOT be used as a substitute for a feature specification.

The constitution MUST NOT be used as a substitute for feature requirements.

A completed feature MUST remain traceable from implementation back to its roadmap entry and original requirements.

---

Version: 1.0.1
Status: planned
Date: 2026-09-24
Last Amended: 2026-09-24
