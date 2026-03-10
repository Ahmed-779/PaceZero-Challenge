# PaceZero LP Prospect Enrichment & Scoring Engine

An AI-powered system that ingests LP prospect contacts, enriches them with public web data, scores them across 4 dimensions, and presents results in an interactive dashboard for fundraising prioritization.

## Architecture

```
Next.js Dashboard  →  FastAPI Backend  →  SQLite DB
                          ↓      ↓
                       Tavily   OpenAI GPT-4o
                      (search)   (scoring)
```

- **Backend**: Python 3.11+ / FastAPI / SQLAlchemy / aiosqlite
- **Frontend**: Next.js 14 / Tailwind CSS / shadcn/ui / Recharts
- **AI**: OpenAI GPT-4o (structured JSON output) + Tavily (web search)
- **Database**: SQLite (zero-config, file-based)

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- OpenAI API key
- Tavily API key (free tier at [tavily.com](https://tavily.com))

### 1. Clone and configure

```bash
cd PaceZero
cp .env.example .env
# Edit .env with your API keys:
#   OPENAI_API_KEY=sk-...
#   TAVILY_API_KEY=tvly-...
```

### 2. Start the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

### 4. Use the app

1. Open http://localhost:3000
2. Go to **Upload** → upload `challenge_contacts.csv`
3. Click **Start Enrichment** → watch progress on Dashboard
4. Browse scored prospects in the **Prospects** table
5. Click any contact for detailed score breakdown with reasoning

## Scoring Dimensions

| Dimension | Weight | Source |
|-----------|--------|--------|
| D1 — Sector & Mandate Fit | 35% | AI-enriched (web search + GPT-4o) |
| D2 — Relationship Depth | 30% | Pre-computed from CSV |
| D3 — Halo & Strategic Value | 20% | AI-enriched |
| D4 — Emerging Manager Fit | 15% | AI-enriched |

**Composite** = (D1 × 0.35) + (D2 × 0.30) + (D3 × 0.20) + (D4 × 0.15)

**Tiers**: ≥8.0 PRIORITY CLOSE · ≥6.5 STRONG FIT · ≥5.0 MODERATE FIT · <5.0 WEAK FIT

## Key Design Decisions

### Org-level deduplication
Enrichment runs once per unique organization (~70), not per contact (100). Multiple contacts at the same org share enrichment data. Composite scores differ per contact because D2 (Relationship Depth) varies individually.

### Single LLM call per org
Web search results and scoring are processed in a single GPT-4o call with structured JSON output, rather than separate summarization and scoring steps. This halves API costs and avoids information loss from intermediate summarization.

### Rule-based search query generation
Tavily search queries are generated using org-type-specific templates (Foundations get queries about investment offices; RIA/FIAs get queries checking if they're service providers vs allocators). This saves one LLM call per org.

### Calibration anchors in prompt
The scoring prompt includes 4 calibration anchor organizations with expected scores, ensuring the model produces well-calibrated outputs across the scoring range.

### Post-LLM validation layer
After scoring, rule-based validation catches anomalies: GP/service providers that scored too high on Sector Fit are overridden; Foundations/Pensions scoring unexpectedly low are flagged for review; low-confidence + high-score combinations are flagged as unreliable.

## Cost Estimation

For 100 contacts (~70 unique orgs):
- Tavily: ~150 advanced searches → **free on Tavily free tier** (~$2.50 on paid)
- OpenAI: ~2K input + 500 output tokens per org → **~$0.70**
- **Total: under $1 per run** (free Tavily tier)
- **Projected for 1,000 prospects: ~$12**

## What I'd Improve With More Time

1. **Parallel enrichment** — Process multiple orgs concurrently (asyncio.gather with semaphore) to reduce wall-clock time from ~5min to ~1min for 70 orgs
2. **Caching layer** — Cache Tavily search results to avoid re-searching on re-runs
3. **Manual score override** — Allow fundraising team to adjust scores with reasoning
4. **Export to CSV** — Download scored results for use in CRM
5. **Authentication** — Add user auth for the dashboard
6. **Prompt A/B testing** — Store prompt versions and compare scoring distributions
7. **More granular confidence** — Per-evidence-item relevance scoring
