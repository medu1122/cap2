"""Compatibility migration for the AI Analyst tables.

The deployed database may still have the older insight_data_sources shape
(`source_name`, `config_json`). SQLAlchemy create_all does not add missing
columns, so this script upgrades the table without dropping existing data.
"""

from __future__ import annotations

import asyncio

from sqlalchemy import text

from core.database import engine


async def migrate_insights_schema() -> None:
    async with engine.begin() as conn:
        await conn.execute(
            text(
                """
                ALTER TABLE insight_data_sources
                    ADD COLUMN IF NOT EXISTS name VARCHAR(255),
                    ADD COLUMN IF NOT EXISTS schema_json JSONB,
                    ADD COLUMN IF NOT EXISTS data_json JSONB,
                    ADD COLUMN IF NOT EXISTS file_upload_id UUID,
                    ADD COLUMN IF NOT EXISTS original_filename VARCHAR(255)
                """
            )
        )
        await conn.execute(
            text(
                """
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_name = 'insight_data_sources'
                          AND column_name = 'source_name'
                    ) THEN
                        UPDATE insight_data_sources
                        SET name = COALESCE(name, source_name)
                        WHERE name IS NULL;

                        ALTER TABLE insight_data_sources
                            ALTER COLUMN source_name DROP NOT NULL;
                    END IF;
                END $$;
                """
            )
        )
        await conn.execute(
            text(
                """
                UPDATE insight_data_sources
                SET name = COALESCE(name, 'Nguồn dữ liệu')
                WHERE name IS NULL
                """
            )
        )
        await conn.execute(
            text(
                """
                ALTER TABLE insight_data_sources
                    ALTER COLUMN name SET NOT NULL
                """
            )
        )

    await engine.dispose()
    print("Insights schema migration completed.")


if __name__ == "__main__":
    asyncio.run(migrate_insights_schema())
