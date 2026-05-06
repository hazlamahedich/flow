---
stepsCompleted:
  - step-01-research
  - step-02-tool-audit
  - step-03-architecture
  - step-04-epics
  - step-05-stories
  - step-06-infrastructure
lastEdited: '2026-04-24'
editHistory:
  - date: '2026-04-24'
    changes: 'Initial V2 PRD — 15 open-source tools across 4 phased epics, natural language workflow builder via Activepieces, Docker Compose configs, architecture diagrams, integration patterns'
  - date: '2026-04-24'
    changes: 'Swapped n8n (Sustainable Use License) for Activepieces (MIT) to eliminate embedding restrictions. Added production deployment architecture section. Updated Docker Compose configs, integration patterns, and all story references.'
inputDocuments:
  - prd.md
  - architecture.md
  - epics.md
  - project-context.md
workflowType: 'prd-v2'
classification:
  projectType: B2B2B / PLG Vertical SaaS + Agentic AI
  domain: Micro-Service Business Operations — Open-Source Infrastructure Expansion
  complexity: high
  projectContext: expansion-of-existing-foundation
  keyFlags:
    - Self-hosted infrastructure introduces ops complexity
    - Activepieces natural language workflow builder is a differentiating UX feature (MIT-licensed, embeddable)
    - Vector search + RAG fundamentally upgrades agent intelligence
    - Persistent memory layer changes agent behavior model
    - Docker Compose orchestration of 8+ services
    - All tools genuinely open-source (MIT/Apache/AGPL) — zero embedding restrictions
---

# Product Requirements Document — Flow OS V2: Open-Source Infrastructure Expansion

**Author:** Team Mantis
**Date:** 2026-04-24
**Parent PRD:** prd.md (V1 — Foundation through Launch)
**Scope:** 15 open-source tool integrations across 4 phased epics (Epics 11-14)

## Executive Summary

Flow OS V1 establishes the core workspace, 6 AI agents, trust system, billing, and client portal. V2 expands the platform's intelligence, automation, and observability layers using exclusively free, open-source tools — transforming Flow OS from a tool-replacement SaaS into an **AI-native automation platform** where VAs can build custom workflows in natural language, agents remember context across sessions, and semantic search replaces keyword matching across all client data.

**The V2 thesis:** V1 agents are smart but stateless, siloed, and opaque. V2 makes them persistent (Mem0), semantically aware (Qdrant + LlamaIndex), visually orchestratable (Activepieces), observable (PostHog + OpenObserve), and capable of processing voice (Whisper) and documents (Docling) — while giving VAs the power to create their own automations without code.

**The signature V2 feature:** A VA opens Flow OS and types "When a client emails about an overdue invoice, automatically draft a follow-up, create a calendar reminder for 3 days, and flag the client health score." Flow OS translates this into an Activepieces flow, wires up the agents, and activates it — no code, no drag-and-drop, just natural language. This is the **Automation Builder**, powered by Activepieces' embedded SDK + LLM translation layer.

**All 15 tools are genuinely open-source (MIT/Apache/AGPL).** No vendor lock-in. No embedding restrictions. Self-hosted via Docker Compose. Total additional infrastructure cost: $0 in licensing, ~$61/mo fixed + ~$15-25/mo per active workspace in LLM costs.

**Why Activepieces over n8n:** n8n's Sustainable Use License prohibits embedding in commercial SaaS products without a separate (costly) embed agreement. Activepieces is MIT-licensed — fully permissive for commercial embedding, white-labeling, and exposing to end users. It has 280+ integrations (vs. n8n's 1,000+, but covers all major services), a cleaner step-based UI better suited for non-technical VAs, built-in multi-tenant project isolation, and an embed SDK with iframe support designed for exactly this use case.

### V2 Tool Inventory

| Tool | Category | License | Epic | Architectural Weight |
|---|---|---|---|---|
| Activepieces | Workflow Automation | MIT | 11 | **Critical** — User-facing automation builder, agent orchestration layer, embeddable SDK |
| Qdrant | Vector Database | Apache 2.0 | 11 | **Critical** — Semantic search backbone for all agents |
| Mem0 | AI Memory | MIT | 11 | **Critical** — Persistent agent memory across sessions |
| Novu | Notifications | MIT | 11 | **High** — Unified multi-channel notification infrastructure |
| PostHog | Product Analytics | MIT | 11 | **High** — Agent performance tracking, feature flags, funnels |
| Temporal | Workflow Engine | MIT | 12 | **Critical** — Durable agent orchestration, replaces pg-boss for complex flows |
| Whisper | Speech-to-Text | MIT | 12 | **High** — Voice message processing, call transcription |
| Hocuspocus + Yjs | Real-time Collab | MIT | 12 | **High** — Collaborative editing (already in V1 roadmap) |
| LlamaIndex | RAG Framework | MIT | 12 | **High** — Document indexing and retrieval for agent context |
| OpenObserve | Observability | AGPL | 12 | **Medium** — Centralized logging, metrics, traces |
| Ollama | Local LLM Runtime | MIT | 13 | **Medium** — Privacy-sensitive local inference |
| Docling | Document Processing | MIT | 13 | **Medium** — Invoice/contract parsing with table extraction |
| Neo4j CE | Knowledge Graph | GPL | 13 | **Medium** — Client relationship mapping |
| LiteLLM | LLM Proxy | MIT | 14 | **Medium** — Multi-provider abstraction with fallback |
| Firecrawl | Web Scraping | AGPL | 14 | **Low** — Web content ingestion for RAG pipeline |

## Success Criteria

### V2-Specific User Success

| Metric | Target | Measurement |
|---|---|---|
| Automation Builder: NL workflow creation success rate | >70% on first attempt | Activepieces flow activation tracking |
| Automation Builder: time to first custom workflow | <5 minutes | Onboarding funnel |
| Semantic search relevance (user satisfaction) | >80% "found what I needed" | Search feedback tracking |
| Agent memory recall accuracy | >90% correct context retrieval | Mem0 hit/miss logging |
| Voice transcription accuracy (Whisper) | >95% WER on English | Transcription quality sampling |
| Notification delivery rate (Novu) | >99% within 30 seconds | Novu delivery logs |
| VA-created automations per workspace (month 3) | ≥3 active flows | Activepieces flow count per workspace |

### V2 Technical Success

| Metric | Target | Measurement |
|---|---|---|
| Vector search latency (p95) | <200ms for 100K vectors | Qdrant query monitoring |
| Mem0 memory retrieval latency (p95) | <500ms | Mem0 API monitoring |
| Activepieces flow execution success rate | >95% | Activepieces execution logs |
| Docker Compose cold start (full stack) | <120 seconds | CI health check |
| OpenObserve log ingestion latency | <5 seconds | OpenObserve metrics |
| Temporal workflow recovery time | <10 seconds after crash | Temporal replay monitoring |
| Infrastructure cost per workspace | <$2/mo additional | Monthly cost tracking |

## V2 Architecture

### Infrastructure Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                        EXISTING V1 STACK                        │
│  Next.js 15 ← Supabase (Postgres + Auth + Storage + RLS)       │
│  pg-boss ← Trigger.dev ← Vercel AI SDK ← Stripe ← Resend      │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┼──────────────────┐
              │      V2 INFRASTRUCTURE LAYER     │
              │         (Docker Compose)          │
              ├──────────────────────────────────┤
              │                                  │
              │  ┌──────────────┐  ┌────────────┐│
              │  │ Activepieces │  │  Qdrant    ││
              │  │ :8080        │  │  :6333     ││
              │  └──────────────┘  └────────────┘│
              │                                  │
              │  ┌──────────┐  ┌──────────────┐  │
              │  │  Mem0    │  │   Novu       │  │
              │  │ :8050    │  │   :3000      │  │
              │  └──────────┘  └──────────────┘  │
              │                                  │
              │  ┌──────────┐  ┌──────────────┐  │
              │  │ PostHog  │  │ OpenObserve  │  │
              │  │ :8000    │  │   :5080      │  │
              │  └──────────┘  └──────────────┘  │
              │                                  │
              │  ┌──────────┐  ┌──────────────┐  │
              │  │ Temporal │  │  Whisper     │  │
              │  │ :7233    │  │   :9000      │  │
              │  └──────────┘  └──────────────┘  │
              │                                  │
              │  ┌──────────┐  ┌──────────────┐  │
              │  │  Ollama  │  │  Neo4j CE    │  │
              │  │ :11434   │  │   :7474      │  │
              │  └──────────┘  └──────────────┘  │
              │                                  │
              │  ┌──────────┐  ┌──────────────┐  │
              │  │ LiteLLM  │  │  Firecrawl   │  │
              │  │ :4000    │  │   :3002      │  │
              │  └──────────┘  └──────────────┘  │
              │                                  │
              │  ┌──────────────────────────────┐│
              │  │   LlamaIndex (in-process)    ││
              │  │   Docling (in-process/API)   ││
              │  │   Hocuspocus (WebSocket)     ││
              │  └──────────────────────────────┘│
              └──────────────────────────────────┘
