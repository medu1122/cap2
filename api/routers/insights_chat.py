from __future__ import annotations

import json
import uuid
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.config import settings
from core.database import get_db
from core.deps import get_current_user

from models.user import User
from models.insight_chat import InsightChat, InsightChatMessage
from models.insight_data_source import InsightDataSource

from services.insight_intelligence import (
    CalculatorAgent,
    ChatContext,
    ContextBuilder,
    DataManipulationAgent,
    EntityLinker,
    GuidanceAgent,
    IntentClassifier,
    IntentType,
    ReferenceResolver,
    VisualizationPlanner,
    format_computation_for_response,
    format_guidance_for_response,
    format_manipulation_result,
    format_visualization_for_response,
)

router = APIRouter()


# =========================================================
# SCHEMAS
# =========================================================

class ColumnSchema(BaseModel):
    name: str
    data_type: str = "text"


class TableDataSchema(BaseModel):
    columns: list[ColumnSchema]
    rows: list[dict[str, Any]]


class CreateDataSourceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    source_type: str = "manual"
    table_data: TableDataSchema | None = None


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1)
    message_context: dict[str, Any] | None = None


# =========================================================
# HELPERS
# =========================================================
try:
    QWEN_TIMEOUT = int(settings.QWEN_TIMEOUT or 180)
except Exception:
    QWEN_TIMEOUT = 180

QWEN_TIMEOUT = max(30, min(300, QWEN_TIMEOUT))
async def chat_completion(
    messages: list[dict[str, str]],
    temperature: float = 0.3,
) -> str:
    """
    Call Qwen/OpenAI compatible API.
    """

    url = f"{settings.QWEN_BASE_URL.rstrip('/')}/chat/completions"

    headers = {
        "Content-Type": "application/json",
    }

    if settings.OPENAI_API_KEY:
        headers["Authorization"] = f"Bearer {settings.OPENAI_API_KEY}"

    payload = {
        "model": settings.QWEN_MODEL,
        "messages": messages,
        "temperature": temperature,
        "stream": False,
    }

    timeout = httpx.Timeout(
    timeout=240,
    connect=30,
    )

    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(
            url,
            headers=headers,
            json=payload,
        )

        response.raise_for_status()

        data = response.json()

    return data["choices"][0]["message"]["content"]


def build_system_prompt(
    context: ChatContext,
    intent_info: dict[str, Any],
    computation_result: Any | None = None,
) -> str:

    lines: list[str] = []

    lines.append("Bạn là AI Data Analyst chuyên phân tích dữ liệu kinh doanh.")
    lines.append("Trả lời bằng tiếng Việt.")
    lines.append("Ngắn gọn, chính xác, dễ hiểu.")
    lines.append("")

    # =====================================================
    # DATASET INFO
    # =====================================================

    lines.append("=== THÔNG TIN DATASET ===")

    if context.data and context.data.columns:
        lines.append(f"Số dòng: {context.data.row_count}")
        lines.append(f"Số cột: {len(context.data.columns)}")

        lines.append("")
        lines.append("Danh sách cột:")

        for col in context.data.columns:
            sample = ", ".join(map(str, col.sample_values[:3])) if col.sample_values else ""

            lines.append(
                f"- {col.name} ({col.data_type}) | ví dụ: {sample}"
            )

    # =====================================================
    # RESOLVED QUESTION
    # =====================================================

    if context.resolved_input:
        lines.append("")
        lines.append("=== CÂU HỎI ĐÃ RESOLVE ===")
        lines.append(context.resolved_input)

    # =====================================================
    # ENTITIES
    # =====================================================

    if context.detected_entities:
        lines.append("")
        lines.append("=== ENTITIES ===")

        primary = context.detected_entities.get("primary_metric")

        if primary:
            lines.append(
                f"Primary: {primary.get('entity')} -> {primary.get('linked_column')}"
            )

    # =====================================================
    # COMPUTATION
    # =====================================================

    if computation_result and computation_result.success:
        lines.append("")
        lines.append("=== KẾT QUẢ TÍNH TOÁN ===")

        formatted = format_computation_for_response(computation_result)

        lines.append(json.dumps(formatted, ensure_ascii=False))

    # =====================================================
    # CHAT HISTORY
    # =====================================================

    history = context.to_chat_history_text()

    if history:
        lines.append("")
        lines.append("=== LỊCH SỬ CHAT ===")
        lines.append(history)

    # =====================================================
    # RULES
    # =====================================================

    lines.append("")
    lines.append("=== QUY TẮC ===")
    lines.append("1. Luôn dùng số liệu cụ thể.")
    lines.append("2. Nếu không biết thì nói không chắc.")
    lines.append("3. Không bịa dữ liệu.")
    lines.append("4. Trả lời tối đa 8-12 dòng.")
    lines.append("5. Có thể gợi ý chart phù hợp.")

    # =====================================================
    # INTENT
    # =====================================================

    lines.append("")
    lines.append(f"Intent hiện tại: {intent_info.get('type')}")

    return "\n".join(lines)


