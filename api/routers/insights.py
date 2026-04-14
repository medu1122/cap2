from __future__ import annotations

import hashlib
import uuid
from datetime import date
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, Query
from sqlalchemy import delete, select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.deps import get_current_user
from models.user import User
from models.insight_data_source import InsightDataSource
from models.insight_raw_snapshot import InsightRawSnapshot
from models.insight_metric_daily import InsightMetricDaily
from models.insight_card import InsightCard
from models.insight_action import InsightAction
from models.insight_feedback import InsightFeedback

router = APIRouter()


class IngestRequest(BaseModel):
    source_type: str = Field(min_length=2, max_length=50)
    source_name: str = Field(min_length=2, max_length=255)
    snapshot_date: date
    payload: dict


class RecomputeRequest(BaseModel):
    metric_date: date


class FeedbackRequest(BaseModel):
    insight_card_id: uuid.UUID | None = None
    sentiment: str = Field(pattern="^(helpful|not_helpful)$")
    note: str | None = None


def _build_metrics(payload: dict) -> dict:
    revenue = float(payload.get("revenue", 0) or 0)
    orders = float(payload.get("orders", 0) or 0)
    ad_spend = float(payload.get("ad_spend", 0) or 0)
    leads = float(payload.get("leads", 0) or 0)
    repeat_orders = float(payload.get("repeat_orders", 0) or 0)
    aov = revenue / orders if orders > 0 else 0.0
    roas = revenue / ad_spend if ad_spend > 0 else 0.0
    repeat_rate = repeat_orders / orders if orders > 0 else 0.0
    conversion_rate = orders / leads if leads > 0 else 0.0
    return {
        "revenue": revenue,
        "orders": orders,
        "ad_spend": ad_spend,
        "leads": leads,
        "repeat_orders": repeat_orders,
        "computed_json": {
            "aov": aov,
            "roas": roas,
            "repeat_rate": repeat_rate,
            "conversion_rate": conversion_rate,
        },
    }


async def _regenerate_cards_for_date(user_id, metric_date: date, db: AsyncSession) -> int:
    await db.execute(delete(InsightAction).where(InsightAction.user_id == user_id))
    await db.execute(delete(InsightCard).where(InsightCard.user_id == user_id, InsightCard.metric_date == metric_date))
    metric = (
        await db.execute(
            select(InsightMetricDaily)
            .where(InsightMetricDaily.user_id == user_id, InsightMetricDaily.metric_date == metric_date)
            .order_by(desc(InsightMetricDaily.created_at))
            .limit(1)
        )
    ).scalar_one_or_none()
    if not metric:
        return 0

    computed = metric.computed_json or {}
    roas = float(computed.get("roas", 0) or 0)
    conversion_rate = float(computed.get("conversion_rate", 0) or 0)
    cards_to_create: list[tuple[str, str, str, float, list[dict], list[dict]]] = []
    if roas < 2:
        cards_to_create.append(
            (
                "ROAS đang thấp so với ngưỡng an toàn",
                "P1",
                "Chi phí quảng cáo đang ăn mòn lợi nhuận. Nên rà soát ad set và ưu tiên nhóm chuyển đổi cao.",
                0.82,
                [{"metric_key": "roas", "metric_value": roas, "baseline_value": 2.0, "window": "1d"}],
                [{"action_text": "Giảm 20% ngân sách nhóm ad có ROAS thấp nhất", "owner": "marketing", "impact_estimate": "high"}],
            )
        )
    if conversion_rate < 0.1:
        cards_to_create.append(
            (
                "Tỷ lệ chuyển đổi thấp",
                "P1",
                "Lưu lượng đầu vào có nhưng chốt đơn thấp. Cần tối ưu offer và CTA trong 48h tới.",
                0.78,
                [{"metric_key": "conversion_rate", "metric_value": conversion_rate, "baseline_value": 0.1, "window": "1d"}],
                [{"action_text": "A/B test 2 thông điệp ưu đãi mới trên kênh chính", "owner": "content", "impact_estimate": "medium"}],
            )
        )
    if not cards_to_create:
        cards_to_create.append(
            (
                "Hiệu suất hiện tại ổn định",
                "P3",
                "Các chỉ số chính chưa có dấu hiệu rủi ro lớn. Duy trì cấu hình hiện tại và theo dõi thêm.",
                0.66,
                [{"metric_key": "roas", "metric_value": roas, "baseline_value": 2.0, "window": "1d"}],
                [{"action_text": "Giữ ngân sách hiện tại và theo dõi thêm 3 ngày", "owner": "marketing", "impact_estimate": "low"}],
            )
        )

    for title, priority, reasoning, confidence, evidence, actions in cards_to_create:
        card = InsightCard(
            user_id=user_id,
            metric_date=metric_date,
            title=title,
            priority=priority,
            confidence=confidence,
            reasoning=reasoning,
            evidence_json=evidence,
            status="open",
        )
        db.add(card)
        await db.flush()
        for action in actions:
            db.add(
                InsightAction(
                    user_id=user_id,
                    insight_card_id=card.id,
                    action_text=action["action_text"],
                    owner=action["owner"],
                    impact_estimate=action["impact_estimate"],
                    status="open",
                )
            )
    return len(cards_to_create)


