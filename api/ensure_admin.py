"""Create or update a local admin account for demos.

Run inside Docker:
  docker compose exec api python ensure_admin.py
"""

from __future__ import annotations

import asyncio

from sqlalchemy import select
from sqlalchemy import text

from core.database import AsyncSessionLocal, engine
from core.security import hash_password
from models import *  # noqa: F401, F403
from models.user import User


ADMIN_EMAIL = "admin@aimap.com"
ADMIN_PASSWORD = "admin1234"


async def ensure_admin() -> None:
    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                ALTER TABLE users
                    ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active',
                    ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255),
                    ADD COLUMN IF NOT EXISTS email_reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                """
            )
        )

    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == ADMIN_EMAIL))
        user = result.scalar_one_or_none()
        if user is None:
            user = User(
                email=ADMIN_EMAIL,
                hashed_pw=hash_password(ADMIN_PASSWORD),
                full_name="AIMAP Admin",
                role="admin",
                is_active=True,
                status="active",
            )
            db.add(user)
        else:
            user.hashed_pw = hash_password(ADMIN_PASSWORD)
            user.role = "admin"
            user.is_active = True
            user.status = "active"

        await db.commit()
        print(f"Admin ready: {ADMIN_EMAIL} / {ADMIN_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(ensure_admin())
