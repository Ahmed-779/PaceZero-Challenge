from fastapi import APIRouter, UploadFile, File, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.csv_parser import parse_and_persist_csv
from app.schemas import UploadResponse

router = APIRouter()


@router.post("/csv", response_model=UploadResponse)
async def upload_csv(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    content = await file.read()
    text = content.decode("utf-8-sig")  # Handle BOM if present
    result = await parse_and_persist_csv(text, db)
    return result
