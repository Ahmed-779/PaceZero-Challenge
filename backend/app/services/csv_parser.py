import csv
import io

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Organization, Contact


EXPECTED_COLUMNS = [
    "Contact Name", "Organization", "Org Type", "Role",
    "Email", "Region", "Contact Status", "Relationship Depth",
]


async def parse_and_persist_csv(file_content: str, db: AsyncSession) -> dict:
    reader = csv.DictReader(io.StringIO(file_content))

    # Validate columns
    if reader.fieldnames:
        missing = set(EXPECTED_COLUMNS) - set(reader.fieldnames)
        if missing:
            raise ValueError(f"Missing columns: {missing}")

    rows = list(reader)
    orgs_created = 0
    orgs_existing = 0
    contacts_created = 0

    # Cache org name -> org object to avoid repeated DB lookups
    org_cache: dict[str, Organization] = {}

    # Pre-load existing orgs
    existing_orgs = await db.execute(select(Organization))
    for org in existing_orgs.scalars():
        org_cache[org.name.strip().lower()] = org

    for row in rows:
        org_name = row.get("Organization", "").strip()
        if not org_name:
            continue

        org_key = org_name.lower()

        # Get or create organization
        if org_key not in org_cache:
            org = Organization(
                name=org_name,
                org_type=row.get("Org Type", "").strip(),
                region=row.get("Region", "").strip() or None,
            )
            db.add(org)
            await db.flush()
            org_cache[org_key] = org
            orgs_created += 1
        else:
            org = org_cache[org_key]
            orgs_existing += 1

        # Parse relationship depth
        rd_raw = row.get("Relationship Depth", "").strip()
        relationship_depth = float(rd_raw) if rd_raw else None

        contact = Contact(
            contact_name=row.get("Contact Name", "").strip(),
            organization_id=org.id,
            role=row.get("Role", "").strip() or None,
            email=row.get("Email", "").strip() or None,
            contact_status=row.get("Contact Status", "").strip() or None,
            relationship_depth=relationship_depth,
        )
        db.add(contact)
        contacts_created += 1

    await db.commit()

    return {
        "contacts_created": contacts_created,
        "orgs_created": orgs_created,
        "orgs_existing": orgs_existing,
        "total_contacts": contacts_created,
    }
