from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Contact, Organization, CostLog
from app.schemas import StatsOverview, CostOverview

router = APIRouter()


@router.get("/overview", response_model=StatsOverview)
async def get_overview(db: AsyncSession = Depends(get_db)):
    # Total contacts
    total_contacts = (await db.execute(select(func.count(Contact.id)))).scalar() or 0

    # Org counts
    total_orgs = (await db.execute(select(func.count(Organization.id)))).scalar() or 0
    enriched_orgs = (await db.execute(
        select(func.count(Organization.id)).where(Organization.enrichment_status == "completed")
    )).scalar() or 0
    pending_orgs = (await db.execute(
        select(func.count(Organization.id)).where(Organization.enrichment_status == "pending")
    )).scalar() or 0
    failed_orgs = (await db.execute(
        select(func.count(Organization.id)).where(Organization.enrichment_status == "failed")
    )).scalar() or 0

    # Average composite
    avg_composite = (await db.execute(
        select(func.avg(Contact.composite_score)).where(Contact.composite_score.isnot(None))
    )).scalar()

    # Tier distribution
    tier_result = await db.execute(
        select(Contact.tier, func.count(Contact.id))
        .where(Contact.tier.isnot(None))
        .group_by(Contact.tier)
    )
    tier_distribution = {tier: count for tier, count in tier_result.all()}

    # Average scores by dimension
    avg_sector = (await db.execute(
        select(func.avg(Organization.sector_fit_score)).where(Organization.sector_fit_score.isnot(None))
    )).scalar()
    avg_halo = (await db.execute(
        select(func.avg(Organization.halo_score)).where(Organization.halo_score.isnot(None))
    )).scalar()
    avg_emerging = (await db.execute(
        select(func.avg(Organization.emerging_manager_score)).where(Organization.emerging_manager_score.isnot(None))
    )).scalar()
    avg_rd = (await db.execute(
        select(func.avg(Contact.relationship_depth)).where(Contact.relationship_depth.isnot(None))
    )).scalar()

    return StatsOverview(
        total_contacts=total_contacts,
        total_orgs=total_orgs,
        enriched_orgs=enriched_orgs,
        pending_orgs=pending_orgs,
        failed_orgs=failed_orgs,
        avg_composite_score=round(avg_composite, 2) if avg_composite else None,
        tier_distribution=tier_distribution,
        avg_scores_by_dimension={
            "sector_fit": round(avg_sector, 2) if avg_sector else None,
            "relationship_depth": round(avg_rd, 2) if avg_rd else None,
            "halo_value": round(avg_halo, 2) if avg_halo else None,
            "emerging_manager": round(avg_emerging, 2) if avg_emerging else None,
        },
    )


@router.get("/costs", response_model=CostOverview)
async def get_costs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CostLog))
    logs = result.scalars().all()

    if not logs:
        return CostOverview(
            total_cost_usd=0,
            total_tavily_cost=0,
            total_openai_cost=0,
            total_tavily_searches=0,
            total_openai_input_tokens=0,
            total_openai_output_tokens=0,
            avg_cost_per_org=0,
            org_count=0,
            estimated_cost_1000_orgs=0,
        )

    total_cost = sum(l.total_cost_usd for l in logs)
    total_tavily = sum(l.tavily_cost_usd for l in logs)
    total_openai = sum(l.openai_cost_usd for l in logs)
    total_searches = sum(l.tavily_searches for l in logs)
    total_input = sum(l.openai_input_tokens for l in logs)
    total_output = sum(l.openai_output_tokens for l in logs)
    org_count = len(logs)
    avg_cost = total_cost / org_count if org_count > 0 else 0

    return CostOverview(
        total_cost_usd=round(total_cost, 4),
        total_tavily_cost=round(total_tavily, 4),
        total_openai_cost=round(total_openai, 4),
        total_tavily_searches=total_searches,
        total_openai_input_tokens=total_input,
        total_openai_output_tokens=total_output,
        avg_cost_per_org=round(avg_cost, 4),
        org_count=org_count,
        estimated_cost_1000_orgs=round(avg_cost * 1000, 2),
    )


@router.get("/score-distribution")
async def get_score_distribution(db: AsyncSession = Depends(get_db)):
    """Return histogram data for composite scores."""
    result = await db.execute(
        select(Contact.composite_score)
        .where(Contact.composite_score.isnot(None))
    )
    scores = [row[0] for row in result.all()]

    # Bucket into ranges
    buckets = {"1-2": 0, "2-3": 0, "3-4": 0, "4-5": 0, "5-6": 0, "6-7": 0, "7-8": 0, "8-9": 0, "9-10": 0}
    for s in scores:
        if s >= 9:
            buckets["9-10"] += 1
        elif s >= 8:
            buckets["8-9"] += 1
        elif s >= 7:
            buckets["7-8"] += 1
        elif s >= 6:
            buckets["6-7"] += 1
        elif s >= 5:
            buckets["5-6"] += 1
        elif s >= 4:
            buckets["4-5"] += 1
        elif s >= 3:
            buckets["3-4"] += 1
        elif s >= 2:
            buckets["2-3"] += 1
        else:
            buckets["1-2"] += 1

    return {"distribution": [{"range": k, "count": v} for k, v in buckets.items()]}


@router.get("/by-org-type")
async def get_scores_by_org_type(db: AsyncSession = Depends(get_db)):
    """Return average scores grouped by org type."""
    result = await db.execute(
        select(
            Organization.org_type,
            func.avg(Organization.sector_fit_score),
            func.avg(Organization.halo_score),
            func.avg(Organization.emerging_manager_score),
            func.count(Organization.id),
        )
        .where(Organization.enrichment_status == "completed")
        .group_by(Organization.org_type)
    )

    return {
        "by_org_type": [
            {
                "org_type": row[0],
                "avg_sector_fit": round(row[1], 2) if row[1] else None,
                "avg_halo": round(row[2], 2) if row[2] else None,
                "avg_emerging_manager": round(row[3], 2) if row[3] else None,
                "count": row[4],
            }
            for row in result.all()
        ]
    }
