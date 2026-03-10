# Design Write-up

## Architecture

The system is split into a Python/FastAPI backend and a Next.js frontend, connected by a REST API with a SQLite database in between. This separation was deliberate: Python has the strongest ecosystem for AI/LLM tooling (OpenAI SDK, Tavily client), while Next.js with shadcn/ui and Recharts delivers a polished dashboard fastest within the time constraint.

The enrichment pipeline follows a straightforward flow: CSV upload → org-level deduplication → Tavily web search (2-3 queries per org) → single GPT-4o scoring call with structured JSON output → post-LLM validation → composite score computation → persist to SQLite.

## Key Design Decisions

**Org-level deduplication.** The CSV contains 100 contacts across ~70 unique organizations. Enrichment data (web search, AI scoring for Dimensions 1, 3, 4) is stored on the organization, not the contact. Multiple contacts at the same org share one enrichment, cutting API calls by ~30%. Composite scores still differ per contact because Dimension 2 (Relationship Depth) varies individually.

**Single LLM call per org.** Rather than separate "summarize search results" and "score the summary" calls, I combine both into one GPT-4o request. This halves OpenAI costs and avoids information loss from intermediate summarization — the model reasons about raw evidence while scoring.

**Rule-based search query generation.** Instead of using an LLM to generate Tavily search queries, I use org-type-specific templates. Foundations get queries targeting their investment offices; RIA/FIAs get queries checking whether they're service providers or allocators. This saves one LLM call per org (~70 calls) with no loss in search quality, since the query patterns are predictable.

**Calibration anchors embedded in the scoring prompt.** The prompt includes 4 reference organizations (Rockefeller Foundation, PBUCC, Inherent Group, Meridian Capital) with their expected scores and reasoning. This grounds the model's scoring scale and prevents drift — without anchors, LLMs tend to cluster scores in the 5-7 range.

**Post-LLM validation layer.** After GPT-4o returns scores, rule-based checks catch anomalies: GP/service providers scoring above 3 on Sector Fit are overridden; Foundations/Pensions scoring unusually low are flagged for manual review; low-confidence + high-score combinations are flagged as unreliable. This adds a safety net that pure prompt engineering cannot guarantee.

**Structured JSON output via OpenAI's `response_format`.** Using a JSON schema ensures every response is parseable- no regex extraction, no retry loops for malformed output. Each dimension includes a score, confidence (0-1), reasoning, and key evidence list.

## Tradeoffs

**SQLite over PostgreSQL.** SQLite is zero-config and file-based, making the prototype trivially portable for demo purposes. The tradeoff is no concurrent write support, but with sequential org processing, this is not a bottleneck. For production, Postgres would be the clear choice.

**Sequential enrichment over parallel.** Orgs are processed one at a time with a 1-second delay between calls. This simplifies error handling and respects API rate limits, but means ~70 orgs take 5-7 minutes. With asyncio.gather and a semaphore, this could be reduced to ~1 minute.

**shadcn/ui for frontend velocity.** Pre-built components (tables, badges, cards) saved significant development time. The tradeoff is a conventional look, but for a fundraising team tool, clarity and usability matter more than visual novelty.

**Cost over comprehensiveness in search.** I cap Tavily searches at 2-3 per org with 5 results each. More searches would yield better coverage for obscure organizations, but the marginal improvement doesn't justify the cost increase at scale. The confidence score signals when evidence is thin.

## What I'd Improve With More Time

1. **Parallel enrichment** — asyncio.gather with a semaphore (5-10 concurrent) to reduce wall-clock time from ~5min to ~1min
2. **Search result caching** — Avoid re-searching orgs on re-runs; cache Tavily results with a TTL
3. **Manual score override** — Let the fundraising team adjust scores with reasoning, persisted alongside AI scores
4. **Export to CSV/Excel** — Download scored pipeline for CRM import or offline review
5. **Prompt versioning** — Store prompt versions alongside scores so results are reproducible and comparable across prompt iterations
6. **Smarter deduplication** — Fuzzy org name matching (e.g., "PBUCC" vs "Pension Boards United Church of Christ") rather than exact string match
7. **Webhook/email notifications** — Alert when enrichment completes or when high-priority prospects are identified
