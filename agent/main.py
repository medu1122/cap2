from fastapi import FastAPI
from pydantic import BaseModel
import asyncio
from orchestrator import CampaignOrchestrator

app = FastAPI(title="AIMAP Agent Service", version="0.1.0")
orchestrator = CampaignOrchestrator()


class RunRequest(BaseModel):
    campaign_id: str


@app.post("/run", status_code=202)
async def run_campaign(payload: RunRequest):
    asyncio.create_task(orchestrator.run(payload.campaign_id))
    return {"message": "Orchestration started", "campaign_id": payload.campaign_id}


@app.get("/health")
async def health():
    return {"status": "ok"}