async def generate_ai_response(
    *,
    context: ChatContext,
    intent_info: dict[str, Any],
    current_input: str,
    messages_history: list[dict[str, str]],
) -> tuple[str, dict[str, Any]]:

    calculator = CalculatorAgent()

    computation_result = None

    try:
        primary_metric = (
            context.detected_entities.get("primary_metric")
            if context.detected_entities
            else None
        )

        if (
            primary_metric
            and primary_metric.get("linked_column")
            and context.full_data
        ):
            computation_result = await calculator.compute(
                computation_type=intent_info.get("type"),
                data=context.full_data,
                column=primary_metric["linked_column"],
                context=intent_info.get("parameters"),
            )

    except Exception:
        computation_result = None

    system_prompt = build_system_prompt(
        context=context,
        intent_info=intent_info,
        computation_result=computation_result,
    )

    llm_messages = [
        {
            "role": "system",
            "content": system_prompt,
        },
        *messages_history[-10:],
        {
            "role": "user",
            "content": context.resolved_input or current_input,
        },
    ]

    try:
        response_text = await chat_completion(llm_messages)

    except Exception as e:
        if computation_result and computation_result.success:
            formatted = format_computation_for_response(
                computation_result
            )

            return (
                f"Kết quả tính toán:\n{json.dumps(formatted, ensure_ascii=False, indent=2)}",
                {
                    "fallback": True,
                    "warning": str(e),
                },
            )

        raise HTTPException(
            status_code=500,
            detail=f"LLM Error: {str(e)}",
        )

    viz_planner = VisualizationPlanner()

    viz_plan = viz_planner.plan(
        intent_type=intent_info.get("type"),
        data_context=context.data,
        computation_result=computation_result,
        entities=context.detected_entities,
    )

    extra_data = {
        "visualizations": format_visualization_for_response(viz_plan),
    }

    if computation_result and computation_result.success:
        extra_data["computation"] = (
            format_computation_for_response(computation_result)
        )

    return response_text, extra_data


# =========================================================
# DATA SOURCES
# =========================================================

