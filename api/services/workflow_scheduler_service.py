from datetime import datetime, timezone, timedelta
from croniter import croniter
from sqlalchemy import select
from core.database import AsyncSessionLocal
from models.brand import Brand
from models.campaign import Campaign
from models.workflow_job import WorkflowJob
from models.workflow_schedule import WorkflowSchedule
from routers.workflow import PRESETS
from services.agent_dispatcher import dispatch_campaign


def _ensure_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _next_run(cron_expression: str, base: datetime) -> datetime:
    return _ensure_aware(croniter(cron_expression, base).get_next(datetime))


async def run_due_workflow_schedules() -> None:
    now = datetime.now(timezone.utc)
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(WorkflowSchedule)
            .where(
                WorkflowSchedule.is_active.is_(True),
                WorkflowSchedule.next_run_at.is_not(None),
                WorkflowSchedule.next_run_at <= now,
            )
            .order_by(WorkflowSchedule.next_run_at.asc())
            .limit(20)
        )
        schedules = result.scalars().all()

        for schedule in schedules:
            preset = PRESETS.get(schedule.preset_type)
            if not preset:
                schedule.next_run_at = _next_run(schedule.cron_expression, now + timedelta(seconds=1))
                continue

            brand_result = await db.execute(
                select(Brand)
                .where(Brand.user_id == schedule.user_id)
                .order_by(Brand.updated_at.desc())
                .limit(1)
            )
            brand = brand_result.scalar_one_or_none()
            if not brand:
                schedule.next_run_at = _next_run(schedule.cron_expression, now + timedelta(seconds=1))
                continue

            campaign = Campaign(
                user_id=schedule.user_id,
                campaign_name=f"{preset['label']} - lịch tự động",
                objective=preset["objective_hint"],
                product_or_service=brand.brand_name,
                target_audience=brand.target_audience or "",
                offer_or_hook="Ưu đãi dành cho nhóm khách phù hợp",
                additional_notes=f"[AUTO:schedule:{schedule.id}]",
                deadline=now.date() + timedelta(days=preset["deadline_days"]),
                channels=preset["channels"],
                status="pending_agent",
            )
            db.add(campaign)
            await db.flush()

            job = WorkflowJob(
                user_id=schedule.user_id,
                schedule_id=schedule.id,
                trigger_type="schedule_trigger",
                trigger_payload={"preset_type": schedule.preset_type},
                campaign_id=campaign.id,
                status="queued",
            )
            db.add(job)

            schedule.last_run_at = now
            schedule.next_run_at = _next_run(schedule.cron_expression, now + timedelta(seconds=1))

            await db.commit()
            await dispatch_campaign(str(campaign.id))
