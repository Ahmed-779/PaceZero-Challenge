import asyncio

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, update, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, async_session
from app.models import EnrichmentJob, Organization, Contact, CostLog
from app.schemas import EnrichmentJobOut
from app.services.enrichment_pipeline import run_enrichment_job, enrich_single_org

router = APIRouter()

# Track running background tasks
_running_tasks: dict[int, asyncio.Task] = {}


@router.post("/start", response_model=EnrichmentJobOut)
async def start_enrichment(db: AsyncSession = Depends(get_db)):
    # Check for pending orgs
    result = await db.execute(
        select(Organization).where(
            Organization.enrichment_status.in_(["pending", "failed"])
        )
    )
    orgs = result.scalars().all()
    if not orgs:
        raise HTTPException(status_code=400, detail="No organizations pending enrichment")

    # Create job
    job = EnrichmentJob(status="pending", total_orgs=len(orgs))
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Start background task
    task = asyncio.create_task(run_enrichment_job(job.id))
    _running_tasks[job.id] = task

    return job


@router.get("/status/{job_id}", response_model=EnrichmentJobOut)
async def get_enrichment_status(job_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EnrichmentJob).where(EnrichmentJob.id == job_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@router.get("/jobs", response_model=list[EnrichmentJobOut])
async def list_jobs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EnrichmentJob).order_by(EnrichmentJob.id.desc()).limit(10)
    )
    return result.scalars().all()


@router.post("/retry/{org_id}")
async def retry_org_enrichment(org_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Organization).where(Organization.id == org_id)
    )
    org = result.scalar_one_or_none()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Reset status
    await db.execute(
        update(Organization)
        .where(Organization.id == org_id)
        .values(enrichment_status="pending")
    )
    await db.commit()
    await db.refresh(org)

    # Run in background
    asyncio.create_task(enrich_single_org(org))
    return {"message": f"Retrying enrichment for {org.name}"}


@router.delete("/reset")
async def reset_all_data(db: AsyncSession = Depends(get_db)):
    """Delete all contacts, organizations, jobs, and cost logs."""
    contacts_deleted = (await db.execute(delete(Contact))).rowcount
    cost_logs_deleted = (await db.execute(delete(CostLog))).rowcount
    jobs_deleted = (await db.execute(delete(EnrichmentJob))).rowcount
    orgs_deleted = (await db.execute(delete(Organization))).rowcount
    await db.commit()
    return {
        "contacts_deleted": contacts_deleted,
        "orgs_deleted": orgs_deleted,
        "jobs_deleted": jobs_deleted,
        "cost_logs_deleted": cost_logs_deleted,
    }
