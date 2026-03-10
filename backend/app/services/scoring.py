import json
import logging

from openai import AsyncOpenAI

from app.config import settings
from app.prompts.scoring import SCORING_SYSTEM_PROMPT, SCORING_USER_PROMPT
from app.schemas import EnrichmentResult

logger = logging.getLogger(__name__)

client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

ENRICHMENT_JSON_SCHEMA = {
    "name": "enrichment_result",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "organization_summary": {"type": "string"},
            "is_gp_or_service_provider": {"type": "boolean"},
            "gp_service_provider_reasoning": {"type": "string"},
            "estimated_aum": {"type": ["string", "null"]},
            "estimated_check_size": {"type": ["string", "null"]},
            "sector_fit": {
                "type": "object",
                "properties": {
                    "score": {"type": "number"},
                    "confidence": {"type": "number"},
                    "reasoning": {"type": "string"},
                    "key_evidence": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["score", "confidence", "reasoning", "key_evidence"],
                "additionalProperties": False,
            },
            "halo_strategic_value": {
                "type": "object",
                "properties": {
                    "score": {"type": "number"},
                    "confidence": {"type": "number"},
                    "reasoning": {"type": "string"},
                    "key_evidence": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["score", "confidence", "reasoning", "key_evidence"],
                "additionalProperties": False,
            },
            "emerging_manager_fit": {
                "type": "object",
                "properties": {
                    "score": {"type": "number"},
                    "confidence": {"type": "number"},
                    "reasoning": {"type": "string"},
                    "key_evidence": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["score", "confidence", "reasoning", "key_evidence"],
                "additionalProperties": False,
            },
            "web_sources_used": {"type": "array", "items": {"type": "string"}},
        },
        "required": [
            "organization_summary",
            "is_gp_or_service_provider",
            "gp_service_provider_reasoning",
            "estimated_aum",
            "estimated_check_size",
            "sector_fit",
            "halo_strategic_value",
            "emerging_manager_fit",
            "web_sources_used",
        ],
        "additionalProperties": False,
    },
}


async def score_organization(
    org_name: str,
    org_type: str,
    region: str | None,
    search_context: str,
) -> tuple[EnrichmentResult, int, int]:
    """Score an organization using GPT-4o structured output.

    Returns (EnrichmentResult, input_tokens, output_tokens).
    """
    user_prompt = SCORING_USER_PROMPT.format(
        org_name=org_name,
        org_type=org_type,
        region=region or "Unknown",
        search_context=search_context,
    )

    response = await client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": SCORING_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        response_format={
            "type": "json_schema",
            "json_schema": ENRICHMENT_JSON_SCHEMA,
        },
        temperature=0.2,
    )

    content = response.choices[0].message.content
    usage = response.usage
    input_tokens = usage.prompt_tokens if usage else 0
    output_tokens = usage.completion_tokens if usage else 0

    data = json.loads(content)
    result = EnrichmentResult(**data)

    return result, input_tokens, output_tokens
