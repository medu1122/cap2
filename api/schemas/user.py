import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str | None = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str | None
    role: str
    email_reminder_enabled: bool = True
    created_at: datetime

    model_config = {"from_attributes": True}


class UserPrefsUpdate(BaseModel):
    email_reminder_enabled: bool | None = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserOut
