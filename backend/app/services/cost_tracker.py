from app.config import settings


def estimate_cost(
    tavily_searches: int,
    openai_input_tokens: int,
    openai_output_tokens: int,
) -> dict:
    tavily_cost = tavily_searches * settings.TAVILY_COST_PER_SEARCH
    openai_cost = (
        (openai_input_tokens / 1000) * settings.GPT4O_INPUT_COST_PER_1K
        + (openai_output_tokens / 1000) * settings.GPT4O_OUTPUT_COST_PER_1K
    )
    return {
        "tavily_searches": tavily_searches,
        "tavily_cost_usd": round(tavily_cost, 6),
        "openai_input_tokens": openai_input_tokens,
        "openai_output_tokens": openai_output_tokens,
        "openai_cost_usd": round(openai_cost, 6),
        "total_cost_usd": round(tavily_cost + openai_cost, 6),
    }
