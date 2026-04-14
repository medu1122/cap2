import httpx
from core.config import settings


async def dispatch_campaign(campaign_id: str):
    """
    Calls the agent service to start orchestration for a campaign.
    The agent service reads all needed data (brief, brand vault) via internal API calls.
    """
    async with httpx.AsyncClient(timeout=300) as client:
        try:
            await client.post(
                f"{settings.AGENT_SERVICE_URL}/run",
                json={"campaign_id": campaign_id},
            )
        except Exception as e:
            # Mark campaign as failed if agent service is unreachable
            await client.patch(
                f"http://localhost:8000/internal/campaigns/{campaign_id}",
                json={"status": "failed", "error_message": f"Agent service unreachable: {str(e)}"},
            )
