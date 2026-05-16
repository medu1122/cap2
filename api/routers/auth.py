import asyncio
import hashlib
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db
from core.deps import get_current_user
from core.security import create_access_token, hash_password, verify_password
from models.user import User
from schemas.user import RegisterResponse, TokenResponse, UserCreate, UserLogin, UserOut

router = APIRouter()

_PENDING_REGISTRATIONS: dict[str, dict[str, Any]] = {}


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    otp: str = Field(min_length=6, max_length=6)


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1)
    new_password: str = Field(min_length=6)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _new_otp() -> tuple[str, datetime]:
    otp = f"{secrets.randbelow(1_000_000):06d}"
    expires_at = _now() + timedelta(minutes=settings.EMAIL_OTP_EXPIRE_MINUTES)
    return otp, expires_at


def _hash_otp(email: str, otp: str) -> str:
    raw = f"{settings.JWT_SECRET}:{email}:{otp}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _smtp_ready() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD and settings.SMTP_FROM_EMAIL)


def _send_email_sync(to_email: str, subject: str, text_body: str, html_body: str) -> None:
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM_EMAIL
    msg["To"] = to_email
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")
    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
        server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)


async def _send_otp_email(email: str, full_name: str | None, otp: str) -> None:
    if not _smtp_ready():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Chưa cấu hình SMTP nên chưa thể gửi OTP thật.",
        )
    name = full_name or email
    minutes = settings.EMAIL_OTP_EXPIRE_MINUTES
    text_body = (
        f"Xin chào {name},\n\n"
        f"Mã OTP xác thực tài khoản AIMAP của bạn là: {otp}\n"
        f"Mã có hiệu lực trong {minutes} phút.\n\n"
        "Nếu bạn không đăng ký tài khoản AIMAP, hãy bỏ qua email này."
    )
    html_body = f"""
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <h2>Xác thực tài khoản AIMAP</h2>
      <p>Xin chào {name},</p>
      <p>Nhập mã OTP bên dưới để hoàn tất đăng ký tài khoản:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:6px;background:#f3f4f6;padding:14px 18px;border-radius:8px;display:inline-block">{otp}</p>
      <p>Mã có hiệu lực trong {minutes} phút.</p>
      <p>Nếu bạn không đăng ký tài khoản AIMAP, hãy bỏ qua email này.</p>
    </div>
    """
    await asyncio.to_thread(_send_email_sync, email, "Mã OTP xác thực AIMAP", text_body, html_body)


async def _send_otp_or_fail(email: str, full_name: str | None, otp: str) -> None:
    try:
        await _send_otp_email(email, full_name, otp)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Không gửi được email OTP. Kiểm tra SMTP/App Password. Chi tiết: {exc}",
        ) from exc


def _store_pending_registration(payload: UserCreate, email: str, otp: str, expires_at: datetime) -> None:
    _PENDING_REGISTRATIONS[email] = {
        "email": email,
        "hashed_pw": hash_password(payload.password),
        "full_name": payload.full_name,
        "otp_hash": _hash_otp(email, otp),
        "expires_at": expires_at,
    }


def _get_valid_pending(email: str) -> dict[str, Any]:
    pending = _PENDING_REGISTRATIONS.get(email)
    if not pending:
        raise HTTPException(status_code=404, detail="Không tìm thấy yêu cầu đăng ký. Vui lòng đăng ký lại.")
    if pending["expires_at"] < _now():
        _PENDING_REGISTRATIONS.pop(email, None)
        raise HTTPException(status_code=400, detail="Mã OTP đã hết hạn. Vui lòng đăng ký lại hoặc gửi lại OTP.")
    return pending


@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    email = _normalize_email(payload.email)
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email đã tồn tại")

    otp, expires_at = _new_otp()
    _store_pending_registration(payload, email, otp, expires_at)
    try:
        await _send_otp_or_fail(email, payload.full_name, otp)
    except HTTPException:
        _PENDING_REGISTRATIONS.pop(email, None)
        raise

    return RegisterResponse(
        email=email,
        message="Đã gửi mã OTP đến email. Nhập mã OTP để hoàn tất đăng ký.",
        email_sent=True,
        expires_in_minutes=settings.EMAIL_OTP_EXPIRE_MINUTES,
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: UserLogin, db: AsyncSession = Depends(get_db)):
    email = _normalize_email(payload.email)
    if not email or not payload.password:
        raise HTTPException(status_code=400, detail="Email và mật khẩu là bắt buộc")
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.hashed_pw):
        raise HTTPException(status_code=401, detail="Sai email hoặc mật khẩu")
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, token_type="bearer", user=UserOut.model_validate(user))


@router.post("/verify-email")
async def verify_email(payload: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    email = _normalize_email(payload.email)
    otp = payload.otp.strip()
    pending = _get_valid_pending(email)
    if not secrets.compare_digest(pending["otp_hash"], _hash_otp(email, otp)):
        raise HTTPException(status_code=400, detail="Mã OTP không đúng.")

    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        _PENDING_REGISTRATIONS.pop(email, None)
        raise HTTPException(status_code=400, detail="Email đã tồn tại")

    user = User(
        email=email,
        hashed_pw=pending["hashed_pw"],
        full_name=pending["full_name"],
    )
    db.add(user)
    await db.commit()
    _PENDING_REGISTRATIONS.pop(email, None)
    return {"message": "Xác thực OTP thành công. Bạn có thể đăng nhập."}


@router.post("/resend-verification")
async def resend_verification(payload: ResendVerificationRequest, db: AsyncSession = Depends(get_db)):
    email = _normalize_email(payload.email)
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        return {"message": "Email này đã có tài khoản. Vui lòng đăng nhập.", "email_sent": False}

    pending = _get_valid_pending(email)
    otp, expires_at = _new_otp()
    pending["otp_hash"] = _hash_otp(email, otp)
    pending["expires_at"] = expires_at
    await _send_otp_or_fail(email, pending["full_name"], otp)
    return {
        "message": "Đã gửi lại mã OTP đến email.",
        "email_sent": True,
        "expires_in_minutes": settings.EMAIL_OTP_EXPIRE_MINUTES,
    }


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.hashed_pw):
        raise HTTPException(status_code=400, detail="Mật khẩu hiện tại không đúng.")
    if verify_password(payload.new_password, current_user.hashed_pw):
        raise HTTPException(status_code=400, detail="Mật khẩu mới phải khác mật khẩu hiện tại.")
    current_user.hashed_pw = hash_password(payload.new_password)
    await db.commit()
    return {"message": "Đổi mật khẩu thành công."}


class UserPrefsUpdate(BaseModel):
    email_reminder_enabled: bool | None = None


@router.patch("/me", response_model=UserOut)
async def update_me(
    payload: UserPrefsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.email_reminder_enabled is not None:
        current_user.email_reminder_enabled = payload.email_reminder_enabled
        await db.commit()
        await db.refresh(current_user)
    return current_user
