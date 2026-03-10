import asyncio
import logging

from tavily import AsyncTavilyClient

from app.config import settings

logger = logging.getLogger(__name__)


def generate_search_queries(org_name: str, org_type: str) -> list[str]:
    """Generate 2-3 targeted search queries based on org name and type."""
    queries = [
        f'"{org_name}" investment strategy private credit sustainability ESG allocations',
        f'"{org_name}" fund investments alternative assets emerging managers',
    ]

    if org_type in ("Foundation", "Endowment", "Pension"):
        queries.append(
            f'"{org_name}" investment office CIO external fund managers allocations'
        )
    elif "Family Office" in org_type:
        queries.append(
            f'"{org_name}" family office portfolio impact investing direct lending'
        )
    elif org_type in ("RIA/FIA", "Asset Manager", "Private Capital Firm"):
        queries.append(
            f'"{org_name}" assets under management advisory fund allocation clients'
        )
    elif org_type == "Fund of Funds":
        queries.append(
            f'"{org_name}" fund of funds manager selection private debt credit'
        )

    return queries[:3]


async def search_organization(org_name: str, org_type: str) -> dict:
    """Run Tavily web searches for an organization and aggregate results."""
    client = AsyncTavilyClient(api_key=settings.TAVILY_API_KEY)
    queries = generate_search_queries(org_name, org_type)

    all_results = []
    all_sources = []
    search_count = 0

    for query in queries:
        try:
            response = await client.search(
                query=query,
                search_depth="advanced",
                max_results=5,
                include_answer=True,
            )
            search_count += 1

            if response.get("answer"):
                all_results.append(f"AI Summary for query '{query}':\n{response['answer']}")

            for result in response.get("results", []):
                title = result.get("title", "")
                content = result.get("content", "")
                url = result.get("url", "")
                all_results.append(f"Source: {title}\nURL: {url}\n{content}")
                if url:
                    all_sources.append(url)

            # Rate limiting between searches
            await asyncio.sleep(0.5)

        except Exception as e:
            logger.warning(f"Tavily search failed for query '{query}': {e}")
            continue

    # Deduplicate sources
    unique_sources = list(dict.fromkeys(all_sources))

    return {
        "search_context": "\n\n---\n\n".join(all_results) if all_results else "No search results found.",
        "sources": unique_sources,
        "search_count": search_count,
    }
