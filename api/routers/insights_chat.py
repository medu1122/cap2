from __future__ import annotations

import json
import uuid
from typing import Any

import httpx
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.database import get_db
from core.deps import get_current_user
from core.config import settings
from models.user import User
from models.insight_data_source import InsightDataSource
from models.insight_chat import InsightChat, InsightChatMessage
from services.insight_intelligence import (
    ContextBuilder,
    ReferenceResolver,
    EntityLinker,
    IntentClassifier,
    ConversationMemory,
    ChatContext,
    CalculatorAgent,
    format_computation_for_response,
    VisualizationPlanner,
    format_visualization_for_response,
    ResponseFormatter,
    format_response_for_api,
    DataManipulationAgent,
    format_manipulation_result,
    GuidanceAgent,
    format_guidance_for_response,
    IntentType,
)

router = APIRouter()


# ============= SCHEMAS =============

class ColumnSchema(BaseModel):
    name: str
    data_type: str = "text"


class TableDataSchema(BaseModel):
    columns: list[ColumnSchema]
    rows: list[dict[str, Any]]


class CreateDataSourceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    source_type: str = Field(default="manual")
    table_data: TableDataSchema | None = None
    file_upload_id: uuid.UUID | None = None


class UpdateDataSourceRequest(BaseModel):
    name: str | None = None
    table_data: TableDataSchema | None = None


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1)
    message_context: dict[str, Any] | None = None


# ============= HELPERS =============