@router.post("/ingest")
async def ingest_insight_data(
    payload: IngestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    source = (
        await db.execute(
            select(InsightDataSource).where(
                InsightDataSource.user_id == current_user.id,
                InsightDataSource.source_type == payload.source_type,
                InsightDataSource.source_name == payload.source_name,
            )
        )
    ).scalar_one_or_none()
    if not source:
        source = InsightDataSource(
            user_id=current_user.id,
            source_type=payload.source_type,
            source_name=payload.source_name,
        )
        db.add(source)
        await db.flush()

    checksum = hashlib.sha256(str(payload.payload).encode("utf-8")).hexdigest()
    snapshot = InsightRawSnapshot(
        user_id=current_user.id,
        data_source_id=source.id,
        source_type=payload.source_type,
        snapshot_date=payload.snapshot_date,
        payload_json=payload.payload,
        checksum=checksum,
    )
    db.add(snapshot)

    metrics = _build_metrics(payload.payload)
    metric_row = InsightMetricDaily(
        user_id=current_user.id,
        metric_date=payload.snapshot_date,
        channel=payload.payload.get("channel"),
        **metrics,
    )
    db.add(metric_row)
    await db.commit()
    return {"ok": True, "snapshot_id": str(snapshot.id), "metric_id": str(metric_row.id)}


@router.post("/recompute")
async def recompute_insights(
    payload: RecomputeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    created = await _regenerate_cards_for_date(current_user.id, payload.metric_date, db)
    await db.commit()
    return {"ok": True, "cards_created": created}


@router.get("/cards")
async def get_insight_cards(
    metric_date: date | None = Query(default=None),
    priority: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(InsightCard).where(InsightCard.user_id == current_user.id)
    if metric_date:
        query = query.where(InsightCard.metric_date == metric_date)
    if priority:
        query = query.where(InsightCard.priority == priority)
    query = query.order_by(desc(InsightCard.metric_date), InsightCard.priority)
    cards = (await db.execute(query)).scalars().all()
    return [
        {
            "id": str(c.id),
            "metric_date": c.metric_date.isoformat(),
            "title": c.title,
            "priority": c.priority,
            "confidence": c.confidence,
            "reasoning": c.reasoning,
            "evidence": c.evidence_json or [],
            "status": c.status,
            "created_at": c.created_at.isoformat(),
        }
        for c in cards
    ]


@router.get("/actions")
async def get_insight_actions(
    status: str = Query(default="open"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    actions = (
        await db.execute(
            select(InsightAction)
            .where(InsightAction.user_id == current_user.id, InsightAction.status == status)
            .order_by(desc(InsightAction.created_at))
        )
    ).scalars().all()
    return [
        {
            "id": str(a.id),
            "insight_card_id": str(a.insight_card_id) if a.insight_card_id else None,
            "action_text": a.action_text,
            "owner": a.owner,
            "impact_estimate": a.impact_estimate,
            "status": a.status,
            "created_at": a.created_at.isoformat(),
        }
        for a in actions
    ]


@router.post("/feedback")
async def submit_feedback(
    payload: FeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    item = InsightFeedback(
        user_id=current_user.id,
        insight_card_id=payload.insight_card_id,
        sentiment=payload.sentiment,
        note=payload.note,
    )
    db.add(item)
    await db.commit()
    return {"ok": True, "feedback_id": str(item.id)}
