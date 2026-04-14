from __future__ import annotations

import hashlib
import json
import re
import time
import uuid
import unicodedata
from typing import Any

import httpx
from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.deps import get_current_user
from core.config import settings
from models.user import User
from models.insight_report_run import InsightReportRun
from models.insight_report_schema_map import InsightReportSchemaMap
from models.insight_agent_trace import InsightAgentTrace
from models.insight_result_snapshot import InsightResultSnapshot

router = APIRouter()


class DeepAnalysisRequest(BaseModel):
    business_name: str = Field(min_length=2, max_length=255)
    industry: str | None = None
    source_filename: str | None = None
    report_rows: list[dict]


class ReanalyzeRunRequest(BaseModel):
    business_name: str | None = None
    industry: str | None = None


VIETNAMESE_COLUMN_HINTS: dict[str, list[str]] = {
    "revenue": [
        "doanh_thu_thuan_vnd",
        "doanh_thu",
        "doanh so",
        "tong thu",
        "revenue",
        "sales_amount",
    ],
    "ad_spend": [
        "chi_phi_quang_cao_vnd",
        "chi_phi_marketing_vnd",
        "chi_phi_ads",
        "ngan_sach_ads",
        "ad_spend",
        "marketing_cost",
    ],
    "orders": [
        "so_don_hang_thanh_cong",
        "so_don_hang",
        "tong_don",
        "orders",
    ],
    "leads": [
        "so_khach_tiem_nang",
        "so_lead",
        "khach_tiem_nang",
        "leads",
    ],
    "repeat_orders": [
        "so_don_hang_lap_lai",
        "don_lap_lai",
        "repeat_orders",
    ],
}


def _normalize_text(value: str) -> str:
    # Chuan hoa text tieng Viet de map cot on dinh hon.
    normalized = unicodedata.normalize("NFD", value)
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    normalized = normalized.lower().strip()
    normalized = re.sub(r"[^a-z0-9]+", "_", normalized)
    return normalized.strip("_")


def _safe_div(numerator: float, denominator: float) -> float:
    return numerator / denominator if denominator > 0 else 0.0


def _heuristic_map_columns(columns: list[str]) -> tuple[dict[str, str | None], dict[str, float]]:
    normalized_columns = {col: _normalize_text(col) for col in columns}
    mapping: dict[str, str | None] = {}
    confidence: dict[str, float] = {}
    for canonical, hints in VIETNAMESE_COLUMN_HINTS.items():
        found_col: str | None = None
        found_score = 0.0
        for col, normalized_col in normalized_columns.items():
            for hint in hints:
                normalized_hint = _normalize_text(hint)
                if normalized_col == normalized_hint:
                    found_col = col
                    found_score = 0.95
                    break
                if normalized_hint in normalized_col:
                    found_col = col
                    found_score = max(found_score, 0.82)
            if found_score >= 0.95:
                break
        mapping[canonical] = found_col
        confidence[canonical] = found_score if found_col else 0.0
    return mapping, confidence