async def _chat_completion(
    *,
    base_url: str,
    model: str,
    messages: list[dict[str, str]],
    timeout_seconds: int = 60,
    api_key: str | None = None,
) -> str:
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    url = f"{base_url.rstrip('/')}/chat/completions"
    payload = {"model": model, "messages": messages, "temperature": 0.3, "stream": False}
    timeout = httpx.Timeout(timeout_seconds, connect=15.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
    return str(data["choices"][0]["message"]["content"])


async def _generate_response(
    context: ChatContext,
    messages: list[dict[str, str]],
    intent_info: dict[str, Any],
) -> tuple[str, dict[str, Any]]:
    """
    Generate response sử dụng enhanced context và intelligence modules.
    Bao gồm Calculator Agent để compute KPI, trend, anomaly.
    """
    # Initialize calculator
    calculator = CalculatorAgent()
    
    # Determine if we need to compute something
    computation_result = None
    primary_metric = context.detected_entities.get("primary_metric") if context.detected_entities else None
    
    if primary_metric and primary_metric.get("linked_column") and context.full_data:
        column = primary_metric.get("linked_column")
        intent_type = intent_info.get("type", "general")
        
        # Compute based on intent
        if intent_type == "kpi_query":
            computation_result = await calculator.compute(
                computation_type="kpi",
                data=context.full_data,
                column=column,
                context=intent_info.get("parameters"),
            )
        elif intent_type == "trend_analysis":
            computation_result = await calculator.compute(
                computation_type="trend",
                data=context.full_data,
                column=column,
                context=intent_info.get("parameters"),
            )
        elif intent_type == "anomaly_detection":
            computation_result = await calculator.compute(
                computation_type="anomaly",
                data=context.full_data,
                column=column,
            )
        elif intent_type == "comparison":
            computation_result = await calculator.compute(
                computation_type="comparison",
                data=context.full_data,
                column=column,
                context=intent_info.get("parameters"),
            )
    
    # Build system prompt với context đầy đủ
    system_prompt = _build_enhanced_system_prompt(
        context, 
        intent_info,
        computation_result,
    )
    
    # Build messages cho LLM
    llm_messages = [
        {"role": "system", "content": system_prompt},
        *messages,
    ]
    
    try:
        response_text = await _chat_completion(
            base_url=settings.DEEPSEEK_BASE_URL,
            model=settings.DEEPSEEK_MODEL,
            messages=llm_messages,
            timeout_seconds=90,
        )
        
        extra_data = {
            "intent": intent_info.get("type"),
            "context_used": True,
        }
        
        if computation_result and computation_result.success:
            extra_data["computation"] = format_computation_for_response(computation_result)
        
        # Generate visualization suggestions
        viz_planner = VisualizationPlanner()
        viz_plan = viz_planner.plan(
            intent_type=intent_info.get("type", "general"),
            data_context=context.data,
            computation_result=computation_result,
            entities=context.detected_entities,
        )
        extra_data["visualizations"] = format_visualization_for_response(viz_plan)
        
        return response_text, extra_data
    except Exception as e:
        return f"Xin lỗi, đã có lỗi khi xử lý: {str(e)}", {"error": str(e)}


def _build_enhanced_system_prompt(
    context: ChatContext, 
    intent_info: dict[str, Any],
    computation_result: Any = None,
) -> str:
    """Build enhanced system prompt với đầy đủ context"""
    
    lines = []
    
    # Header
    lines.append("Bạn là AI Analyst chuyên phân tích dữ liệu kinh doanh.")
    lines.append("Nhiệm vụ: trả lời câu hỏi về dữ liệu một cách chính xác và hữu ích.")
    lines.append("")
    
    # Computed Results (nếu có)
    if computation_result and computation_result.success:
        lines.append("## KẾT QUẢ TÍNH TOÁN:")
        if hasattr(computation_result, 'computation_type'):
            lines.append(f"- Loại: {computation_result.computation_type}")
            lines.append(f"- Confidence: {computation_result.confidence:.0%}")
        
        if hasattr(computation_result, 'value') and computation_result.value is not None:
            lines.append(f"- Kết quả: {computation_result.value}")
        
        if hasattr(computation_result, 'direction'):
            lines.append(f"- Xu hướng: {computation_result.direction} ({computation_result.change_percent:+.1f}%)")
        
        if hasattr(computation_result, 'outliers') and computation_result.outliers:
            lines.append(f"- Số outliers: {len(computation_result.outliers)}")
            for o in computation_result.outliers[:5]:
                lines.append(f"  - Dòng #{o.get('row')}: {o.get('value')} ({o.get('reason', '')})")
        
        if hasattr(computation_result, 'breakdown') and computation_result.breakdown:
            lines.append("- Chi tiết:")
            for k, v in computation_result.breakdown.items():
                lines.append(f"  - {k}: {v}")
        lines.append("")
    
    # Data Context
    lines.append("## NGUỒN DỮ LIỆU:")
    lines.append(f"- Tên: {context.data_source_name}")
    if context.data:
        lines.append(f"- Số dòng: {context.data.row_count}")
        lines.append(f"- Số cột: {len(context.data.columns)}")
        lines.append("")
        lines.append("### Cấu trúc cột:")
        for col in context.data.columns:
            unique_info = f" ({col.unique_count} giá trị)" if col.unique_count else ""
            sample_info = f" - vd: {col.sample_values[:3]}" if col.sample_values else ""
            lines.append(f"- **{col.name}** ({col.data_type}){unique_info}{sample_info}")
    
    # KPI Data
    if context.insight and context.insight.kpis:
        lines.append("")
        lines.append("## KPI ĐÃ PHÂN TÍCH:")
        kpi = context.insight.kpis
        if kpi.revenue:
            lines.append(f"- Doanh thu: {kpi.revenue:,.0f} VND")
        if kpi.orders:
            lines.append(f"- Đơn hàng: {kpi.orders:,.0f}")
        if kpi.roas:
            lines.append(f"- ROAS: {kpi.roas:.2f}")
        if kpi.conversion_rate:
            lines.append(f"- Tỷ lệ chuyển đổi: {kpi.conversion_rate*100:.1f}%")
        if kpi.aov:
            lines.append(f"- AOV: {kpi.aov:,.0f} VND")
    
    # Intent & Entities
    if intent_info:
        lines.append("")
        lines.append("## CÂU HỎI CỦA USER:")
        lines.append(f"- Intent: {intent_info.get('type', 'general')}")
        lines.append(f"- Confidence: {intent_info.get('confidence', 0):.0%}")
        if intent_info.get("entities"):
            lines.append(f"- Entities: {', '.join(intent_info.get('entities', []))}")
        if intent_info.get("parameters"):
            lines.append(f"- Parameters: {json.dumps(intent_info.get('parameters', {}), ensure_ascii=False)}")
    
    # Detected Entities (từ reference resolver)
    if context.detected_entities:
        lines.append("")
        lines.append("## ENTITIES ĐÃ NHẬN DIỆN:")
        primary = context.detected_entities.get("primary_metric", {})
        if primary:
            lines.append(f"- Entity chính: {primary.get('entity')} → {primary.get('linked_column')} (confidence: {primary.get('confidence', 0):.0%})")
        if context.detected_entities.get("all_entities"):
            lines.append("- Tất cả entities:")
            for e in context.detected_entities.get("all_entities", [])[:5]:
                lines.append(f"  - {e.get('entity')} → {e.get('linked_column')} ({e.get('confidence', 0):.0%})")
    
    # Resolved Input (nếu có reference được resolve)
    if context.resolved_input:
        lines.append("")
        lines.append("## INPUT ĐÃ RESOLVE:")
        lines.append(f"(Original: {context.resolved_input})")
    
    # Memory Summary
    if context.memory:
        lines.append("")
        lines.append("## LỊCH SỬ TRÒ CHUYỆN:")
        if context.memory.mentioned_entities:
            lines.append(f"- Đã hỏi về: {', '.join(context.memory.mentioned_entities[:5])}")
        if context.memory.pending_questions:
            lines.append(f"- Câu hỏi đang chờ: {len(context.memory.pending_questions)}")
        if context.memory.confirmed_context:
            lines.append(f"- Context đã confirm: {json.dumps(context.memory.confirmed_context, ensure_ascii=False)}")
    
    # Chat History
    lines.append("")
    lines.append("## LỊCH SỬ CHAT (10 messages gần nhất):")
    history_text = context.to_chat_history_text()
    lines.append(history_text)
    
    # Response Guidelines
    lines.append("")
    lines.append("## QUY TẮC TRẢ LỜI:")
    lines.append("1. **Luôn trích dẫn số liệu cụ thể** từ dữ liệu (VD: 'Doanh thu dòng #45 là 50 triệu')")
    lines.append("2. **Khi tham chiếu đến dòng/cột**, dùng format: **Dòng #N** hoặc **Cột: [tên]**")
    lines.append("3. **Nếu thiếu thông tin**, hỏi user cụ thể cần gì thay vì trả lời mơ hồ")
    lines.append("4. **Đề xuất action tiếp theo** khi phù hợp (VD: 'Bạn có muốn xem chi tiết...')")
    lines.append("5. **Nếu không chắc chắn**, đánh dấu [Confidence: X%]")
    lines.append("6. **Trả lời ngắn gọn** và đi thẳng vào vấn đề, không lan man")
    lines.append("7. **Dùng tiếng Việt có dấu**, ngôn ngữ tự nhiên như đang nói chuyện")
    
    # Response format based on intent
    intent_type = intent_info.get("type", "general")
    lines.append("")
    lines.append(f"## FORMAT TRẢ LỜI CHO '{intent_type}':")
    lines.append(_get_intent_response_format(intent_type))
    
    return "\n".join(lines)


def _get_intent_response_format(intent_type: str) -> str:
    """Get response format guide cho từng intent type"""
    formats = {
        "kpi_query": (
            "**Kết quả**: [số] [đơn vị]\n"
            "**So sánh**: [tăng/giảm] [X%] so với [period]\n"
            "**Chi tiết**: [breakdown nếu có]"
        ),
        "trend_analysis": (
            "**Xu hướng chính**: [tăng/giảm/flat]\n"
            "**Mức thay đổi**: [X%]\n"
            "**Điểm đáng chú ý**: [peak/valley points]"
        ),
        "anomaly_detection": (
            "**Số outliers tìm thấy**: [N]\n"
            "1. **Dòng #[N]**: [giá trị] - [nguyên nhân/delta]\n"
            "2. ..."
        ),
        "comparison": (
            "[Period A]: [số]\n"
            "[Period B]: [số]\n"
            "**Kết luận**: [so sánh]"
        ),
        "general": (
            "[Trả lời tự nhiên, ngắn gọn, đi thẳng vào vấn đề]"
        ),
    }
    return formats.get(intent_type, formats["general"])


# ============= DATA SOURCE APIs =============

@router.get("/data-sources")
async def list_data_sources(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách nguồn dữ liệu của user."""
    result = await db.execute(
        select(InsightDataSource)
        .where(InsightDataSource.user_id == current_user.id)
        .order_by(desc(InsightDataSource.updated_at))
        .limit(50)
    )
    sources = result.scalars().all()

    return [
        {
            "id": str(s.id),
            "name": s.name,
            "source_type": s.source_type,
            "row_count": len(s.data_json.get("rows", [])) if s.data_json else 0,
            "column_count": len(s.schema_json.get("columns", [])) if s.schema_json else 0,
            "original_filename": s.original_filename,
            "created_at": s.created_at.isoformat(),
            "updated_at": s.updated_at.isoformat(),
        }
        for s in sources
    ]


@router.post("/data-sources")
async def create_data_source(
    payload: CreateDataSourceRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Tạo nguồn dữ liệu mới."""
    if payload.source_type == "manual" and not payload.table_data:
        raise HTTPException(status_code=400, detail="table_data is required for manual source")

    schema_json = None
    data_json = None

    if payload.table_data:
        schema_json = {
            "columns": [c.model_dump() for c in payload.table_data.columns]
        }
        data_json = {
            "rows": payload.table_data.rows
        }

    source = InsightDataSource(
        user_id=current_user.id,
        name=payload.name,
        source_type=payload.source_type,
        schema_json=schema_json,
        data_json=data_json,
        file_upload_id=payload.file_upload_id,
    )

    db.add(source)
    await db.commit()
    await db.refresh(source)

    return {
        "id": str(source.id),
        "name": source.name,
        "source_type": source.source_type,
        "created_at": source.created_at.isoformat(),
    }


@router.get("/data-sources/{source_id}")
async def get_data_source(
    source_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy chi tiết nguồn dữ liệu."""
    result = await db.execute(
        select(InsightDataSource)
        .where(
            InsightDataSource.id == source_id,
            InsightDataSource.user_id == current_user.id,
        )
    )
    source = result.scalar_one_or_none()

    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")

    return {
        "id": str(source.id),
        "name": source.name,
        "source_type": source.source_type,
        "schema": source.schema_json,
        "data": source.data_json,
        "row_count": len(source.data_json.get("rows", [])) if source.data_json else 0,
        "created_at": source.created_at.isoformat(),
        "updated_at": source.updated_at.isoformat(),
    }


@router.put("/data-sources/{source_id}")
async def update_data_source(
    source_id: uuid.UUID,
    payload: UpdateDataSourceRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật nguồn dữ liệu."""
    result = await db.execute(
        select(InsightDataSource)
        .where(
            InsightDataSource.id == source_id,
            InsightDataSource.user_id == current_user.id,
        )
    )
    source = result.scalar_one_or_none()

    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")

    if payload.name:
        source.name = payload.name

    if payload.table_data:
        source.schema_json = {
            "columns": [c.model_dump() for c in payload.table_data.columns]
        }
        source.data_json = {
            "rows": payload.table_data.rows
        }

    await db.commit()

    return {"success": True}


@router.delete("/data-sources/{source_id}")
async def delete_data_source(
    source_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Xóa nguồn dữ liệu."""
    result = await db.execute(
        select(InsightDataSource)
        .where(
            InsightDataSource.id == source_id,
            InsightDataSource.user_id == current_user.id,
        )
    )
    source = result.scalar_one_or_none()

    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")

    await db.delete(source)
    await db.commit()

    return {"success": True}


# ============= CHAT APIs =============

@router.get("/chats")
async def list_chats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách cuộc hội thoại."""
    result = await db.execute(
        select(InsightChat)
        .where(InsightChat.user_id == current_user.id)
        .options(selectinload(InsightChat.messages))
        .order_by(desc(InsightChat.updated_at))
        .limit(20)
    )
    chats = result.scalars().all()

    return [
        {
            "id": str(c.id),
            "data_source_id": str(c.data_source_id),
            "insight_run_id": str(c.insight_run_id) if c.insight_run_id else None,
            "title": c.title,
            "status": c.status,
            "message_count": len(c.messages),
            "last_message": c.messages[-1].content[:100] if c.messages else None,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
        }
        for c in chats
    ]


@router.post("/chats")
async def create_chat(
    data_source_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Tạo cuộc hội thoại mới."""
    result = await db.execute(
        select(InsightDataSource)
        .where(
            InsightDataSource.id == data_source_id,
            InsightDataSource.user_id == current_user.id,
        )
    )
    source = result.scalar_one_or_none()

    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")

    chat = InsightChat(
        user_id=current_user.id,
        data_source_id=data_source_id,
        title=f"Phân tích: {source.name}",
    )

    db.add(chat)
    await db.commit()
    await db.refresh(chat)

    return {
        "id": str(chat.id),
        "data_source_id": str(chat.data_source_id),
        "title": chat.title,
        "created_at": chat.created_at.isoformat(),
    }


@router.get("/chats/{chat_id}")
async def get_chat(
    chat_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Lấy chi tiết cuộc hội thoại."""
    result = await db.execute(
        select(InsightChat)
        .where(
            InsightChat.id == chat_id,
            InsightChat.user_id == current_user.id,
        )
        .options(selectinload(InsightChat.messages))
    )
    chat = result.scalar_one_or_none()

    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    ds_result = await db.execute(
        select(InsightDataSource)
        .where(InsightDataSource.id == chat.data_source_id)
    )
    data_source = ds_result.scalar_one_or_none()

    return {
        "id": str(chat.id),
        "data_source_id": str(chat.data_source_id),
        "insight_run_id": str(chat.insight_run_id) if chat.insight_run_id else None,
        "title": chat.title,
        "status": chat.status,
        "messages": [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "message_context": m.message_context,
                "suggested_visualizations": m.suggested_visualizations,
                "created_at": m.created_at.isoformat(),
            }
            for m in chat.messages
        ],
        "data_source_context": {
            "name": data_source.name if data_source else None,
            "schema": data_source.schema_json if data_source else None,
            "row_count": len(data_source.data_json.get("rows", [])) if data_source and data_source.data_json else 0,
            "sample_rows": data_source.data_json.get("rows", [])[:10] if data_source and data_source.data_json else [],
        } if data_source else None,
        "created_at": chat.created_at.isoformat(),
        "updated_at": chat.updated_at.isoformat(),
    }


@router.post("/chats/{chat_id}/messages")
async def send_message(
    chat_id: uuid.UUID,
    payload: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Gửi tin nhắn với enhanced intelligence.
    Hỗ trợ:
    - Data queries (khi có data)
    - Data manipulation (tạo/sửa/xóa cột, dòng)
    - CSV operations (append, merge)
    - Guidance mode (khi không có data)
    """
    # Get chat
    result = await db.execute(
        select(InsightChat)
        .where(
            InsightChat.id == chat_id,
            InsightChat.user_id == current_user.id,
        )
        .options(selectinload(InsightChat.messages))
    )
    chat = result.scalar_one_or_none()

    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    # Get data source
    ds_result = await db.execute(
        select(InsightDataSource)
        .where(InsightDataSource.id == chat.data_source_id)
    )
    data_source = ds_result.scalar_one_or_none()

    # Check if data source has data
    has_data = (
        data_source is not None and 
        data_source.data_json is not None and 
        len(data_source.data_json.get("rows", [])) > 0
    )

    # Get insight run result if exists
    insight_result = None
    if chat.insight_run_id:
        from models.insight_result_snapshot import InsightResultSnapshot
        snap_result = await db.execute(
            select(InsightResultSnapshot)
            .where(InsightResultSnapshot.run_id == chat.insight_run_id)
            .order_by(desc(InsightResultSnapshot.created_at))
            .limit(1)
        )
        snapshot = snap_result.scalar_one_or_none()
        if snapshot:
            insight_result = snapshot.result_json

    # Build messages history
    messages_history = [
        {"role": m.role, "content": m.content}
        for m in chat.messages[-20:]
    ]

    # Initialize intelligence modules
    context_builder = ContextBuilder()
    intent_classifier = IntentClassifier()
    reference_resolver = ReferenceResolver()
    entity_linker = EntityLinker()
    data_manipulator = DataManipulationAgent()
    guidance_agent = GuidanceAgent()

    # 1. Classify intent
    intent = intent_classifier.classify(payload.content)
    intent_info = {
        "type": intent.type.value,
        "confidence": intent.confidence,
        "entities": intent.entities,
        "parameters": intent.parameters,
        "suggested_format": intent.suggested_response_format,
        "follow_ups": intent.follow_up_suggestions,
        "requires_data": intent.requires_data,
    }

    response_text = ""
    extra_data = {"intent": intent_info}
    manipulation_result = None
    guidance_result = None

    # 2. Handle based on intent type
    
    # ===== GUIDANCE MODE (no data needed) =====
    if not has_data or intent.type in {
        IntentType.GREETING,
        IntentType.HELP_REQUEST,
        IntentType.GUIDANCE_HOW_TO,
        IntentType.GUIDANCE_RECOMMENDATION,
        IntentType.GUIDANCE_BEST_PRACTICE,
        IntentType.GUIDANCE_CSV_FORMAT,
        IntentType.GUIDANCE_METRICS,
        IntentType.GUIDANCE_UNDERSTAND,
        IntentType.SUGGEST_NEXT,
    }:
        guidance_result = guidance_agent.classify_and_get_guidance(
            user_input=payload.content,
            context={"has_data": has_data},
        )
        response_text = guidance_result.message
        extra_data["guidance"] = format_guidance_for_response(guidance_result)
    
    # ===== DATA MANIPULATION (requires data) =====
    elif intent.type in {
        IntentType.DATA_CREATE_COLUMN,
        IntentType.DATA_EDIT_COLUMN,
        IntentType.DATA_DELETE_COLUMN,
        IntentType.DATA_ADD_ROW,
        IntentType.DATA_EDIT_ROW,
        IntentType.DATA_DELETE_ROW,
    }:
        # Get data and schema
        data = data_source.data_json.get("rows", []) if data_source else []
        schema = data_source.schema_json.get("columns", []) if data_source else []
        
        # Map intent to operation
        operation_map = {
            IntentType.DATA_CREATE_COLUMN: "create_column",
            IntentType.DATA_EDIT_COLUMN: "edit_column",
            IntentType.DATA_DELETE_COLUMN: "delete_column",
            IntentType.DATA_ADD_ROW: "add_row",
            IntentType.DATA_EDIT_ROW: "edit_row",
            IntentType.DATA_DELETE_ROW: "delete_row",
        }
        
        operation = operation_map.get(intent.type, "")
        
        # Execute manipulation
        manipulation_result = await data_manipulator.execute(
            operation=operation,
            data=data,
            schema=schema,
            params=intent.parameters,
        )
        
        if manipulation_result.success:
            # Update data source
            data_source.data_json = {"rows": manipulation_result.new_data}
            data_source.schema_json = {"columns": manipulation_result.new_schema}
            await db.commit()
            
            response_text = manipulation_result.message
            extra_data["manipulation"] = format_manipulation_result(manipulation_result)
        else:
            response_text = f"❌ {manipulation_result.message}"
    
    # ===== CSV OPERATIONS =====
    elif intent.type in {IntentType.CSV_APPEND, IntentType.CSV_REPLACE, IntentType.CSV_MERGE}:
        # Get CSV data from message context (file upload)
        csv_data = payload.message_context.get("csv_data", []) if payload.message_context else []
        
        if not csv_data:
            response_text = "Bạn cần upload file CSV trước. Dùng nút 'Upload CSV' để thêm dữ liệu."
            extra_data["action_required"] = "upload_csv"
        else:
            data = data_source.data_json.get("rows", []) if data_source else []
            schema = data_source.schema_json.get("columns", []) if data_source else []
            
            operation_map = {
                IntentType.CSV_APPEND: "append_csv",
                IntentType.CSV_REPLACE: "replace_csv",
                IntentType.CSV_MERGE: "merge_csv",
            }
            
            operation = operation_map.get(intent.type, "")
            params = {
                **intent.parameters,
                "csv_data": csv_data,
                "csv_schema": payload.message_context.get("csv_schema", []),
            }
            
            manipulation_result = await data_manipulator.execute(
                operation=operation,
                data=data,
                schema=schema,
                params=params,
            )
            
            if manipulation_result.success:
                data_source.data_json = {"rows": manipulation_result.new_data}
                data_source.schema_json = {"columns": manipulation_result.new_schema}
                await db.commit()
                
                response_text = manipulation_result.message
                extra_data["manipulation"] = format_manipulation_result(manipulation_result)
            else:
                response_text = f"❌ {manipulation_result.message}"
    
    # ===== DATA QUERIES & ANALYSIS (requires data) =====
    else:
        # Build context
        chat_context = await context_builder.build(
            data_source=data_source,
            insight_result=insight_result,
            messages=messages_history,
            current_input=payload.content,
        )

        # Resolve references và link entities
        resolved_input, detected_entities = await reference_resolver.resolve(
            user_input=payload.content,
            data_context=chat_context.data,
            chat_history=messages_history,
            memory=None,
        )
        
        linked_entities = entity_linker.link(
            entities=detected_entities,
            data_context=chat_context.data,
            insight_data=chat_context.insight,
        )
        
        chat_context.resolved_input = resolved_input
        chat_context.detected_entities = linked_entities

        # Generate response
        response_text, query_extra_data = await _generate_response(
            context=chat_context,
            messages=messages_history,
            intent_info=intent_info,
        )
        extra_data.update(query_extra_data)

    # Save user message
    user_msg = InsightChatMessage(
        chat_id=chat.id,
        role="user",
        content=payload.content,
        message_context={
            "intent": intent_info,
            "resolved_input": resolved_input if "resolved_input" in dir() else None,
            "detected_entities": detected_entities if "detected_entities" in dir() else None,
        },
    )
    db.add(user_msg)
    await db.flush()

    # Save assistant message
    assistant_msg = InsightChatMessage(
        chat_id=chat.id,
        role="assistant",
        content=response_text,
        message_context={
            "intent": intent_info,
            "manipulation": format_manipulation_result(manipulation_result) if manipulation_result else None,
            "guidance": format_guidance_for_response(guidance_result) if guidance_result else None,
        },
        suggested_visualizations=extra_data.get("visualizations"),
    )
    db.add(assistant_msg)

    await db.commit()
    await db.refresh(assistant_msg)

    return {
        "user_message": {
            "id": str(user_msg.id),
            "role": user_msg.role,
            "content": user_msg.content,
            "created_at": user_msg.created_at.isoformat(),
        },
        "assistant_message": {
            "id": str(assistant_msg.id),
            "role": assistant_msg.role,
            "content": assistant_msg.content,
            "intent": intent_info,
            "manipulation": extra_data.get("manipulation"),
            "guidance": extra_data.get("guidance"),
            "action_required": extra_data.get("action_required"),
            "detected_entities": linked_entities if "linked_entities" in dir() else None,
            "suggested_visualizations": assistant_msg.suggested_visualizations,
            "created_at": assistant_msg.created_at.isoformat(),
        },
        "has_data": has_data,
    }


@router.delete("/chats/{chat_id}")
async def delete_chat(
    chat_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Xóa cuộc hội thoại."""
    result = await db.execute(
        select(InsightChat)
        .where(
            InsightChat.id == chat_id,
            InsightChat.user_id == current_user.id,
        )
    )
    chat = result.scalar_one_or_none()

    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    await db.delete(chat)
    await db.commit()

    return {"success": True}
