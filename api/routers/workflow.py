from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from core.database import get_db
from core.deps import get_current_user
from models.user import User
from models.workflow_job import WorkflowJob
from pydantic import BaseModel

router = APIRouter()


class TriggerPayload(BaseModel):
    trigger_type: str


@router.post("/trigger", status_code=202)
async def trigger_workflow(
    payload: TriggerPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = WorkflowJob(user_id=current_user.id, trigger_type=payload.trigger_type, status="queued")
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return {"job_id": str(job.id), "status": job.status}


@router.get("/jobs")
async def list_jobs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkflowJob)
        .where(WorkflowJob.user_id == current_user.id)
        .order_by(WorkflowJob.created_at.desc())
        .limit(20)
    )
    jobs = result.scalars().all()
    return [
        {
            "id": str(j.id),
            "trigger_type": j.trigger_type,
            "campaign_id": str(j.campaign_id) if j.campaign_id else None,
            "status": j.status,
            "created_at": j.created_at.isoformat(),
        }
        for j in jobs
    ]