```

### Integration Patterns

**Pattern 1: Activepieces ↔ Flow OS (Embedded SDK + Webhook Bridge)**
Activepieces is embedded in Flow OS via its iframe SDK. Each workspace maps to an Activepieces "project" for tenant isolation. Flow OS emits workspace-scoped webhooks to Activepieces on agent signals (invoice overdue, email categorized, health score changed). Activepieces executes user-defined flows and calls back to Flow OS via authenticated API routes. The embed SDK handles connection management, flow builder UI, and execution history within Flow OS's UI shell.

**Pattern 2: Qdrant ↔ Agents (Embedding Pipeline)**
Agent outputs and client data are embedded via Vercel AI SDK embedding models and stored in Qdrant collections partitioned by `workspace_id`. Agents query Qdrant for semantic context before LLM invocation. Collection-level tenant isolation — one collection per workspace or filtered by `workspace_id` payload field.

**Pattern 3: Mem0 ↔ Agents (Memory Layer)**
Each agent call includes a `mem0.search(user_id, agent_id, query)` step to retrieve relevant memories. After agent execution, key decisions and preferences are stored via `mem0.add()`. Memory is scoped to `workspace_id + agent_id` for isolation.

**Pattern 4: Temporal ↔ pg-boss (Gradual Migration)**
New complex workflows (multi-step agent chains, long-running automations) use Temporal. Existing simple agent jobs remain on pg-boss. Both use the `AgentOrchestrator` seam — Temporal implements the same 4-method interface (`enqueue`, `dequeue`, `complete`, `fail`). Migration is per-workflow, not big-bang.

**Pattern 5: Natural Language → Activepieces Flow (Automation Builder)**
User describes automation in natural language → LLM (via Vercel AI SDK) generates an Activepieces flow definition using structured output (Zod schema matching Activepieces' piece/trigger/action model) → Flow OS validates the flow against allowed pieces and workspace permissions → flow is created via Activepieces REST API → activated and associated with the workspace's Activepieces project. For advanced users, the embedded Activepieces flow builder UI (iframe) is available for visual editing and refinement.

### Tenant Isolation Strategy (V2 Additions)

| Service | Isolation Method | Enforcement |
|---|---|---|
| Qdrant | `workspace_id` payload filter on every query | Middleware + collection-level ACL |
| Mem0 | `user_id` = `workspace_id:user_id` composite key | Mem0 SDK wrapper in `packages/memory` |
| Activepieces | One Activepieces "project" per workspace | Activepieces built-in project isolation + API key per project |
| Neo4j CE | `workspace_id` property on every node + Cypher query filter | Query builder enforces filter |
| PostHog | `workspace_id` as group property | PostHog group analytics |
| OpenObserve | `workspace_id` field in every log entry | Structured logging middleware |
| Temporal | Namespace per workspace (or `workspace_id` in workflow metadata) | Temporal namespace isolation |

## Functional Requirements (V2)

### Automation & Workflow (Activepieces)

- VFR1: Users can describe an automation in natural language and Flow OS generates a working Activepieces flow
- VFR2: Users can view, edit, activate, and deactivate their automations from within Flow OS via the embedded Activepieces builder
- VFR3: Users can browse a library of pre-built automation templates (e.g., "Chase overdue invoices", "Weekly client summary email", "Calendar conflict auto-resolve")
- VFR4: Automations execute within the user's workspace scope — each workspace maps to an isolated Activepieces project
- VFR5: Users can trigger automations manually or configure automatic triggers (time-based, webhook-based, agent-signal-based)
- VFR6: Failed automation executions surface in the agent inbox with error context and retry option
- VFR7: Users can connect to external services (Slack, Google Sheets, Trello) via Activepieces' 280+ built-in pieces
- VFR8: Automation execution history is visible with inputs, outputs, and duration per step
- VFR9: Activepieces flows can call Flow OS agents as steps via custom pieces (e.g., "run Inbox Agent categorization on this email")
- VFR10: Free tier limited to 3 active automations; Pro tier 20; Agency tier unlimited

### Semantic Search & RAG (Qdrant + LlamaIndex)

- VFR11: Users can search across all client data (emails, time entries, invoices, notes) using natural language queries
- VFR12: Agents automatically retrieve semantically relevant context before generating proposals
- VFR13: Client documents (PDFs, contracts, agreements) are automatically indexed for semantic search upon upload
- VFR14: Search results include relevance scores and source attribution
- VFR15: Users can scope semantic search to a specific client, date range, or data type
- VFR16: Embedding generation uses workspace-scoped queues to prevent resource contention

### Persistent Agent Memory (Mem0)

- VFR17: Agents remember VA preferences, client communication patterns, and past decisions across sessions
- VFR18: Users can view what each agent remembers and delete specific memories
- VFR19: Memory is scoped per workspace and per agent — no cross-workspace memory leakage
- VFR20: Agents cite memory sources when using recalled context ("Based on your preference from March 12...")
- VFR21: Memory storage respects GDPR — workspace deletion triggers full memory purge
- VFR22: Users can export agent memories as part of workspace data export

### Unified Notifications (Novu)

- VFR23: All agent notifications route through Novu for unified delivery (in-app, email, SMS, push)
- VFR24: Users can configure notification channels per event type (e.g., "urgent agent alerts → SMS + in-app", "weekly reports → email only")
- VFR25: Notification templates are workspace-branded for client-facing messages
- VFR26: Notification delivery status is tracked and visible to workspace admins
- VFR27: Novu replaces direct Resend calls for transactional email — Resend becomes a Novu provider

### Product Analytics (PostHog)

- VFR28: Agent performance metrics (approval rate, edit rate, failure rate) are tracked per workspace
- VFR29: Feature flags control rollout of V2 features per workspace/tier
- VFR30: User journey funnels track onboarding completion, automation creation, and trust progression
- VFR31: Session replay available for debugging UX issues (opt-in, privacy-respecting)
- VFR32: PostHog events respect workspace isolation — no cross-workspace analytics leakage

### Durable Workflow Orchestration (Temporal)

- VFR33: Multi-step agent chains (e.g., email → categorize → draft reply → schedule follow-up) execute as Temporal workflows with automatic retry on failure
- VFR34: Long-running automations (e.g., "follow up every 3 days until invoice paid") persist across server restarts
- VFR35: Users can view active Temporal workflows and cancel them from the UI
- VFR36: Temporal and pg-boss coexist — existing agent jobs are not disrupted
- VFR37: Temporal workflows respect trust gates — human approval steps pause workflow execution until resolved

### Voice Processing (Whisper)

- VFR38: Users can upload voice recordings (client calls, voice memos) for automatic transcription
- VFR39: Transcriptions are indexed in Qdrant for semantic search
- VFR40: Inbox Agent can process voice messages attached to emails
- VFR41: Transcription runs locally — no audio data sent to external APIs
- VFR42: Supported formats: MP3, WAV, M4A, OGG. Max duration: 60 minutes per file

### Real-Time Collaboration (Hocuspocus + Yjs)

- VFR43: Multiple VAs can co-edit client notes in real-time with conflict-free sync
- VFR44: Presence indicators show who is viewing/editing each client record
- VFR45: Offline edits sync automatically when reconnected
- VFR46: Collaborative editing respects member-client access scoping

### Observability (OpenObserve)

- VFR47: All agent executions emit structured logs to OpenObserve with correlation IDs
- VFR48: LLM cost per agent per workspace is tracked and queryable
- VFR49: Dashboard surfaces agent latency (p50, p95, p99), error rates, and cost trends
- VFR50: Alerts fire when agent failure rate exceeds 5% or latency exceeds SLO

### Local LLM Inference (Ollama)

- VFR51: Privacy-sensitive agent tasks (Client Health scoring, financial data analysis) can run on local models via Ollama
- VFR52: Users can configure which agent tasks use local vs. cloud models
- VFR53: Ollama integrates via the existing Vercel AI SDK provider abstraction
- VFR54: Local model performance is tracked alongside cloud models in OpenObserve

### Document Processing (Docling)

- VFR55: Users can upload invoices, contracts, and client documents for automatic structured extraction
- VFR56: Extracted tables, amounts, dates, and contact info are surfaced to relevant agents
- VFR57: AR Collection agent uses Docling to parse client invoice PDFs for payment matching
- VFR58: Extracted document data is indexed in Qdrant for semantic search

### Knowledge Graph (Neo4j CE)

- VFR59: Client relationships (client → VA → tasks → outcomes → invoices) are modeled as a graph
- VFR60: Client Health agent traverses the graph to detect risk patterns (e.g., "clients with decreasing task volume + overdue invoices")
- VFR61: Users can view a visual relationship map for each client
- VFR62: Graph queries power the "similar clients" and "recommended actions" features

### LLM Proxy (LiteLLM)

- VFR63: All LLM calls route through LiteLLM for unified cost tracking, rate limiting, and fallback
- VFR64: Auto-fallback: if Groq is down, requests route to Anthropic; if Anthropic is down, route to OpenAI
- VFR65: Per-workspace LLM budget enforcement at the proxy level
- VFR66: LiteLLM replaces direct provider SDK imports — agents call a single endpoint

### Web Content Ingestion (Firecrawl)

- VFR67: Agents can scrape client websites and competitor pages for context enrichment
- VFR68: Scraped content is converted to clean markdown and indexed in Qdrant
- VFR69: Scraping is rate-limited and respects robots.txt
- VFR70: Users can configure allowed domains per workspace

## Non-Functional Requirements (V2)

### Performance

- VNFR01: Semantic search (Qdrant) returns results in <200ms at 100K vectors per workspace (p95)
- VNFR02: Mem0 memory retrieval completes in <500ms (p95)
- VNFR03: Activepieces flow execution starts within <2s of trigger
- VNFR04: Whisper transcription processes at ≥1x real-time speed on CPU
- VNFR05: Temporal workflow step transitions complete in <1s (p95)
- VNFR06: Docling document parsing completes in <30s for a 10-page PDF
- VNFR07: LiteLLM proxy adds <50ms latency overhead to LLM calls (p95)

### Security & Isolation

- VNFR08: All V2 services communicate over internal Docker network — no public ports except reverse proxy
- VNFR09: Activepieces webhook endpoints are scoped to per-workspace projects with isolated API keys
- VNFR10: Qdrant collections enforce `workspace_id` filtering on every query — verified by automated test suite
- VNFR11: Mem0 memory data encrypted at rest
- VNFR12: Ollama runs in an isolated container with no network egress
- VNFR13: Neo4j queries are parameterized — no Cypher injection
- VNFR14: PostHog data collection is GDPR-compliant with opt-out capability

### Reliability

- VNFR15: Temporal workflows survive container restarts with full state recovery
- VNFR16: Activepieces flow executions are idempotent where possible (dedup key per trigger event)
- VNFR17: Qdrant data is backed up daily alongside Supabase backups
- VNFR18: OpenObserve retains logs for 30 days hot, 90 days cold (S3-compatible storage)
- VNFR19: All V2 services include health check endpoints monitored by Docker Compose

### Cost Governance

- VNFR20: Total V2 infrastructure cost tracked and reported weekly
- VNFR21: Ollama usage tracked to quantify cloud LLM cost savings
- VNFR22: Per-workspace resource consumption (vector count, memory entries, Activepieces executions) metered for future tier enforcement

## Epic Breakdown

### Epic 11: Intelligence Layer — Activepieces, Qdrant, Mem0, Novu, PostHog

The foundational V2 epic. Introduces the five highest-impact tools that transform agent capabilities and user experience. This epic must be completed before Epics 12-14.

**Dependencies:** Epic 2 (Agent Infrastructure & Trust System) must be complete. Epic 4 (Inbox Agent) should be complete for full Activepieces integration.

**VFRs covered:** VFR1-VFR32
**VNFRs covered:** VNFR01-VNFR03, VNFR08-VNFR11, VNFR14, VNFR16-VNFR17, VNFR20, VNFR22

#### Story 11.1: Docker Compose Infrastructure & Service Mesh

As a developer,
I want a Docker Compose configuration that bootstraps all V2 services with health checks, volume mounts, and internal networking,
So that the entire V2 stack can be started with a single command for local development and production deployment.

**Acceptance Criteria:**

**Given** a clean environment with Docker installed
**When** `docker compose -f docker-compose.v2.yml up -d` is executed
**Then** the following services start and pass health checks within 120 seconds: Activepieces (:8080), Qdrant (:6333), Novu (:3000), PostHog (:8000), Mem0 API
**And** all services communicate over an internal `flow-v2-network` bridge — no service exposes ports to the host except through the reverse proxy
**And** persistent volumes are mounted for Activepieces data, Qdrant storage, PostHog data, and Mem0 storage
**And** environment variables are loaded from `.env.v2` with sensible defaults for local development
**And** a `docker-compose.v2.override.yml` exists for production overrides (resource limits, restart policies)
**And** `pnpm dev:v2` starts both the Next.js dev server and the Docker Compose stack

```yaml
# docker-compose.v2.yml (Epic 11 services)
version: "3.9"

