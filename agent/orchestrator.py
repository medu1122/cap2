import httpx
import os
from agents.strategist import StrategistAgent
from agents.writer import WriterAgent
from agents.critic import CriticAgent

API_BASE = os.getenv("INTERNAL_API_URL", "http://api:8000")


class CampaignOrchestrator:
    def __init__(self):
        self.strategist = StrategistAgent()
        self.writer = WriterAgent()
        self.critic = CriticAgent()

    async def run(self, campaign_id: str):
        async with httpx.AsyncClient(timeout=60) as client:
            try:
                # Fetch campaign + brand vault from API
                campaign_resp = await client.get(f"{API_BASE}/internal/campaigns/{campaign_id}/detail")
                campaign_resp.raise_for_status()
                data = campaign_resp.json()

                brief = data["brief"]
                brand_vault = data["brand_vault"]
                channels = brief.get("channels", [])

                # Step 1: Strategist
                plan = await self.strategist.run(campaign_id, brief, brand_vault)

                # Persist plan
                await client.patch(
                    f"{API_BASE}/internal/campaigns/{campaign_id}",
                    json={"status": "running", "campaign_plan_json": plan},
                )

                # Step 2 + 3: Writer + Critic per channel
                step = 2
                for deliverable in plan.get("deliverables", []):
                    channel = deliverable["channel"]
                    if channel not in channels:
                        continue

                    draft = await self.writer.run(campaign_id, deliverable, plan, brand_vault, step)
                    step += 1

                    final = await self.critic.run(campaign_id, deliverable, draft, brand_vault, plan, step)
                    step += 1

                    # Save final content item
                    from datetime import date
                    await client.post(
                        f"{API_BASE}/internal/content",
                        json={
                            "campaign_id": campaign_id,
                            "channel": channel,
                            "version": 1,
                            "status": "pending_approval",
                            "content_json": final["final_content"],
                            "scheduled_date": str(date.fromisoformat(brief["deadline"])) if brief.get("deadline") else None,
                        },
                    )

                # Finalize
                await client.patch(
                    f"{API_BASE}/internal/campaigns/{campaign_id}",
                    json={"status": "pending_approval"},
                )

            except Exception as e:
                async with httpx.AsyncClient(timeout=10) as err_client:
                    await err_client.patch(
                        f"{API_BASE}/internal/campaigns/{campaign_id}",
                        json={"status": "failed", "error_message": str(e)},
                    )
                raise
