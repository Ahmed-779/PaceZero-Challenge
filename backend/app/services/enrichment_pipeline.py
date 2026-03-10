import asyncio
import json
import logging
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session
from app.models import Organization, Contact, EnrichmentJob, CostLog
from app.services.web_search import search_organization
from app.services.scoring import score_organization
from app.services.cost_tracker import estimate_cost

logger = logging.getLogger(__name__)


def compute_composite(d1: float, d2: float, d3: float, d4: float) -> float:
    return round((d1 * 0.35) + (d2 * 0.30) + (d3 * 0.20) + (d4 * 0.15), 2)


def assign_tier(composite: float) -> str:
    if composite >= 8.0:
        return "PRIORITY CLOSE"
    elif composite >= 6.5:
        return "STRONG FIT"
    elif composite >= 5.0:
        return "MODERATE FIT"
    else:
        return "WEAK FIT"


def validate_scores(result, org_type: str) -> list[str]:
    """Apply post-LLM validation rules. Returns list of warnings."""
    warnings = []

    # Rule 1: GP/service providers should score low on sector fit
    if result.is_gp_or_service_provider and result.sector_fit.score > 3:
        warnings.append(
            f"GP/service provider scored sector_fit={result.sector_fit.score}, overriding to 2.0"
        )
        result.sector_fit.score = 2.0
        result.sector_fit.confidence = max(result.sector_fit.confidence, 0.7)

    # Rule 2: Foundations/Endowments/Pensions with very low sector fit are suspicious
    if org_type in ("Foundation", "Endowment", "Pension") and result.sector_fit.score < 4:
        if not result.is_gp_or_service_provider:
            warnings.append(
                f"{org_type} scored sector_fit={result.sector_fit.score} — flagged for review "
                f"(these org types usually allocate to external managers)"
            )

    # Rule 3: Clamp all scores to [1, 10]
    for dim in [result.sector_fit, result.halo_strategic_value, result.emerging_manager_fit]:
        dim.score = max(1.0, min(10.0, dim.score))
        dim.confidence = max(0.0, min(1.0, dim.confidence))

    # Rule 4: Low confidence + high score = unreliable
    for dim_name, dim in [
        ("sector_fit", result.sector_fit),
        ("halo", result.halo_strategic_value),
        ("emerging_manager", result.emerging_manager_fit),
    ]:
        if dim.confidence < 0.3 and dim.score > 7:
            warnings.append(
                f"{dim_name} has low confidence ({dim.confidence}) but high score ({dim.score}) — flagged as unreliable"
            )

    return warnings


async def enrich_single_org(org: Organization, job_id: int | None = None) -> None:
    """Enrich a single organization: web search → LLM scoring → persist."""
    async with async_session() as db:
        try:
            # Mark as in_progress
            await db.execute(
                update(Organization)
                .where(Organization.id == org.id)
                .values(enrichment_status="in_progress")
            )
            await db.commit()

            # Step 1: Web search
            search_result = await search_organization(org.name, org.org_type)

            # Step 2: LLM scoring
            result, input_tokens, output_tokens = await score_organization(
                org_name=org.name,
                org_type=org.org_type,
                region=org.region,
                search_context=search_result["search_context"],
            )

            # Step 3: Validation
            warnings = validate_scores(result, org.org_type)
            if warnings:
                for w in warnings:
                    logger.warning(f"[{org.name}] {w}")

            # Step 4: Persist org scores
            await db.execute(
                update(Organization)
                .where(Organization.id == org.id)
                .values(
                    enrichment_status="completed",
                    enrichment_data=json.dumps({
                        "summary": result.organization_summary,
                        "gp_reasoning": result.gp_service_provider_reasoning,
                        "validation_warnings": warnings,
                    }),
                    web_sources=json.dumps(result.web_sources_used or search_result["sources"]),
                    sector_fit_score=result.sector_fit.score,
                    sector_fit_reasoning=result.sector_fit.reasoning,
                    sector_fit_confidence=result.sector_fit.confidence,
                    halo_score=result.halo_strategic_value.score,
                    halo_reasoning=result.halo_strategic_value.reasoning,
                    halo_confidence=result.halo_strategic_value.confidence,
                    emerging_manager_score=result.emerging_manager_fit.score,
                    emerging_manager_reasoning=result.emerging_manager_fit.reasoning,
                    emerging_manager_confidence=result.emerging_manager_fit.confidence,
                    estimated_aum=result.estimated_aum,
                    estimated_check_size=result.estimated_check_size,
                    is_gp_or_service_provider=result.is_gp_or_service_provider,
                    enriched_at=datetime.now(timezone.utc),
                )
            )

            # Step 5: Compute composite for all linked contacts
            contacts_result = await db.execute(
                select(Contact).where(Contact.organization_id == org.id)
            )
            contacts = contacts_result.scalars().all()

            for contact in contacts:
                d1 = result.sector_fit.score
                d2 = contact.relationship_depth or 5.0  # default if missing
                d3 = result.halo_strategic_value.score
                d4 = result.emerging_manager_fit.score
                composite = compute_composite(d1, d2, d3, d4)
                tier = assign_tier(composite)

                await db.execute(
                    update(Contact)
                    .where(Contact.id == contact.id)
                    .values(composite_score=composite, tier=tier)
                )

            # Step 6: Log costs
            cost = estimate_cost(
                tavily_searches=search_result["search_count"],
                openai_input_tokens=input_tokens,
                openai_output_tokens=output_tokens,
            )
            cost_log = CostLog(
                organization_id=org.id,
                enrichment_job_id=job_id,
                **cost,
            )
            db.add(cost_log)

            await db.commit()
            logger.info(f"Enriched {org.name}: sector={result.sector_fit.score}, halo={result.halo_strategic_value.score}, emerging={result.emerging_manager_fit.score}")

        except Exception as e:
            logger.error(f"Failed to enrich {org.name}: {e}")
            async with async_session() as err_db:
                await err_db.execute(
                    update(Organization)
                    .where(Organization.id == org.id)
                    .values(enrichment_status="failed")
                )
                await err_db.commit()
            raise


async def run_enrichment_job(job_id: int) -> None:
    """Run enrichment for all pending/failed orgs as a background task."""
    async with async_session() as db:
        # Get all orgs needing enrichment
        result = await db.execute(
            select(Organization).where(
                Organization.enrichment_status.in_(["pending", "failed"])
            )
        )
        orgs = result.scalars().all()

        # Update job
        await db.execute(
            update(EnrichmentJob)
            .where(EnrichmentJob.id == job_id)
            .values(
                status="running",
                total_orgs=len(orgs),
                started_at=datetime.now(timezone.utc),
            )
        )
        await db.commit()

    completed = 0
    failed = 0

    for org in orgs:
        try:
            await enrich_single_org(org, job_id=job_id)
            completed += 1
        except Exception:
            failed += 1

        # Update progress
        async with async_session() as db:
            await db.execute(
                update(EnrichmentJob)
                .where(EnrichmentJob.id == job_id)
                .values(completed_orgs=completed, failed_orgs=failed)
            )
            await db.commit()

        # Rate limiting between orgs
        await asyncio.sleep(1.0)

    # Mark job as completed
    async with async_session() as db:
        await db.execute(
            update(EnrichmentJob)
            .where(EnrichmentJob.id == job_id)
            .values(
                status="completed",
                completed_orgs=completed,
                failed_orgs=failed,
                completed_at=datetime.now(timezone.utc),
            )
        )
        await db.commit()

    logger.info(f"Enrichment job {job_id} completed: {completed} success, {failed} failed")