@router.get("/data-sources")
async def list_data_sources(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    result = await db.execute(
        select(InsightDataSource)
        .where(InsightDataSource.user_id == current_user.id)
        .order_by(desc(InsightDataSource.updated_at))
    )

    sources = result.scalars().all()

    return [
        {
            "id": str(s.id),
            "name": s.name,
            "row_count": len(s.data_json.get("rows", []))
            if s.data_json
            else 0,
            "created_at": s.created_at.isoformat(),
        }
        for s in sources
    ]


@router.post("/data-sources")
async def create_data_source(
    payload: CreateDataSourceRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    if not payload.table_data:
        raise HTTPException(
            status_code=400,
            detail="table_data required",
        )

    source = InsightDataSource(
        user_id=current_user.id,
        name=payload.name,
        source_type=payload.source_type,
        schema_json={
            "columns": [
                c.model_dump()
                for c in payload.table_data.columns
            ]
        },
        data_json={
            "rows": payload.table_data.rows
        },
    )

    db.add(source)

    await db.commit()
    await db.refresh(source)

    return {
        "id": str(source.id),
        "name": source.name,
    }


# =========================================================
# CHAT
# =========================================================

@router.post("/chats")
async def create_chat(
    data_source_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    result = await db.execute(
        select(InsightDataSource).where(
            InsightDataSource.id == data_source_id,
            InsightDataSource.user_id == current_user.id,
        )
    )

    source = result.scalar_one_or_none()

    if not source:
        raise HTTPException(404, "Data source not found")

    chat = InsightChat(
        user_id=current_user.id,
        data_source_id=source.id,
        title=f"Chat - {source.name}",
    )

    db.add(chat)

    await db.commit()
    await db.refresh(chat)

    return {
        "id": str(chat.id),
        "title": chat.title,
    }


@router.get("/chats/{chat_id}")
async def get_chat(
    chat_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

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
        raise HTTPException(404, "Chat not found")

    return {
        "id": str(chat.id),
        "title": chat.title,
        "messages": [
            {
                "id": str(m.id),
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at.isoformat(),
            }
            for m in chat.messages
        ],
    }


@router.post("/chats/{chat_id}/messages")
async def send_message(
    chat_id: uuid.UUID,
    payload: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    # =====================================================
    # LOAD CHAT
    # =====================================================

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
        raise HTTPException(404, "Chat not found")

    # =====================================================
    # LOAD DATA SOURCE
    # =====================================================

    ds_result = await db.execute(
        select(InsightDataSource).where(
            InsightDataSource.id == chat.data_source_id
        )
    )

    data_source = ds_result.scalar_one_or_none()

    # =====================================================
    # BUILD HISTORY
    # =====================================================

    messages_history = [
        {
            "role": m.role,
            "content": m.content,
        }
        for m in chat.messages[-20:]
    ]

    # =====================================================
    # INTELLIGENCE
    # =====================================================

    context_builder = ContextBuilder()
    intent_classifier = IntentClassifier()
    reference_resolver = ReferenceResolver()
    entity_linker = EntityLinker()

    guidance_agent = GuidanceAgent()
    manipulation_agent = DataManipulationAgent()

    # =====================================================
    # CLASSIFY INTENT
    # =====================================================

    intent = intent_classifier.classify(payload.content)

    intent_info = {
        "type": intent.type.value,
        "confidence": intent.confidence,
        "entities": intent.entities,
        "parameters": intent.parameters,
    }

    # =====================================================
    # GUIDANCE MODE
    # =====================================================

    if intent.type in {
        IntentType.GREETING,
        IntentType.HELP_REQUEST,
        IntentType.GUIDANCE_HOW_TO,
    }:

        _, guidance = guidance_agent.classify_and_get_guidance(
            user_input=payload.content,
            context={},
        )

        response_text = guidance.message

        extra_data = {
            "guidance": format_guidance_for_response(guidance)
        }

    # =====================================================
    # DATA MANIPULATION
    # =====================================================

    elif intent.type in {
        IntentType.DATA_CREATE_COLUMN,
        IntentType.DATA_DELETE_COLUMN,
        IntentType.DATA_ADD_ROW,
    }:

        result = await manipulation_agent.execute(
            operation=intent.type.value,
            data=data_source.data_json.get("rows", []),
            schema=data_source.schema_json.get("columns", []),
            params=intent.parameters,
        )

        if result.success:

            data_source.data_json = {
                "rows": result.new_data
            }

            data_source.schema_json = {
                "columns": result.new_schema
            }

            await db.commit()

        response_text = result.message

        extra_data = {
            "manipulation": format_manipulation_result(result)
        }

    # =====================================================
    # ANALYSIS MODE
    # =====================================================

    else:

        context = await context_builder.build(
            data_source=data_source,
            insight_result=None,
            messages=messages_history,
            current_input=payload.content,
        )

        resolved_input, detected_entities = (
            await reference_resolver.resolve(
                user_input=payload.content,
                data_context=context.data,
                chat_history=messages_history,
                memory=None,
            )
        )

        linked_entities = entity_linker.link(
            entities=detected_entities,
            data_context=context.data,
            insight_data=context.insight,
        )

        context.resolved_input = resolved_input
        context.detected_entities = linked_entities

        response_text, extra_data = await generate_ai_response(
            context=context,
            intent_info=intent_info,
            current_input=payload.content,
            messages_history=messages_history,
        )

    # =====================================================
    # SAVE USER MESSAGE
    # =====================================================

    user_msg = InsightChatMessage(
        chat_id=chat.id,
        role="user",
        content=payload.content,
    )

    db.add(user_msg)

    # =====================================================
    # SAVE ASSISTANT MESSAGE
    # =====================================================

    assistant_msg = InsightChatMessage(
        chat_id=chat.id,
        role="assistant",
        content=response_text,
        message_context=extra_data,
        suggested_visualizations=extra_data.get(
            "visualizations"
        ),
    )

    db.add(assistant_msg)

    await db.commit()

    await db.refresh(user_msg)
    await db.refresh(assistant_msg)

    return {
        "user_message": {
            "id": str(user_msg.id),
            "content": user_msg.content,
        },
        "assistant_message": {
            "id": str(assistant_msg.id),
            "content": assistant_msg.content,
            "extra_data": extra_data,
        },
    }


@router.delete("/chats/{chat_id}")
async def delete_chat(
    chat_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):

    result = await db.execute(
        select(InsightChat).where(
            InsightChat.id == chat_id,
            InsightChat.user_id == current_user.id,
        )
    )

    chat = result.scalar_one_or_none()

    if not chat:
        raise HTTPException(404, "Chat not found")

    await db.delete(chat)

    await db.commit()

    return {
        "success": True
    }