networks:
  flow-v2-network:
    driver: bridge

volumes:
  activepieces_data:
  ap_postgres_data:
  ap_redis_data:
  qdrant_storage:
  posthog_data:
  mem0_storage:
  novu_data:

services:
  activepieces:
    image: activepieces/activepieces:latest
    container_name: flow-activepieces
    restart: unless-stopped
    ports:
      - "8080:80"
    environment:
      - AP_ENGINE_EXECUTABLE_PATH=dist/packages/engine/main.js
      - AP_ENCRYPTION_KEY=${AP_ENCRYPTION_KEY}
      - AP_JWT_SECRET=${AP_JWT_SECRET}
      - AP_FRONTEND_URL=${AP_FRONTEND_URL:-http://localhost:8080}
      - AP_POSTGRES_DATABASE=${AP_POSTGRES_DATABASE:-activepieces}
      - AP_POSTGRES_HOST=ap-postgres
      - AP_POSTGRES_PORT=5432
      - AP_POSTGRES_USERNAME=${AP_POSTGRES_USERNAME:-activepieces}
      - AP_POSTGRES_PASSWORD=${AP_POSTGRES_PASSWORD}
      - AP_REDIS_HOST=ap-redis
      - AP_REDIS_PORT=6379
      - AP_SANDBOX_RUN_TIME_SECONDS=600
      - AP_TELEMETRY_ENABLED=false
      - AP_TEMPLATES_SOURCE_URL=${AP_TEMPLATES_URL:-}
    depends_on:
      ap-postgres:
        condition: service_healthy
      ap-redis:
        condition: service_healthy
    networks:
      - flow-v2-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:80/api/v1/flags"]
      interval: 30s
      timeout: 10s
      retries: 3

  ap-postgres:
    image: postgres:14
    container_name: flow-ap-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_DB=${AP_POSTGRES_DATABASE:-activepieces}
      - POSTGRES_USER=${AP_POSTGRES_USERNAME:-activepieces}
      - POSTGRES_PASSWORD=${AP_POSTGRES_PASSWORD}
    volumes:
      - ap_postgres_data:/var/lib/postgresql/data
    networks:
      - flow-v2-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${AP_POSTGRES_USERNAME:-activepieces}"]
      interval: 10s
      timeout: 5s
      retries: 5

  ap-redis:
    image: redis:7
    container_name: flow-ap-redis
    restart: unless-stopped
    volumes:
      - ap_redis_data:/data
    networks:
      - flow-v2-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  qdrant:
    image: qdrant/qdrant:latest
    container_name: flow-qdrant
    restart: unless-stopped
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_storage:/qdrant/storage
    environment:
      - QDRANT__SERVICE__API_KEY=${QDRANT_API_KEY}
    networks:
      - flow-v2-network
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:6333/readyz"]
      interval: 30s
      timeout: 10s
      retries: 3

  mem0:
    image: mem0ai/mem0:latest
    container_name: flow-mem0
    restart: unless-stopped
    ports:
      - "8050:8050"
    environment:
      - MEM0_API_KEY=${MEM0_API_KEY}
      - VECTOR_STORE_PROVIDER=qdrant
      - QDRANT_HOST=qdrant
      - QDRANT_PORT=6333
    volumes:
      - mem0_storage:/data
    depends_on:
      qdrant:
        condition: service_healthy
    networks:
      - flow-v2-network

  novu:
    image: ghcr.io/novuhq/novu:latest
    container_name: flow-novu
    restart: unless-stopped
    ports:
      - "3010:3000"
    environment:
      - NODE_ENV=production
      - MONGO_URL=${NOVU_MONGO_URL}
      - REDIS_HOST=${NOVU_REDIS_HOST:-localhost}
      - NOVU_SECRET=${NOVU_SECRET}
    volumes:
      - novu_data:/data
    networks:
      - flow-v2-network

  posthog:
    image: posthog/posthog:latest
    container_name: flow-posthog
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - SECRET_KEY=${POSTHOG_SECRET_KEY}
      - DATABASE_URL=${POSTHOG_DATABASE_URL}
      - REDIS_URL=${POSTHOG_REDIS_URL}
      - SITE_URL=${POSTHOG_SITE_URL:-http://localhost:8000}
    volumes:
      - posthog_data:/var/lib/posthog
    networks:
      - flow-v2-network
```

#### Story 11.2: Qdrant Vector Search Integration

As a developer,
I want a `packages/vector` package that wraps Qdrant with workspace-scoped collections, embedding generation, and semantic search,
So that all agents can retrieve semantically relevant context before generating proposals.

**Dependencies:** Story 11.1 must be completed.

**Acceptance Criteria:**

**Given** the Qdrant service is running
**When** the `packages/vector` package is initialized
**Then** it exports: `embedAndStore(workspaceId, content, metadata)`, `semanticSearch(workspaceId, query, options)`, `deleteByWorkspace(workspaceId)`, `getCollectionStats(workspaceId)`
**And** embeddings are generated via Vercel AI SDK's embedding API (provider: configurable, default: OpenAI `text-embedding-3-small`)
**And** every Qdrant point includes `workspace_id` in the payload — queries always filter by `workspace_id`
**And** a test asserts that Workspace A cannot retrieve Workspace B's vectors (cross-tenant isolation test, deploy-blocking)
**And** batch embedding supports up to 100 documents per call with automatic chunking (512 token chunks, 50 token overlap)
**And** `semanticSearch` returns results with relevance scores, source type, and source ID for attribution
**And** collection creation is lazy — first write for a workspace creates its collection
**And** the package has zero dependency on agent code — agents import from `@flow/vector`

#### Story 11.3: Mem0 Persistent Memory Integration

As a developer,
I want a `packages/memory` package that wraps Mem0 with workspace-scoped, agent-scoped persistent memory,
So that agents can remember VA preferences, client patterns, and past decisions across sessions.

**Dependencies:** Story 11.1 must be completed.

**Acceptance Criteria:**

**Given** the Mem0 service is running
**When** the `packages/memory` package is initialized
**Then** it exports: `remember(workspaceId, agentId, content, metadata)`, `recall(workspaceId, agentId, query, limit)`, `forget(workspaceId, agentId, memoryId)`, `forgetAll(workspaceId)`, `listMemories(workspaceId, agentId)`
**And** memory keys use composite format `{workspace_id}:{agent_id}:{user_id}` for scoping
**And** `forgetAll(workspaceId)` purges all memories for a workspace — called on workspace deletion for GDPR compliance
**And** a test asserts that Agent A's memories are not returned when Agent B calls `recall` (agent isolation)
**And** a test asserts that Workspace A's memories are not returned for Workspace B queries (tenant isolation, deploy-blocking)
**And** `recall` results include timestamps, source context, and confidence scores
**And** memory entries are capped at 1,000 per agent per workspace with LRU eviction
**And** the `listMemories` endpoint powers a UI where users can view and delete individual memories

#### Story 11.4: Activepieces Automation Engine Integration

As a developer,
I want Activepieces integrated as the embeddable automation backbone with workspace-scoped project isolation, webhook bridge, and embedded SDK connectivity,
So that users can create, manage, and monitor custom automations from within Flow OS.

**Dependencies:** Story 11.1 must be completed. Epic 2 (agent signal schema) must be complete.

**Acceptance Criteria:**

**Given** Activepieces is running and accessible via REST API and embed SDK
**When** the `packages/automations` package is initialized
**Then** it exports: `createProject(workspaceId)`, `createFlow(workspaceId, flowDefinition)`, `activateFlow(workspaceId, flowId)`, `deactivateFlow(flowId)`, `listFlows(workspaceId)`, `getExecutionHistory(flowId)`, `deleteFlow(flowId)`, `getEmbedToken(workspaceId)`
**And** each workspace maps to an isolated Activepieces project — created on first automation use via `createProject()`
**And** the Activepieces embed SDK is initialized with `getEmbedToken()` for iframe rendering of the flow builder within Flow OS
**And** Flow OS registers workspace-scoped webhook endpoints that Activepieces can call: `/api/webhooks/activepieces/{workspaceId}/{event}`
**And** Flow OS emits events to Activepieces via webhook triggers for: `agent.signal.created`, `invoice.overdue`, `client.health.changed`, `email.categorized`, `timer.stopped`, `trust.level.changed`
**And** a custom Activepieces piece (`@flow/activepieces-piece`) exposes Flow OS agent actions as steps: "Run Inbox Agent", "Run Calendar Agent", "Create Invoice", "Update Client Health"
**And** Activepieces API keys are stored encrypted in Supabase — one per workspace project
**And** flow count is enforced per tier: Free=3, Pro=20, Agency=unlimited
**And** failed Activepieces executions create an `agent_signal` record that surfaces in the agent inbox
**And** the embed iframe is styled to match Flow OS's design system (dark theme, Inter font) via Activepieces' theming API

#### Story 11.5: Natural Language Automation Builder

As a VA,
I want to describe an automation in plain English and have Flow OS create it for me,
So that I can build custom workflows without learning drag-and-drop tools or writing code.

**Dependencies:** Story 11.4 must be completed.

**Acceptance Criteria:**

**Given** a user is on the Automations page
**When** they type a natural language description like "When a client's invoice is overdue by 7 days, draft a follow-up email, create a calendar reminder for 3 days later, and flag the client health score"
**Then** Flow OS sends the description to the LLM with a system prompt containing: the Activepieces piece catalog (allowed pieces only), the workspace's connected services, and a Zod schema for valid Activepieces flow definition (trigger + actions)
**And** the LLM generates a valid Activepieces flow definition with trigger, action steps, and configuration
**And** the flow is validated against allowed pieces (no code-execution pieces for Free/Pro tiers)
**And** a preview is shown to the user with a step-by-step visual representation of the flow before activation
**And** the user can approve, edit (opens Activepieces embedded builder via iframe SDK), or reject the generated flow
**And** approved flows are created via Activepieces REST API and activated within the workspace's project
**And** the generation uses structured output (Zod) to guarantee valid JSON — fallback to retry with error context on validation failure (max 3 retries)
**And** a library of 10+ pre-built templates is available as starting points (seeded in Activepieces on first boot)
**And** the feature respects trust gates — flows that trigger agent actions inherit the workspace's trust level

#### Story 11.6: Novu Notification Infrastructure

As a developer,
I want all notifications routed through Novu for unified multi-channel delivery,
So that users get consistent, branded notifications across in-app, email, SMS, and push.

**Dependencies:** Story 11.1 must be completed.

**Acceptance Criteria:**

**Given** Novu is running
**When** the `packages/notifications` package is initialized
**Then** it exports: `notify(workspaceId, userId, event, payload)`, `getPreferences(userId)`, `updatePreferences(userId, prefs)`
**And** Novu replaces direct Resend calls — Resend becomes a Novu email provider
**And** notification templates exist for: agent proposal ready, trust level changed, invoice paid, invoice overdue, automation failed, workspace invitation, client portal notification
**And** users can configure per-event channel preferences (in-app, email, SMS) via a settings UI
**And** client-facing notifications use workspace branding (logo, colors) from workspace settings
**And** notification delivery status (sent, delivered, read) is tracked per event
**And** batch notification mode prevents alert fatigue — 10+ simultaneous agent proposals are grouped into a single digest

#### Story 11.7: PostHog Analytics Integration

As a developer,
I want PostHog integrated for product analytics, feature flags, and agent performance tracking,
So that we can measure V2 feature adoption, gate rollouts, and identify agent performance issues.

**Dependencies:** Story 11.1 must be completed.

**Acceptance Criteria:**

**Given** PostHog is running
**When** the analytics integration is configured
**Then** a `packages/analytics` package exports: `track(event, properties)`, `identify(userId, traits)`, `isFeatureEnabled(flag, userId)`, `getFeatureFlag(flag, userId)`
**And** server-side event tracking captures: agent runs (duration, cost, outcome), automation executions, semantic search queries, memory recalls, trust transitions, notification deliveries
**And** client-side tracking captures: page views, feature usage, onboarding progress, automation builder interactions
**And** all events include `workspace_id` as a group property for workspace-level analytics
**And** feature flags are seeded for V2 features: `v2-automation-builder`, `v2-semantic-search`, `v2-agent-memory`, `v2-voice-transcription`
**And** PostHog respects user opt-out preference (tracked in workspace settings)
**And** no PII (email, name) is sent to PostHog — only anonymized IDs

### Epic 12: Advanced Agent Capabilities — Temporal, Whisper, Yjs, LlamaIndex, OpenObserve

Upgrades agent execution infrastructure and adds voice processing, real-time collaboration, and observability. Builds on the intelligence layer from Epic 11.

**Dependencies:** Epic 11 must be complete.

**VFRs covered:** VFR33-VFR50
**VNFRs covered:** VNFR04-VNFR06, VNFR15-VNFR16, VNFR18-VNFR19

#### Story 12.1: Docker Compose Extension — Epic 12 Services

As a developer,
I want Docker Compose extended with Temporal, Whisper, Hocuspocus, and OpenObserve services,
So that Epic 12 infrastructure is available for development and production.

**Acceptance Criteria:**

**Given** the Epic 11 Docker Compose stack is running
**When** `docker compose -f docker-compose.v2.yml -f docker-compose.v2-epic12.yml up -d` is executed
**Then** additional services start: Temporal (:7233 + :8080 UI), faster-whisper API (:9000), Hocuspocus WebSocket (:1234), OpenObserve (:5080)
**And** Temporal uses the existing Supabase Postgres as its persistence store (separate schema)
**And** all services join the existing `flow-v2-network`
**And** health checks pass within 60 seconds for all new services

```yaml
# docker-compose.v2-epic12.yml
services:
  temporal:
    image: temporalio/auto-setup:latest
    container_name: flow-temporal
    restart: unless-stopped
    ports:
      - "7233:7233"
    environment:
      - DB=postgresql
      - DB_PORT=54322
      - POSTGRES_USER=${TEMPORAL_DB_USER:-postgres}
      - POSTGRES_PWD=${TEMPORAL_DB_PASSWORD}
      - POSTGRES_SEEDS=host.docker.internal
    networks:
      - flow-v2-network
    healthcheck:
      test: ["CMD", "tctl", "--address", "localhost:7233", "cluster", "health"]
      interval: 30s
      timeout: 10s
      retries: 5

  temporal-ui:
    image: temporalio/ui:latest
    container_name: flow-temporal-ui
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - TEMPORAL_ADDRESS=temporal:7233
    depends_on:
      temporal:
        condition: service_healthy
    networks:
      - flow-v2-network

  whisper:
    image: fedirz/faster-whisper-server:latest
    container_name: flow-whisper
    restart: unless-stopped
    ports:
      - "9000:8000"
    environment:
      - WHISPER__MODEL=Systran/faster-whisper-base.en
      - WHISPER__DEVICE=cpu
    networks:
      - flow-v2-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  openobserve:
    image: public.ecr.aws/zinclabs/openobserve:latest
    container_name: flow-openobserve
    restart: unless-stopped
    ports:
      - "5080:5080"
    environment:
      - ZO_ROOT_USER_EMAIL=${OPENOBSERVE_USER:-admin@flow.app}
      - ZO_ROOT_USER_PASSWORD=${OPENOBSERVE_PASSWORD:-changeme}
      - ZO_DATA_DIR=/data
    volumes:
      - openobserve_data:/data
    networks:
      - flow-v2-network
```

#### Story 12.2: Temporal Workflow Engine Integration

As a developer,
I want Temporal integrated as the durable workflow engine for complex multi-step agent chains,
So that long-running automations survive crashes, retry automatically, and support human-in-the-loop approval steps.

**Dependencies:** Story 12.1 must be completed. `AgentOrchestrator` seam from Epic 2 must exist.

**Acceptance Criteria:**

**Given** Temporal is running
**When** a `TemporalOrchestrator` class is created in `packages/orchestration/temporal.ts`
**Then** it implements the existing `AgentOrchestrator` interface (`enqueue`, `dequeue`, `complete`, `fail`)
**And** a factory function selects between `PgBossOrchestrator` and `TemporalOrchestrator` based on workflow complexity (simple single-step = pg-boss, multi-step/long-running = Temporal)
**And** Temporal workflows support `awaitHumanApproval(proposalId)` activity that pauses until the user approves/rejects in the agent inbox
**And** workflow definitions use the Temporal TypeScript SDK with explicit timeouts (30s per activity, 24h per workflow)
**And** Temporal namespace is `flow-{environment}` (e.g., `flow-development`, `flow-production`)
**And** workflow IDs include `workspace_id` for traceability
**And** a smoke test deploys a 3-step workflow, crashes the worker mid-execution, restarts, and verifies completion

#### Story 12.3: Whisper Voice Transcription Service

As a VA,
I want to upload voice recordings and get accurate transcriptions that are searchable alongside my other client data,
So that I can reference client call details without manual note-taking.

**Dependencies:** Story 12.1, Story 11.2 (Qdrant) must be completed.

**Acceptance Criteria:**

**Given** the Whisper service is running
**When** a user uploads an audio file (MP3, WAV, M4A, OGG, ≤60 min)
**Then** the file is sent to the faster-whisper API for transcription
**And** transcription output includes timestamped segments
**And** the full transcript is embedded and stored in Qdrant for semantic search
**And** transcription status is shown in real-time (queued → processing → complete)
**And** transcription runs locally — no audio data leaves the Docker network
**And** files >60 minutes are rejected with a clear error message
**And** transcription accuracy is ≥95% WER on clear English audio (validated against a 10-sample test set)

#### Story 12.4: LlamaIndex RAG Pipeline

As a developer,
I want a LlamaIndex-powered document ingestion and retrieval pipeline,
So that agents can query indexed client documents with semantic understanding.

**Dependencies:** Story 11.2 (Qdrant) must be completed.

**Acceptance Criteria:**

**Given** `packages/rag` is created
**When** a document is uploaded to a workspace
**Then** LlamaIndex processes it: chunking (512 tokens, 50 overlap) → embedding → Qdrant storage
**And** supported formats: PDF, DOCX, TXT, MD, HTML, CSV
**And** a `queryDocuments(workspaceId, query, filters)` function returns relevant chunks with source attribution
**And** agents can call `queryDocuments` during context assembly — before LLM invocation
**And** document indexing runs asynchronously via pg-boss job queue
**And** re-indexing a document replaces old vectors (dedup by document ID)
**And** the package integrates with Docling (Epic 13) for advanced PDF parsing when available, falling back to basic text extraction

#### Story 12.5: Hocuspocus + Yjs Real-Time Collaboration

As a VA team member,
I want to co-edit client notes with my teammates in real-time,
So that we stay in sync without overwriting each other's work.

**Dependencies:** Story 12.1 must be completed. BlockNote editor from V1 must be in place.

**Acceptance Criteria:**

**Given** Hocuspocus WebSocket server is running
**When** two users open the same client note
**Then** edits by either user appear for the other within 500ms
**And** presence cursors show each user's position and name
**And** offline edits merge automatically on reconnect via Yjs CRDT
**And** collaboration is scoped by member-client access — users without client access cannot join the document session
**And** Hocuspocus authenticates via Supabase JWT — token verified on WebSocket upgrade

#### Story 12.6: OpenObserve Observability Stack

As a developer,
I want centralized logging, metrics, and alerting for all V2 services,
So that I can debug agent failures, track costs, and monitor system health in one dashboard.

**Dependencies:** Story 12.1 must be completed.

**Acceptance Criteria:**

**Given** OpenObserve is running
**When** agents, Activepieces flows, and V2 services emit logs
**Then** structured JSON logs are shipped to OpenObserve via HTTP API
**And** every log entry includes: `workspace_id`, `agent_id` (if applicable), `correlation_id`, `timestamp`, `level`, `message`
**And** pre-built dashboards exist for: Agent Performance (latency, success rate, cost), LLM Usage (tokens, cost per provider), Activepieces Flows (execution count, failure rate), System Health (service uptime, error rates)
**And** alerts fire to Novu when: agent failure rate >5% for 15min, any service health check fails for 3 consecutive checks, daily LLM cost exceeds budget
**And** log retention: 30 days hot, 90 days cold storage

### Epic 13: Data Intelligence — Ollama, Docling, Neo4j CE

Adds local LLM inference for privacy, advanced document processing, and knowledge graph capabilities.

**Dependencies:** Epic 12 must be substantially complete (Temporal, Qdrant, OpenObserve operational).

**VFRs covered:** VFR51-VFR62
**VNFRs covered:** VNFR06, VNFR12-VNFR13, VNFR21

#### Story 13.1: Docker Compose Extension — Epic 13 Services

As a developer,
I want Docker Compose extended with Ollama, Docling API, and Neo4j Community Edition,
So that data intelligence services are available.

**Acceptance Criteria:**

**Given** the Epic 11+12 Docker Compose stack is running
**When** Epic 13 services are started
**Then** Ollama (:11434), Docling API (:3002), and Neo4j CE (:7474/:7687) are available
**And** Ollama pulls `llama3.2:3b` model on first boot (configurable via env var)
**And** Neo4j starts with APOC plugin enabled for graph algorithms
**And** all services join the existing `flow-v2-network`

```yaml
# docker-compose.v2-epic13.yml
services:
  ollama:
    image: ollama/ollama:latest
    container_name: flow-ollama
    restart: unless-stopped
    ports:
      - "11434:11434"
    volumes:
      - ollama_models:/root/.ollama
    networks:
      flow-v2-network:
    deploy:
      resources:
        limits:
          memory: 4G

  docling-api:
    image: ds4sd/docling-serve:latest
    container_name: flow-docling
    restart: unless-stopped
    ports:
      - "3002:5000"
    networks:
      - flow-v2-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  neo4j:
    image: neo4j:5-community
    container_name: flow-neo4j
    restart: unless-stopped
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      - NEO4J_AUTH=${NEO4J_USER:-neo4j}/${NEO4J_PASSWORD:-changeme}
      - NEO4J_PLUGINS=["apoc"]
    volumes:
      - neo4j_data:/data
    networks:
      - flow-v2-network
```

#### Story 13.2: Ollama Local LLM Integration

As a workspace owner,
I want privacy-sensitive agent tasks to run on local models without sending data to external APIs,
So that I can process confidential client data (financial info, health scores) without third-party exposure.

**Dependencies:** Story 13.1 must be completed. Vercel AI SDK provider abstraction must exist.

**Acceptance Criteria:**

**Given** Ollama is running with a downloaded model
**When** a user configures "local inference" for specific agent task types in workspace settings
**Then** those tasks route to Ollama instead of cloud providers via the Vercel AI SDK Ollama provider
**And** a configuration UI lets users choose per-task: "Cloud (faster, more capable)" vs. "Local (private, no external data transfer)"
**And** default configuration: Client Health scoring = local, financial summaries = local, email drafts = cloud, calendar scheduling = cloud
**And** local model performance (latency, quality score) is tracked in OpenObserve alongside cloud models
**And** Ollama has no network egress — container runs with `network_mode: internal` (only accessible from flow-v2-network)
**And** if Ollama is unavailable, tasks fall back to cloud provider with user notification

#### Story 13.3: Docling Document Processing Pipeline

As a VA,
I want to upload client invoices, contracts, and documents and have Flow OS automatically extract structured data,
So that my AR Collection agent can match payments and my agents have richer client context.

**Dependencies:** Story 13.1, Story 11.2 (Qdrant), Story 12.4 (LlamaIndex) must be completed.

**Acceptance Criteria:**

**Given** Docling API is running
**When** a user uploads a PDF or image document
**Then** Docling extracts: text content, table structures (as JSON arrays), key-value pairs (dates, amounts, contact info), document metadata
**And** extracted data is stored in Supabase (`document_extractions` table) linked to the source document
**And** extracted text and tables are embedded and indexed in Qdrant via the RAG pipeline
**And** AR Collection agent can query extracted invoice data (amount, due date, client name) for payment matching
**And** processing status is visible in the UI: uploaded → parsing → extracting → indexed → ready
**And** a 10-page PDF processes in <30 seconds
**And** table extraction accuracy is ≥90% on standard invoice formats (validated against 10-sample test set)

#### Story 13.4: Neo4j Knowledge Graph

As a developer,
I want client relationships modeled as a graph in Neo4j,
So that agents can traverse relationship patterns and power features like "similar clients" and risk detection.

**Dependencies:** Story 13.1 must be completed. Epic 3 (Client Management) must be complete.

**Acceptance Criteria:**

**Given** Neo4j CE is running
**When** a `packages/graph` package is created
**Then** it exports: `createNode(workspaceId, type, properties)`, `createRelationship(workspaceId, fromId, toId, type, properties)`, `query(workspaceId, cypherTemplate, params)`, `deleteWorkspaceGraph(workspaceId)`
**And** the following node types exist: `Client`, `VA`, `Task`, `Invoice`, `TimeEntry`, `AgentRun`, `Communication`
**And** relationships model: `VA -[:MANAGES]-> Client`, `Client -[:HAS_INVOICE]-> Invoice`, `AgentRun -[:GENERATED]-> Invoice`, `Client -[:COMMUNICATES_WITH]-> VA`
**And** every node has a `workspace_id` property — all Cypher queries include `WHERE n.workspace_id = $workspaceId` (enforced by query builder)
**And** a parameterized query prevents Cypher injection — no string concatenation in queries
**And** Client Health agent queries: `MATCH (c:Client)-[:HAS_INVOICE]->(i:Invoice) WHERE i.status = 'overdue' RETURN c, count(i)` with workspace filter
**And** graph sync runs as a pg-boss job triggered on relevant Supabase changes (new client, invoice created, payment received)
**And** `deleteWorkspaceGraph` removes all nodes/relationships for a workspace — called on workspace deletion

### Epic 14: Platform Optimization — LiteLLM, Firecrawl

Final optimization layer — unified LLM proxy and web content ingestion. These tools enhance existing capabilities rather than introducing new user-facing features.

**Dependencies:** Epic 11 must be complete. Epics 12-13 can be in progress.

**VFRs covered:** VFR63-VFR70
**VNFRs covered:** VNFR07, VNFR20-VNFR22

#### Story 14.1: LiteLLM Proxy Integration

As a developer,
I want all LLM calls routed through a LiteLLM proxy for unified cost tracking, fallback, and rate limiting,
So that provider outages don't break agents and cost tracking is centralized.

**Dependencies:** Epic 11 must be complete.

**Acceptance Criteria:**

**Given** LiteLLM proxy is running
**When** agents make LLM calls
**Then** requests route through LiteLLM at `http://litellm:4000/v1`
**And** LiteLLM is configured with all providers: Groq (fast tasks), Anthropic (quality tasks), Google (inbox/calendar), OpenAI (backup), Ollama (local)
**And** fallback chain: primary provider → secondary → OpenAI → Ollama (for applicable tasks)
**And** per-workspace budget limits are enforced: if a workspace exceeds its monthly LLM budget, agents queue proposals instead of executing
**And** cost per request is logged to OpenObserve with: `workspace_id`, `agent_id`, `model`, `input_tokens`, `output_tokens`, `cost_usd`
**And** LiteLLM replaces direct provider SDK imports in agent code — agents call the LiteLLM endpoint via Vercel AI SDK's OpenAI-compatible provider
**And** rate limiting: 60 requests/minute per workspace (configurable per tier)
**And** the existing `llm_cost_logs` table in Supabase is populated from LiteLLM's callback hooks

```yaml
# docker-compose.v2-epic14.yml
services:
  litellm:
    image: ghcr.io/berriai/litellm:main-latest
    container_name: flow-litellm
    restart: unless-stopped
    ports:
      - "4000:4000"
    environment:
      - LITELLM_MASTER_KEY=${LITELLM_MASTER_KEY}
      - DATABASE_URL=${LITELLM_DATABASE_URL}
    volumes:
      - ./litellm-config.yaml:/app/config.yaml
    command: ["--config", "/app/config.yaml"]
    networks:
      - flow-v2-network

  firecrawl:
    image: mendableai/firecrawl:latest
    container_name: flow-firecrawl
    restart: unless-stopped
    ports:
      - "3003:3002"
    environment:
      - FIRECRAWL_API_KEY=${FIRECRAWL_API_KEY}
    networks:
      - flow-v2-network
```

#### Story 14.2: Firecrawl Web Content Ingestion

As a developer,
I want agents to scrape web content and ingest it into the RAG pipeline,
So that client context includes relevant web information (client websites, industry news, competitor pages).

**Dependencies:** Story 11.2 (Qdrant), Story 12.4 (LlamaIndex) must be completed.

**Acceptance Criteria:**

**Given** Firecrawl is running
**When** a `packages/scraper` package is created
**Then** it exports: `scrapeUrl(url, options)`, `scrapeAndIndex(workspaceId, url, metadata)`
**And** `scrapeUrl` converts any web page to clean markdown, preserving structure (headings, lists, tables)
**And** `scrapeAndIndex` scrapes → chunks → embeds → stores in Qdrant with `source_url` and `workspace_id`
**And** scraping respects `robots.txt` — URLs that disallow scraping are rejected
**And** rate limiting: max 10 scrapes per workspace per hour
**And** users can configure allowed domains per workspace — scraping outside allowed domains requires explicit approval
**And** scraped content is sanitized (no scripts, no tracking pixels) before storage

## Database Schema Changes (V2)

### New Tables

```sql
-- V2 Migration: Automation workflows metadata
CREATE TABLE automation_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  activepieces_flow_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  natural_language_prompt TEXT,
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error')),
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('manual', 'schedule', 'event', 'agent_signal')),
  trigger_config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES users(id)
);

-- RLS: workspace members only
ALTER TABLE automation_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_members_automation_workflows"
  ON automation_workflows FOR ALL
  USING (workspace_id::text = (auth.jwt() ->> 'workspace_id')::text);

-- V2 Migration: Document extractions from Docling
CREATE TABLE document_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_document_id UUID NOT NULL,
  extraction_type TEXT NOT NULL CHECK (extraction_type IN ('text', 'table', 'key_value', 'metadata')),
  content JSONB NOT NULL,
  confidence REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE document_extractions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_members_document_extractions"
  ON document_extractions FOR ALL
  USING (workspace_id::text = (auth.jwt() ->> 'workspace_id')::text);

-- V2 Migration: Voice transcriptions
CREATE TABLE voice_transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_file_path TEXT NOT NULL,
  transcript TEXT NOT NULL,
  segments JSONB NOT NULL DEFAULT '[]',
  duration_seconds INTEGER NOT NULL,
  language TEXT NOT NULL DEFAULT 'en',
  model_used TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES users(id)
);

ALTER TABLE voice_transcriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "workspace_members_voice_transcriptions"
  ON voice_transcriptions FOR ALL
  USING (workspace_id::text = (auth.jwt() ->> 'workspace_id')::text);

-- V2 Migration: Notification preferences (Novu)
CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  channels JSONB NOT NULL DEFAULT '{"in_app": true, "email": true, "sms": false, "push": false}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, workspace_id, event_type)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_notification_preferences"
  ON notification_preferences FOR ALL
  USING (user_id = auth.uid());
```

### New Packages

| Package | Location | Purpose | Dependencies |
|---|---|---|---|
| `packages/vector` | Vector search wrapper | Qdrant client, embedding, semantic search | `@qdrant/js-client-rest`, `@flow/types` |
| `packages/memory` | Agent memory layer | Mem0 SDK wrapper, workspace-scoped memory | `mem0`, `@flow/types` |
| `packages/automations` | Workflow automation | Activepieces API client, embed SDK, webhook bridge | `@activepieces/embed-sdk`, `@flow/types`, `@flow/db` |
| `packages/notifications` | Notification infrastructure | Novu SDK wrapper, template management | `@novu/node`, `@flow/types` |
| `packages/analytics` | Product analytics | PostHog SDK wrapper, feature flags | `posthog-node`, `@flow/types` |
| `packages/rag` | Document retrieval | LlamaIndex integration, chunking, indexing | `llamaindex`, `@flow/vector` |
| `packages/graph` | Knowledge graph | Neo4j driver wrapper, query builder | `neo4j-driver`, `@flow/types` |
| `packages/scraper` | Web content ingestion | Firecrawl client, content sanitization | `@flow/vector`, `@flow/rag` |

## Rollout Strategy

### Phase 1: Epic 11 (Weeks 1-6)

Deploy Activepieces, Qdrant, Mem0, Novu, PostHog. Gate behind `v2-intelligence-layer` feature flag. Internal dogfooding for 2 weeks before gradual rollout to Agency tier, then Pro, then Free.

**Milestone:** First VA creates a natural language automation that successfully executes.

### Phase 2: Epic 12 (Weeks 7-12)

Deploy Temporal, Whisper, Hocuspocus, LlamaIndex, OpenObserve. Temporal runs alongside pg-boss — no migration pressure. Voice transcription available behind `v2-voice` flag.

**Milestone:** First multi-step Temporal workflow completes with a human approval step mid-flow.

### Phase 3: Epic 13 (Weeks 13-16)

Deploy Ollama, Docling, Neo4j. Ollama opt-in per workspace. Docling enhances existing document upload flow. Neo4j populates in background from existing data.

**Milestone:** Client Health agent uses graph traversal to detect a risk pattern that keyword search would miss.

### Phase 4: Epic 14 (Weeks 17-18)

Deploy LiteLLM, Firecrawl. LiteLLM becomes the LLM gateway — all providers route through it. Firecrawl available for Agency tier.

**Milestone:** LiteLLM auto-fallback successfully routes around a provider outage with zero user-visible impact.

## Risk Register

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| Docker Compose complexity (12+ services) | High ops burden | Medium | Layered compose files per epic; health checks; monitoring via OpenObserve; single `pnpm dev:v2` command |
| Activepieces flow generation fails (LLM hallucination) | Broken automations | Medium | Zod schema validation, 3 retry attempts, template library as fallback, preview before activation |
| Qdrant vector isolation breach | Cross-tenant data leak (P0) | Low | `workspace_id` filter on every query, automated cross-tenant test suite, deploy-blocking CI gate |
| Mem0 memory corruption/stale data | Agent makes wrong decisions | Medium | Memory TTL (90 days default), user-visible memory management UI, confidence scores on recall |
| Temporal learning curve for team | Slow Epic 12 delivery | Medium | Start with 2-3 simple workflows, keep pg-boss for existing jobs, Temporal TypeScript SDK is well-documented |
| Infrastructure cost creep | Exceeds $80/mo target | Low | Per-service resource limits in Docker Compose, weekly cost tracking, Ollama offloads some LLM costs |
| Whisper CPU performance on large files | Slow transcription | Medium | 60-minute file limit, async processing via job queue, option to use `base.en` model for speed vs. `large-v3` for quality |

## Production Deployment Architecture

### Infrastructure Layout

```
                    ┌─────────────────────────────┐
                    │       Cloudflare CDN         │
                    │   (DNS, WAF, DDoS, SSL)      │
                    └──────────┬──────────────────┘
                               │
              ┌────────────────┼────────────────────┐
              │                │                    │
     ┌────────▼────────┐  ┌───▼──────────┐  ┌──────▼──────┐
     │  Vercel          │  │ Supabase     │  │ VPS         │
     │  (Next.js app)   │  │ Cloud        │  │ (Docker)    │
     │                  │  │              │  │             │
     │  - SSR/RSC       │  │  - Postgres  │  │ Caddy       │
     │  - Server        │  │  - Auth      │  │ (reverse    │
     │    Actions       │  │  - Storage   │  │  proxy)     │
     │  - API Routes    │  │  - RLS       │  │     │       │
     │  - Edge          │  │  - Realtime  │  │     ├─ AP   │
     │    Middleware     │  │              │  │     ├─ Qdrt │
     │                  │  └──────────────┘  │     ├─ Mem0 │
     │  Connects to:    │                    │     ├─ Temp │
     │  ├─ Supabase ←───┼────────────────────┤     ├─ LLM │
     │  ├─ Stripe       │                    │     ├─ O2  │
     │  ├─ Resend       │                    │     ├─ Whsp │
     │  └─ VPS (internal)────────────────────┤     └─ Novu │
     └─────────────────┘                     └─────────────┘
```

### Tier 1 — Managed Services (zero ops)

| Service | Provider | Cost | Rationale |
|---|---|---|---|
| Next.js app | Vercel Pro | $20/mo | Zero-config deployment, edge middleware, preview deploys |
| Database + Auth + Storage | Supabase Pro | $25/mo | Managed Postgres, RLS, Auth, Storage, Realtime — already in V1 |
| Payments | Stripe | Transaction fees | Already in V1 — no change |
| Email delivery | Resend (via Novu) | Free tier → $20/mo | Novu handles routing, Resend handles delivery |

### Tier 2 — Self-Hosted V2 Services (single VPS)

| Service | Container | RAM | Disk | Port |
|---|---|---|---|---|
| Caddy (reverse proxy) | flow-caddy | 64MB | — | 443 |
| Activepieces | flow-activepieces | 1GB | 2GB | 8080 |
| Activepieces Postgres | flow-ap-postgres | 512MB | 5GB | 5432 (internal) |
| Activepieces Redis | flow-ap-redis | 256MB | 1GB | 6379 (internal) |
| Qdrant | flow-qdrant | 1GB | 10GB+ | 6333 |
| Mem0 | flow-mem0 | 512MB | 2GB | 8050 |
| Temporal | flow-temporal | 1GB | 2GB | 7233 |
| LiteLLM | flow-litellm | 256MB | — | 4000 |
| OpenObserve | flow-openobserve | 512MB | 20GB | 5080 |
| Whisper | flow-whisper | 2GB | 1GB | 9000 |
| Novu | flow-novu | 512MB | 2GB | 3010 |
| **Total** | | **~8GB** | **~45GB** | |

**Recommended VPS:** Hetzner CX41 (4 vCPU, 16GB RAM, 160GB disk) — ~€15/mo. Or DigitalOcean Premium Droplet (4 vCPU, 16GB RAM) — $68/mo.

### Tier 3 — Scale-Later Services

These are deployed only when needed, onto the same VPS (if headroom) or a second VPS:

| Service | Trigger to Deploy | Additional RAM |
|---|---|---|
| Neo4j CE | Client Health agent needs graph traversal | 1GB |
| Ollama | Workspace requests local inference | 4GB+ (needs dedicated VPS) |
| Docling | AR Collection needs invoice parsing | 1GB |
| Firecrawl | Agency tier requests web scraping | 512MB |

### Networking & Security

**Internal communication:** All V2 services talk over a private Docker bridge network (`flow-v2-network`). Only Caddy exposes ports 80/443 to the internet.

**Vercel → VPS connection:** Next.js Server Actions and API routes call V2 services via the VPS's internal API endpoint (e.g., `https://v2.flow-internal.app`). Authenticated via a shared secret in the `Authorization` header. The VPS Caddy config only accepts requests with this secret — no public access to individual services.

**VPS firewall (ufw):**
```bash
# Only allow SSH + HTTPS
ufw default deny incoming
ufw allow 22/tcp    # SSH
ufw allow 443/tcp   # Caddy (HTTPS)
ufw allow 80/tcp    # Caddy (HTTP → redirect to HTTPS)
ufw enable
```

**Caddy reverse proxy config:**
```
v2.flow-internal.app {
  @authorized header Authorization "Bearer {$V2_INTERNAL_SECRET}"

  handle /activepieces/* {
    reverse_proxy flow-activepieces:80
  }
  handle /qdrant/* {
    reverse_proxy flow-qdrant:6333
  }
  handle /temporal/* {
    reverse_proxy flow-temporal:7233
  }
  handle /llm/* {
    reverse_proxy flow-litellm:4000
  }
  handle /observe/* {
    reverse_proxy flow-openobserve:5080
  }

  handle {
    respond @authorized 404
    respond 401
  }
}
```

### Estimated Monthly Cost at Launch

| Service | Cost |
|---|---|
| Vercel Pro | $20/mo |
| Supabase Pro | $25/mo |
| Hetzner VPS (CX41, 16GB) | ~$16/mo |
| Domain + Cloudflare | $0 (free tier) |
| LLM API (per active workspace) | ~$15-25/mo |
| **Total fixed infrastructure** | **~$61/mo** |
| **Per-workspace variable** | **~$15-25/mo LLM** |

### Scaling Triggers

| Workspace Count | Action |
|---|---|
| 1-30 | Single VPS handles everything |
| 30-80 | Upgrade VPS to 8 vCPU / 32GB RAM (~$30/mo) |
| 80-200 | Split: VPS-1 (Activepieces, Temporal, Qdrant), VPS-2 (Whisper, OpenObserve, Novu) |
| 200+ | Migrate to Kubernetes (k3s) or managed container service. Qdrant and Temporal support clustering. |
| Privacy-sensitive workspaces | Dedicated VPS for Ollama (4GB+ RAM GPU optional) |

### Backup Strategy

| Data | Method | Frequency | Retention |
|---|---|---|---|
| Supabase (primary DB) | Supabase built-in backups | Daily | 7 days (Pro plan) |
| Qdrant vectors | Volume snapshot → S3-compatible storage | Daily | 30 days |
| Activepieces Postgres | pg_dump → S3-compatible storage | Daily | 30 days |
| Mem0 data | Volume snapshot → S3-compatible storage | Daily | 30 days |
| Temporal persistence | Shared Postgres — covered by DB backup | Daily | 30 days |
| OpenObserve logs | Hot 30 days, cold to S3 | Automatic | 90 days |

### CI/CD Pipeline

```
GitHub Push → Vercel (Next.js auto-deploy)
           → GitHub Actions:
               ├─ Build + Test + Lint (existing V1 pipeline)
               ├─ V2 Integration Tests:
               │   ├─ Qdrant cross-tenant isolation test (deploy-blocking)
               │   ├─ Mem0 workspace isolation test (deploy-blocking)
               │   ├─ Activepieces project isolation test
               │   └─ Temporal workflow smoke test
               └─ Deploy to VPS (via SSH + docker compose pull + restart)
```

## Appendix: Environment Variables (.env.v2)

```env
# === Activepieces ===
AP_ENCRYPTION_KEY=        # openssl rand -hex 16
AP_JWT_SECRET=            # openssl rand -hex 32
AP_FRONTEND_URL=http://localhost:8080
AP_POSTGRES_DATABASE=activepieces
AP_POSTGRES_USERNAME=activepieces
AP_POSTGRES_PASSWORD=     # openssl rand -hex 16
AP_TEMPLATES_URL=

# === Qdrant ===
QDRANT_API_KEY=
QDRANT_URL=http://localhost:6333

# === Mem0 ===
MEM0_API_KEY=

# === Novu ===
NOVU_SECRET=
NOVU_MONGO_URL=
NOVU_REDIS_HOST=localhost

# === PostHog ===
POSTHOG_SECRET_KEY=
POSTHOG_DATABASE_URL=
POSTHOG_REDIS_URL=
POSTHOG_SITE_URL=http://localhost:8000

# === Temporal ===
TEMPORAL_DB_USER=postgres
TEMPORAL_DB_PASSWORD=

# === OpenObserve ===
OPENOBSERVE_USER=admin@flow.app
OPENOBSERVE_PASSWORD=

# === Ollama ===
OLLAMA_MODEL=llama3.2:3b

# === Neo4j ===
NEO4J_USER=neo4j
NEO4J_PASSWORD=

# === LiteLLM ===
LITELLM_MASTER_KEY=
LITELLM_DATABASE_URL=

# === Firecrawl ===
FIRECRAWL_API_KEY=

# === Embedding ===
EMBEDDING_PROVIDER=openai
EMBEDDING_MODEL=text-embedding-3-small

# === Production (VPS) ===
V2_INTERNAL_SECRET=       # Shared secret for Vercel → VPS auth
V2_VPS_HOST=              # e.g., v2.flow-internal.app
CADDY_DOMAIN=             # e.g., v2.flow-internal.app
```
