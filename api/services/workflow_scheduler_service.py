"""
Workflow Scheduler Service - DISABLED

NOTE: This service is disabled because workflow_schedules table was deleted.
The scheduled workflow feature is no longer available.

If you need to re-enable, create a new workflow_schedules table and restore this code.
"""
from datetime import datetime, timezone


async def run_due_workflow_schedules() -> None:
    """
    DISABLED: workflow_schedules table was deleted during database cleanup.
    
    Previously: Ran scheduled workflow jobs based on cron expressions.
    Currently: Does nothing.
    """
    pass
