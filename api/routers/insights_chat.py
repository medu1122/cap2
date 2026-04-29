from __future__ import annotations

import json
import uuid
import hashlib
from typing import Any

import httpx
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, desc, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.database import get_db
from core.deps import get_current_user
from core.config import settings
from models.user import User
from models.insight_data_source import InsightDataSource
from models.insight_chat import InsightChat, InsightChatMessage

router = APIRouter()


# ============= SCHEMAS =============

class ColumnSchema(BaseModel):
    name: str
    data_type: str = "text"  # "text" | "number" | "date"


class TableDataSchema(BaseModel):
    columns: list[ColumnSchema]
    rows: list[dict[str, Any]]


class CreateDataSourceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    source_type: str = Field(default="manual")  # "manual" | "csv_upload" | "xlsx_upload"
    table_data: TableDataSchema | None = None
    file_upload_id: uuid.UUID | None = None


class UpdateDataSourceRequest(BaseModel):
    name: str | None = None
    table_data: TableDataSchema | None = None


class SendMessageRequest(BaseModel):
    chat_id: uuid.UUID | None = None
    data_source_id: uuid.UUID | None = None
    content: str = Field(min_length=1)
    message_context: dict[str, Any] | None = None


class ChatMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    message_context: dict | None = None
    suggested_visualizations: list | None = None
    created_at: str


class ChatResponse(BaseModel):
    id: str
    data_source_id: str
    insight_run_id: str | None
    title: str | None
    status: str
    messages: list[ChatMessageResponse]
    created_at: str
    updated_at: str


# ============= HELPERS =============

def _compute_data_fingerprint(columns: list[str], sample_rows: list[dict]) -> str:
    """Tạo fingerprint cho dữ liệu để cache/analyze."""
    return hashlib.sha256(
        f"{columns}:{len(sample_rows)}".encode()
    ).hexdigest()[:16]


async def _call_llm_for_response(
    messages: list[dict[str, str]],
    context: dict[str, Any],
) -> tuple[str, dict[str, Any]]:
    """
    Gọi LLM để generate response cho user.
    Trả về (response_text, extra_data).
    """
    # Chuẩn bị system prompt với context
    schema = context.get("schema", {})
    kpis = context.get("kpis", {})
    data_sample = context.get("data_sample", [])

    # Build columns description
    columns_desc = []
    for col in schema.get("columns", []):
        columns_desc.append(f"- {col['name']}: {col['data_type']}")
    columns_text = "\n".join(columns_desc) if columns_desc else "Chưa có cột"

    # Build sample rows
    sample_text = ""
    if data_sample:
        sample_rows = data_sample[:5]  # Chỉ gửi 5 dòng đầu
        sample_text = f"\n\nMẫu dữ liệu (5 dòng đầu):\n{json.dumps(sample_rows, ensure_ascii=False, indent=2)}"

    system_prompt = f"""Bạn là AI Assistant cho phân tích dữ liệu kinh doanh.

## Nguồn dữ liệu hiện tại:
- Tên: {context.get('data_source_name', 'Không rõ')}
- Số cột: {len(schema.get('columns', []))}
- Số dòng: {context.get('row_count', 0)}
- Cấu trúc cột:
{columns_text}
{sample_text}

## KPI đã phân tích (nếu có):
{json.dumps(kpis, ensure_ascii=False, indent=2)}

## Quy tắc trả lời:
1. Trả lời ngắn gọn, đi thẳng vào vấn đề
2. Khi tham chiếu đến cột/dòng, dùng format: **Cột: [tên]**, **Dòng: #số**
3. Đưa ra gợi ý hành động cụ thể khi có số liệu
4. Nếu user hỏi về dữ liệu cụ thể, trích dẫn số liệu thực tế
5. Nếu không đủ thông tin, nói rõ cần thêm gì
"""

    try:
        response_text = await _chat_completion(
            base_url=settings.DEEPSEEK_BASE_URL,
            model=settings.DEEPSEEK_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                *messages,
            ],
            timeout_seconds=60,
        )
        return response_text, {}
    except Exception as e:
        return f"Xin lỗi, đã có lỗi khi xử lý: {str(e)}", {}


async def _chat_completion(
    *,
    base_url: str,
    model: str,
    messages: list[dict[str, str]],
    timeout_seconds: int = 45,
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
    """Tạo nguồn dữ liệu mới (table tay hoặc từ file upload)."""
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
    """Cập nhật nguồn dữ liệu (thêm/sửa cột, thêm dòng)."""
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
    """Tạo cuộc hội thoại mới cho một data source."""
    # Verify data source belongs to user
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
    """Lấy chi tiết cuộc hội thoại với messages."""
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

    # Get data source for context
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
    """Gửi tin nhắn và nhận phản hồi từ AI."""
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

    # Save user message
    user_msg = InsightChatMessage(
        chat_id=chat.id,
        role="user",
        content=payload.content,
        message_context=payload.message_context,
    )
    db.add(user_msg)
    await db.flush()

    # Build context for LLM
    context = {
        "data_source_name": data_source.name if data_source else "Không rõ",
        "schema": data_source.schema_json if data_source else {},
        "row_count": len(data_source.data_json.get("rows", [])) if data_source and data_source.data_json else 0,
        "data_sample": data_source.data_json.get("rows", [])[:10] if data_source and data_source.data_json else [],
        "kpis": insight_result.get("kpis", {}) if insight_result else {},
        "insights": insight_result.get("insights", []) if insight_result else [],
    }

    # Build messages for LLM
    messages_for_llm = [
        {"role": m.role, "content": m.content}
        for m in chat.messages[-10:]  # Chỉ gửi 10 messages gần nhất
    ]
    messages_for_llm.append({"role": "user", "content": payload.content})

    # Get AI response
    response_text, extra_data = await _call_llm_for_response(messages_for_llm, context)

    # Save assistant message
    assistant_msg = InsightChatMessage(
        chat_id=chat.id,
        role="assistant",
        content=response_text,
        message_context=payload.message_context,
        suggested_visualizations=extra_data.get("visualizations"),
    )
    db.add(assistant_msg)

    # Update chat timestamp
    chat.updated_at = chat.updated_at  # This will auto-update due to onupdate

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
            "suggested_visualizations": assistant_msg.suggested_visualizations,
            "created_at": assistant_msg.created_at.isoformat(),
        },
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