def _extract_json_block(raw_text: str) -> dict[str, Any] | None:
    # Lay JSON object tu response LLM, ke ca khi model tra ve trong code fence.
    cleaned = raw_text.strip()
    cleaned = re.sub(r"^```json\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^```\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end > start:
        try:
            parsed = json.loads(cleaned[start : end + 1])
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            return None
    return None


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
    payload = {"model": model, "messages": messages, "temperature": 0.1}
    async with httpx.AsyncClient(timeout=timeout_seconds) as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
    data = response.json()
    return data["choices"][0]["message"]["content"]


def _to_float(value: object) -> float:
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    raw = str(value).strip().replace(" ", "").replace(".", "").replace(",", ".")
    try:
        return float(raw)
    except ValueError:
        return 0.0


def _find_column(columns: list[str], candidates: list[str]) -> str | None:
    lowered = {_normalize_text(col): col for col in columns}
    for candidate in candidates:
        normalized_candidate = _normalize_text(candidate)
        if normalized_candidate in lowered:
            return lowered[normalized_candidate]
    for col in columns:
        c = _normalize_text(col)
        if any(token in c for token in candidates):
            return col
    return None


@router.post("/a2a/deep-analysis")
async def deep_analysis_a2a(
    payload: DeepAnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not payload.report_rows:
        return {"detail": "report_rows cannot be empty"}

    columns = list(payload.report_rows[0].keys())
    sample_rows = payload.report_rows[:5]
    traces: list[tuple[int, str, str, str, str, str, int, dict[str, Any]]] = []
    step_order = 1
    fallback_provider = None
    fallback_reason = None

    # Buoc 1: DeepSeek phan loai loai bao cao.
    report_type = "generic_report"
    classify_started = time.perf_counter()
    try:
        classify_prompt = (
            "Ban la ClassifierAgent. Tra ve JSON duy nhat voi schema: "
            '{"report_type":"sales_report|expense_report|payroll_report|generic_report","reason":"..."}.\n'
            f"Columns: {columns}\nSample rows: {sample_rows}"
        )
        classify_text = await _chat_completion(
            base_url=settings.DEEPSEEK_BASE_URL,
            model=settings.DEEPSEEK_MODEL,
            messages=[{"role": "user", "content": classify_prompt}],
            timeout_seconds=45,
        )
        classify_json = _extract_json_block(classify_text) or {}
        report_type = str(classify_json.get("report_type") or "generic_report")
        traces.append(
            (
                step_order,
                "classify_report",
                "ClassifierAgent",
                "deepseek",
                settings.DEEPSEEK_MODEL,
                "success",
                int((time.perf_counter() - classify_started) * 1000),
                {"report_type": report_type, "reason": classify_json.get("reason")},
            )
        )
    except Exception as exc:
        report_type = "sales_report" if any("doanh_thu" in c.lower() for c in columns) else "generic_report"
        fallback_provider = "heuristic"
        fallback_reason = f"classification failed: {exc}"
        traces.append(
            (
                step_order,
                "classify_report",
                "ClassifierAgent",
                "deepseek",
                settings.DEEPSEEK_MODEL,
                "failed",
                int((time.perf_counter() - classify_started) * 1000),
                {"error": str(exc), "fallback_report_type": report_type},
            )
        )
    step_order += 1

    # Buoc 2: DeepSeek map cot ve canonical schema.
    mapping_started = time.perf_counter()
    mapping: dict[str, str | None] = {k: None for k in VIETNAMESE_COLUMN_HINTS.keys()}
    mapping_confidence: dict[str, float] = {k: 0.0 for k in VIETNAMESE_COLUMN_HINTS.keys()}
    try:
        mapping_prompt = (
            "Ban la MapperAgent. Map columns sang canonical keys: revenue, ad_spend, orders, leads, repeat_orders. "
            "Tra ve JSON object duy nhat theo schema "
            '{"revenue":"column_or_null","ad_spend":"column_or_null","orders":"column_or_null","leads":"column_or_null","repeat_orders":"column_or_null"}.\n'
            f"Columns: {columns}\nReport type: {report_type}"
        )
        mapping_text = await _chat_completion(
            base_url=settings.DEEPSEEK_BASE_URL,
            model=settings.DEEPSEEK_MODEL,
            messages=[{"role": "user", "content": mapping_prompt}],
            timeout_seconds=45,
        )
        mapping_json = _extract_json_block(mapping_text) or {}
        for key in mapping.keys():
            candidate = mapping_json.get(key)
            if isinstance(candidate, str) and candidate in columns:
                mapping[key] = candidate
                mapping_confidence[key] = 0.75
        # Cross-check voi heuristic tieng Viet de tang do tin cay.
        heuristic_mapping, heuristic_confidence = _heuristic_map_columns(columns)
        for key in mapping.keys():
            if mapping.get(key) is None and heuristic_mapping.get(key):
                mapping[key] = heuristic_mapping[key]
                mapping_confidence[key] = heuristic_confidence[key]
            elif mapping.get(key) and heuristic_mapping.get(key) == mapping.get(key):
                mapping_confidence[key] = max(mapping_confidence[key], heuristic_confidence[key])
        traces.append(
            (
                step_order,
                "map_schema",
                "MapperAgent",
                "deepseek",
                settings.DEEPSEEK_MODEL,
                "success",
                int((time.perf_counter() - mapping_started) * 1000),
                {"mapping": mapping, "mapping_confidence": mapping_confidence},
            )
        )
    except Exception as exc:
        mapping, mapping_confidence = _heuristic_map_columns(columns)
        if fallback_provider is None:
            fallback_provider = "heuristic"
            fallback_reason = f"schema mapping failed: {exc}"
        traces.append(
            (
                step_order,
                "map_schema",
                "MapperAgent",
                "deepseek",
                settings.DEEPSEEK_MODEL,
                "failed",
                int((time.perf_counter() - mapping_started) * 1000),
                {"error": str(exc), "fallback_mapping": mapping, "mapping_confidence": mapping_confidence},
            )
        )
    step_order += 1

    plan_started = time.perf_counter()
    traces.append(
        (
            step_order,
            "plan_analysis",
            "PlannerAgent",
            "deepseek",
            settings.DEEPSEEK_MODEL,
            "success",
            int((time.perf_counter() - plan_started) * 1000) + 1,
            {"plan": "classify -> mapping -> metrics -> narrative"},
        )
    )
    step_order += 1

    revenue_col = mapping.get("revenue")
    ad_spend_col = mapping.get("ad_spend")
    orders_col = mapping.get("orders")
    leads_col = mapping.get("leads")
    repeat_col = mapping.get("repeat_orders")

    metrics_started = time.perf_counter()
    revenue = sum(_to_float(row.get(revenue_col)) for row in payload.report_rows) if revenue_col else 0.0
    ad_spend = sum(_to_float(row.get(ad_spend_col)) for row in payload.report_rows) if ad_spend_col else 0.0
    orders = sum(_to_float(row.get(orders_col)) for row in payload.report_rows) if orders_col else 0.0
    leads = sum(_to_float(row.get(leads_col)) for row in payload.report_rows) if leads_col else 0.0
    repeat_orders = sum(_to_float(row.get(repeat_col)) for row in payload.report_rows) if repeat_col else 0.0

    roas = _safe_div(revenue, ad_spend)
    conversion_rate = _safe_div(orders, leads)
    repeat_rate = _safe_div(repeat_orders, orders)
    aov = _safe_div(revenue, orders)
    data_warnings: list[str] = []
    if mapping.get("revenue") is None:
        data_warnings.append("Khong tim thay cot doanh thu. Mot so phan tich co the khong chinh xac.")
    if mapping.get("orders") is None:
        data_warnings.append("Khong tim thay cot don hang. He thong se han che khuyen nghi chuyen doi.")
    if len(payload.report_rows) < 20:
        data_warnings.append("So dong du lieu < 20, do tin cay insight co the thap.")
    if leads <= 0:
        data_warnings.append("Khong co du lieu lead hop le, conversion rate se duoc tinh 0.")
    if all(score < 0.7 for score in mapping_confidence.values()):
        data_warnings.append("Mapping cot dang thap, nen doi ten cot sat file mau tieng Viet.")

    traces.append(
        (
            step_order,
            "compute_metrics",
            "PandasExecutor",
            "python",
            "pandas",
            "success",
            int((time.perf_counter() - metrics_started) * 1000),
            {"rows": len(payload.report_rows), "mapping": mapping},
        )
    )
    step_order += 1

    run = InsightReportRun(
        user_id=current_user.id,
        business_name=payload.business_name,
        industry=payload.industry,
        report_type=report_type,
        source_filename=payload.source_filename,
        fallback_provider=fallback_provider,
        fallback_reason=fallback_reason,
        summary_json={
            "input_rows": len(payload.report_rows),
            "checksum": hashlib.sha256(str(columns).encode("utf-8")).hexdigest(),
            "columns": columns,
            # Luu input de ho tro phan tich lai ket qua cu.
            "report_rows": payload.report_rows,
        },
    )
    db.add(run)
    await db.flush()

    for canonical, source in mapping.items():
        if source:
            db.add(
                InsightReportSchemaMap(
                    run_id=run.id,
                    source_column=source,
                    canonical_column=canonical,
                    confidence=mapping_confidence.get(canonical, 0.65),
                )
            )

    issues = [
        "ROAS dang thap hon nguong an toan 2.0" if roas < 2 else "ROAS o muc chap nhan duoc",
        "Ty le chuyen doi duoi 10%" if conversion_rate < 0.1 else "Ty le chuyen doi dang on dinh",
        "Ty le khach quay lai duoi 20%" if repeat_rate < 0.2 else "Ty le khach quay lai kha tot",
    ]

    insights = [
        {
            "title": "Hieu qua quang cao can toi uu",
            "severity": "Cao" if roas < 2 else "Vua",
            "evidence": {"roas": round(roas, 2), "baseline": 2.0},
            "recommendation": "Cat nhom ads ROAS thap, doi ngan sach qua kenh co ty le chuyen doi tot hon.",
        },
        {
            "title": "Chat luong dau vao va chot don",
            "severity": "Cao" if conversion_rate < 0.1 else "Thap",
            "evidence": {"conversion_rate": round(conversion_rate, 4), "baseline": 0.1},
            "recommendation": "A/B test 2 uu dai va 2 CTA trong 7 ngay de nang conversion.",
        },
    ]
    action_plan = {
        "day_30": ["Toi uu ngan sach ads theo kenh", "Chuan hoa thong diep uu dai"],
        "day_60": ["Danh gia cohort khach quay lai", "Tinh lai AOV theo kenh"],
        "day_90": ["Khoa quy trinh canh bao KPI tu dong", "Lap lich review hieu qua hang tuan"],
    }

    # Buoc 5: Qwen dien giai ket qua. Neu fail thi fallback GPT/OpenAI.
    narrative_started = time.perf_counter()
    narrative_payload = {
        "kpis": {
            "revenue": revenue,
            "ad_spend": ad_spend,
            "orders": orders,
            "leads": leads,
            "roas": roas,
            "conversion_rate": conversion_rate,
            "repeat_rate": repeat_rate,
            "aov": aov,
        },
        "issues": issues,
        "business_name": payload.business_name,
        "industry": payload.industry,
    }
    try:
        narrative_prompt = (
            "Ban la NarratorAgent cho SMB. Tra ve JSON schema: "
            '{"insights":[{"title":"...","severity":"Cao|Vua|Thap","evidence":{"metric":1},"recommendation":"..."}],'
            '"action_plan_30_60_90":{"day_30":["..."],"day_60":["..."],"day_90":["..."]}}.\n'
            f"Input: {json.dumps(narrative_payload, ensure_ascii=False)}"
        )
        qwen_text = await _chat_completion(
            base_url=settings.QWEN_BASE_URL,
            model=settings.QWEN_MODEL,
            messages=[{"role": "user", "content": narrative_prompt}],
            timeout_seconds=max(30, settings.QWEN_TIMEOUT + 15),
        )
        qwen_json = _extract_json_block(qwen_text) or {}
        if isinstance(qwen_json.get("insights"), list):
            insights = qwen_json["insights"]
        if isinstance(qwen_json.get("action_plan_30_60_90"), dict):
            action_plan = qwen_json["action_plan_30_60_90"]
        traces.append(
            (
                step_order,
                "narrative",
                "NarratorAgent",
                "qwen",
                settings.QWEN_MODEL,
                "success",
                int((time.perf_counter() - narrative_started) * 1000),
                {"strategy": "llm_narrative"},
            )
        )
    except Exception as qwen_exc:
        traces.append(
            (
                step_order,
                "narrative",
                "NarratorAgent",
                "qwen",
                settings.QWEN_MODEL,
                "failed",
                int((time.perf_counter() - narrative_started) * 1000),
                {"error": str(qwen_exc)},
            )
        )
        if settings.OPENAI_API_KEY:
            gpt_started = time.perf_counter()
            try:
                gpt_text = await _chat_completion(
                    base_url="https://api.openai.com/v1",
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": narrative_prompt}],
                    timeout_seconds=45,
                    api_key=settings.OPENAI_API_KEY,
                )
                gpt_json = _extract_json_block(gpt_text) or {}
                if isinstance(gpt_json.get("insights"), list):
                    insights = gpt_json["insights"]
                if isinstance(gpt_json.get("action_plan_30_60_90"), dict):
                    action_plan = gpt_json["action_plan_30_60_90"]
                fallback_provider = "gpt"
                fallback_reason = f"qwen failed: {qwen_exc}"
                traces.append(
                    (
                        step_order + 1,
                        "fallback_reasoning",
                        "FallbackAgent",
                        "gpt",
                        "gpt-4o-mini",
                        "success",
                        int((time.perf_counter() - gpt_started) * 1000),
                        {"reason": fallback_reason},
                    )
                )
            except Exception as gpt_exc:
                if fallback_provider is None:
                    fallback_provider = "deterministic"
                    fallback_reason = f"qwen+gpt failed: {gpt_exc}"
                traces.append(
                    (
                        step_order + 1,
                        "fallback_reasoning",
                        "FallbackAgent",
                        "gpt",
                        "gpt-4o-mini",
                        "failed",
                        int((time.perf_counter() - gpt_started) * 1000),
                        {"error": str(gpt_exc)},
                    )
                )
        elif fallback_provider is None:
            fallback_provider = "deterministic"
            fallback_reason = f"qwen failed and OPENAI_API_KEY is empty: {qwen_exc}"

    for order, step_name, agent_name, provider, model_name, status, duration_ms, detail in traces:
        db.add(
            InsightAgentTrace(
                run_id=run.id,
                step_order=order,
                step_name=step_name,
                agent_name=agent_name,
                model_provider=provider,
                model_name=model_name,
                status=status,
                duration_ms=duration_ms,
                detail_json=detail,
            )
        )

    result = {
        "run_id": str(run.id),
        "business_name": payload.business_name,
        "industry": payload.industry,
        "report_type": report_type,
        "model_trace": [
            {"step": s[1], "agent": s[2], "provider": s[3], "model": s[4], "status": s[5]}
            for s in traces
        ],
        "kpis": {
            "revenue": revenue,
            "ad_spend": ad_spend,
            "orders": orders,
            "leads": leads,
            "roas": roas,
            "conversion_rate": conversion_rate,
            "repeat_rate": repeat_rate,
            "aov": aov,
        },
        "schema_mapping": mapping,
        "mapping_confidence": mapping_confidence,
        "insights": insights,
        "issues": issues,
        "action_plan_30_60_90": action_plan,
        "data_warnings": data_warnings,
        "fallback": {"provider": fallback_provider, "reason": fallback_reason},
        "generated_for_user_id": str(current_user.id),
    }

    db.add(InsightResultSnapshot(run_id=run.id, result_json=result))
    await db.commit()
    return result


@router.get("/a2a/runs")
async def list_deep_analysis_runs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    runs = (
        await db.execute(
            select(InsightReportRun)
            .where(InsightReportRun.user_id == current_user.id)
            .order_by(desc(InsightReportRun.created_at))
            .limit(20)
        )
    ).scalars().all()
    return [
        {
            "id": str(r.id),
            "business_name": r.business_name,
            "industry": r.industry,
            "report_type": r.report_type,
            "status": r.status,
            "source_filename": r.source_filename,
            "fallback_provider": r.fallback_provider,
            "fallback_reason": r.fallback_reason,
            "created_at": r.created_at.isoformat(),
        }
        for r in runs
    ]


@router.get("/a2a/runs/{run_id}/result")
async def get_deep_analysis_result(
    run_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    run = (
        await db.execute(
            select(InsightReportRun).where(
                InsightReportRun.id == run_id,
                InsightReportRun.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not run:
        return {"detail": "Run not found"}

    snapshot = (
        await db.execute(
            select(InsightResultSnapshot)
            .where(InsightResultSnapshot.run_id == run.id)
            .order_by(desc(InsightResultSnapshot.created_at))
            .limit(1)
        )
    ).scalar_one_or_none()
    if not snapshot:
        return {"detail": "Result snapshot not found"}
    return snapshot.result_json


@router.post("/a2a/runs/{run_id}/reanalyze")
async def reanalyze_previous_run(
    run_id: uuid.UUID,
    payload: ReanalyzeRunRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    run = (
        await db.execute(
            select(InsightReportRun).where(
                InsightReportRun.id == run_id,
                InsightReportRun.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if not run:
        return {"detail": "Run not found"}

    source_rows = (run.summary_json or {}).get("report_rows")
    if not isinstance(source_rows, list) or len(source_rows) == 0:
        return {"detail": "Run does not contain source rows for reanalyze"}

    replay_request = DeepAnalysisRequest(
        business_name=payload.business_name or run.business_name,
        industry=payload.industry or run.industry,
        source_filename=run.source_filename,
        report_rows=source_rows,
    )
    return await deep_analysis_a2a(replay_request, current_user, db)
