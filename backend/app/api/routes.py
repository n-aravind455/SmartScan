"""Smart Scan — API routes for scan submission, status polling, and report retrieval."""

import uuid
import base64
from typing import List
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from app.worker.tasks import process_scan
from app.worker.celery_app import celery_app
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends
from sqlalchemy.future import select
from sqlalchemy import func
from datetime import datetime, timedelta

from app.db.session import get_session
from app.db.models import Complaint

router = APIRouter()


@router.post("/scan")
async def submit_scan(files: List[UploadFile] = File(...)):
    """Accept multiple image uploads, enqueue a Celery task, and return the task ID."""
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded.")

    images_payload = []
    
    for file in files:
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="Uploaded files must be images.")

        image_bytes = await file.read()
        if len(image_bytes) > 10 * 1024 * 1024:  # 10 MB limit
            raise HTTPException(status_code=413, detail="Each image must be under 10 MB.")

        images_payload.append({
            "image_b64": base64.b64encode(image_bytes).decode("utf-8"),
            "filename": file.filename or f"{uuid.uuid4()}.jpg",
            "content_type": file.content_type,
        })

    task = process_scan.delay(images_payload=images_payload)

    return JSONResponse(
        status_code=202,
        content={
            "task_id": task.id,
            "status": "QUEUED",
            "message": "Scan submitted successfully. Poll /api/status/{task_id} for updates.",
        },
    )


@router.get("/status/{task_id}")
async def get_scan_status(task_id: str):
    """Poll the status of a scan processing task."""
    result = celery_app.AsyncResult(task_id)

    response = {
        "task_id": task_id,
        "status": result.status,
    }

    if result.ready():
        if result.successful():
            response["result"] = result.result
        else:
            response["error"] = str(result.result)

    return response


@router.get("/report/{task_id}")
async def get_report(task_id: str):
    """Retrieve the compliance report for a completed scan."""
    result = celery_app.AsyncResult(task_id)

    if not result.ready():
        raise HTTPException(status_code=202, detail="Task is still processing.")

    if not result.successful():
        raise HTTPException(status_code=500, detail="Task failed.")

    task_result = result.result
    report_url = task_result.get("report_url")

    if not report_url:
        raise HTTPException(status_code=404, detail="Report not yet generated.")

    return {"report_url": report_url, "compliance": task_result.get("compliance")}

class ComplaintCreate(BaseModel):
    task_id: str
    location: str

@router.post("/complaints")
async def create_complaint(
    data: ComplaintCreate,
    session: AsyncSession = Depends(get_session)
):
    new_complaint = Complaint(task_id=data.task_id, location=data.location)
    session.add(new_complaint)
    await session.commit()
    return {"status": "SUCCESS", "message": "Complaint filed"}

@router.get("/admin/complaints")
async def get_complaints(
    status: str = None,
    session: AsyncSession = Depends(get_session)
):
    stmt = select(Complaint).order_by(Complaint.created_at.desc())
    if status in ["OPEN", "SOLVED"]:
        stmt = stmt.where(Complaint.status == status)
    
    result = await session.execute(stmt)
    complaints = result.scalars().all()

    out = []
    for c in complaints:
        out.append({
            "id": c.id,
            "task_id": c.task_id,
            "location": c.location,
            "status": c.status,
            "created_at": c.created_at.isoformat(),
            "report_url": f"/smartscan/reports/{c.task_id}/report.pdf"
        })
    return out

@router.get("/admin/complaints/stats")
async def get_complaint_stats(session: AsyncSession = Depends(get_session)):
    total = await session.scalar(select(func.count(Complaint.id)))
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today = await session.scalar(select(func.count(Complaint.id)).where(Complaint.created_at >= today_start))
    week_start = today_start - timedelta(days=7)
    week = await session.scalar(select(func.count(Complaint.id)).where(Complaint.created_at >= week_start))
    
    return {
        "lifetime": total or 0,
        "today": today or 0,
        "this_week": week or 0
    }

@router.put("/admin/complaints/{complaint_id}/solve")
async def solve_complaint(complaint_id: int, session: AsyncSession = Depends(get_session)):
    stmt = select(Complaint).where(Complaint.id == complaint_id)
    result = await session.execute(stmt)
    complaint = result.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Complaint not found")
    
    complaint.status = "SOLVED"
    complaint.resolved_at = datetime.utcnow()
    await session.commit()
    return {"status": "SUCCESS"}
