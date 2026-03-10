from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.models import Contact, Organization
from app.schemas import ProspectOut, ProspectDetailOut, ContactOut

router = APIRouter()


def _build_prospect_out(contact: Contact, org: Organization) -> dict:
    return {
        "id": contact.id,
        "contact_name": contact.contact_name,
        "organization_id": org.id,
        "org_name": org.name,
        "org_type": org.org_type,
        "region": org.region,
        "role": contact.role,
        "email": contact.email,
        "contact_status": contact.contact_status,
        "relationship_depth": contact.relationship_depth,
        "sector_fit_score": org.sector_fit_score,
        "sector_fit_confidence": org.sector_fit_confidence,
        "halo_score": org.halo_score,
        "halo_confidence": org.halo_confidence,
        "emerging_manager_score": org.emerging_manager_score,
        "emerging_manager_confidence": org.emerging_manager_confidence,
        "composite_score": contact.composite_score,
        "tier": contact.tier,
        "enrichment_status": org.enrichment_status,
        "is_gp_or_service_provider": org.is_gp_or_service_provider,
    }


@router.get("", response_model=list[ProspectOut])
async def list_prospects(
    db: AsyncSession = Depends(get_db),
    tier: str | None = Query(None),
    org_type: str | None = Query(None),
    search: str | None = Query(None),
    sort_by: str = Query("composite_score"),
    order: str = Query("desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
):
    query = select(Contact, Organization).join(
        Organization, Contact.organization_id == Organization.id
    )

    if tier:
        query = query.where(Contact.tier == tier)
    if org_type:
        query = query.where(Organization.org_type == org_type)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            (Contact.contact_name.ilike(pattern))
            | (Organization.name.ilike(pattern))
        )

    # Sorting
    sort_map = {
        "composite_score": Contact.composite_score,
        "contact_name": Contact.contact_name,
        "org_name": Organization.name,
        "sector_fit_score": Organization.sector_fit_score,
        "halo_score": Organization.halo_score,
        "emerging_manager_score": Organization.emerging_manager_score,
        "relationship_depth": Contact.relationship_depth,
    }
    sort_col = sort_map.get(sort_by, Contact.composite_score)
    if order == "asc":
        query = query.order_by(sort_col.asc().nullslast())
    else:
        query = query.order_by(sort_col.desc().nullslast())

    query = query.offset((page - 1) * limit).limit(limit)

    result = await db.execute(query)
    rows = result.all()

    return [ProspectOut(**_build_prospect_out(contact, org)) for contact, org in rows]


@router.get("/count")
async def count_prospects(
    db: AsyncSession = Depends(get_db),
    tier: str | None = Query(None),
    org_type: str | None = Query(None),
    search: str | None = Query(None),
):
    query = select(func.count(Contact.id)).join(
        Organization, Contact.organization_id == Organization.id
    )
    if tier:
        query = query.where(Contact.tier == tier)
    if org_type:
        query = query.where(Organization.org_type == org_type)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            (Contact.contact_name.ilike(pattern))
            | (Organization.name.ilike(pattern))
        )
    result = await db.execute(query)
    return {"count": result.scalar()}


@router.get("/{contact_id}", response_model=ProspectDetailOut)
async def get_prospect_detail(contact_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Contact, Organization)
        .join(Organization, Contact.organization_id == Organization.id)
        .where(Contact.id == contact_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Contact not found")

    contact, org = row

    # Get other contacts at same org
    others_result = await db.execute(
        select(Contact)
        .where(Contact.organization_id == org.id)
        .where(Contact.id != contact.id)
    )
    other_contacts = [ContactOut.model_validate(c) for c in others_result.scalars()]

    base = _build_prospect_out(contact, org)
    return ProspectDetailOut(
        **base,
        sector_fit_reasoning=org.sector_fit_reasoning,
        halo_reasoning=org.halo_reasoning,
        emerging_manager_reasoning=org.emerging_manager_reasoning,
        enrichment_data=org.enrichment_data,
        web_sources=org.web_sources,
        estimated_aum=org.estimated_aum,
        estimated_check_size=org.estimated_check_size,
        other_contacts=other_contacts,
    )
