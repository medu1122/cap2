import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from routers import auth, brands, campaigns, content, calendar, dashboard, workflow, internal, insights, tracking, campaign_idea, insights_chat, tracking_links, redirect
from core.config import settings
from services.calendar_reminder_service import send_today_calendar_reminders
from services.workflow_scheduler_service import run_due_workflow_schedules


@asynccontextmanager
async def lifespan(_: FastAPI):
    scheduler = AsyncIOScheduler(timezone="Asia/Ho_Chi_Minh")
    scheduler.add_job(
        send_today_calendar_reminders,
        CronTrigger(hour=settings.CALENDAR_REMINDER_HOUR, minute=0),
        id="calendar-daily-reminder",
        replace_existing=True,
    )
    if settings.WORKFLOW_SCHEDULER_ENABLED:
        scheduler.add_job(
            run_due_workflow_schedules,
            "interval",
            minutes=max(settings.WORKFLOW_SCHEDULER_INTERVAL_MINUTES, 1),
            id="workflow-scheduler-runner",
            replace_existing=True,
        )
    scheduler.start()
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)


app = FastAPI(title="AIMAP API", version="0.1.0", lifespan=lifespan)

# Static file serving for uploaded/generated campaign images
_DEFAULT_STATIC = os.path.join(os.path.dirname(__file__), "static")
_STATIC_DIR = settings.STATIC_DIR or _DEFAULT_STATIC
_UPLOAD_DIR = os.path.join(_STATIC_DIR, "uploads")
os.makedirs(_UPLOAD_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=_STATIC_DIR), name="static")

_CORS_ORIGINS = [origin.strip() for origin in settings.CORS_ORIGINS.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(brands.router, prefix="/brands", tags=["brands"])
# tracking_links phải đăng ký TRƯỚC campaigns vì cùng prefix /campaigns
# để route /campaigns/{id}/tracking-links được match đúng
app.include_router(tracking_links.router, prefix="/campaigns", tags=["tracking-links"])
app.include_router(campaigns.router, prefix="/campaigns", tags=["campaigns"])
app.include_router(campaign_idea.router, prefix="/campaign-ideas", tags=["campaign-ideas"])
app.include_router(content.router, prefix="/content", tags=["content"])
app.include_router(calendar.router, prefix="/calendar", tags=["calendar"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
app.include_router(workflow.router, prefix="/workflow", tags=["workflow"])
app.include_router(insights.router, prefix="/insights", tags=["insights"])
app.include_router(insights_chat.router, prefix="/insights", tags=["insights-chat"])
app.include_router(tracking.router, prefix="/track", tags=["tracking"])
app.include_router(internal.router, prefix="/internal", tags=["internal"])
app.include_router(redirect.router, tags=["redirect"])


@app.get("/health")
async def health():
    return {"status": "ok"}