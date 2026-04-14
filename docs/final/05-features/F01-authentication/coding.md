# F01 — Authentication & User Profile: Coding Guide

---

## Technical Approach

### JWT Strategy
- **Access Token**: Short-lived (15 min), stateless — chỉ chứa `user_id` + `exp`
- **Refresh Token**: Long-lived (30 days), stateful — lưu vào `user_sessions` table, có thể revoke
- Khi access token expire: client dùng refresh token để lấy access token mới
- Khi refresh token expire: user phải đăng nhập lại

### Password Security
- `bcrypt` với cost factor 12 (balance giữa security và performance)
- Không bao giờ log hoặc return plain text password
- Verify password: `bcrypt.checkpw(plain, hashed)` — constant-time comparison

---

## Backend Implementation

### `api/core/security.py`

```python
from datetime import datetime, timedelta
from jose import jwt, JWTError
from passlib.context import CryptContext
import secrets

SECRET_KEY = settings.SECRET_KEY  # từ .env
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": user_id, "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)

def decode_access_token(token: str) -> str:
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    return payload["sub"]  # user_id

def generate_refresh_token() -> str:
    return secrets.token_urlsafe(32)  # 256-bit random

def generate_secure_token() -> str:
    return secrets.token_urlsafe(24)  # cho email/reset tokens
```

### `api/routers/auth.py` — Key endpoints

```python
@router.post("/register", status_code=201)
async def register(body: UserCreate, db: AsyncSession = Depends(get_db)):
    # 1. Check email unique
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(400, "Email đã được sử dụng")

    # 2. Hash password
    hashed = hash_password(body.password)
    user = User(email=body.email, hashed_pw=hashed, full_name=body.full_name)
    db.add(user)
    await db.flush()  # get user.id

    # 3. Create email verification token
    token = generate_secure_token()
    ev = EmailVerification(user_id=user.id, token=token,
                           expires_at=datetime.utcnow() + timedelta(hours=24))
    db.add(ev)
    await db.commit()

    # 4. Send verification email (async, fire-and-forget)
    # await send_verification_email(user.email, token)
    return {"id": str(user.id), "email": user.email, "message": "Xác minh email để kích hoạt tài khoản"}


@router.post("/login")
async def login(body: UserLogin, request: Request, db: AsyncSession = Depends(get_db)):
    # 1. Find user
    result = await db.execute(select(User).where(User.email == body.email, User.is_active == True))
    user = result.scalar_one_or_none()

    # 2. Verify password (constant-time)
    if not user or not verify_password(body.password, user.hashed_pw):
        raise HTTPException(401, "Email hoặc mật khẩu không đúng")

    # 3. Create tokens
    access_token = create_access_token(str(user.id))
    refresh_token = generate_refresh_token()

    # 4. Save session
    session = UserSession(
        user_id=user.id, refresh_token=refresh_token,
        device_info=request.headers.get("User-Agent", "")[:512],
        ip_address=request.client.host,
        expires_at=datetime.utcnow() + timedelta(days=30)
    )
    db.add(session)
    await db.commit()

    return {"access_token": access_token, "refresh_token": refresh_token,
            "token_type": "bearer", "user": UserOut.model_validate(user)}
```

### `api/core/deps.py` — Auth dependency

```python
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    try:
        user_id = decode_access_token(credentials.credentials)
    except JWTError:
        raise HTTPException(401, "Token không hợp lệ")

    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(401, "Người dùng không tồn tại")
    return user
```

### `api/schemas/user.py`

```python
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=1, max_length=255)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    email: str
    full_name: str | None
    role: str
    email_verified: bool
    business_type: str | None
    city: str | None
    created_at: datetime

class ProfileUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    business_type: str | None = None
    city: str | None = None
    website: str | None = None
    avatar_url: str | None = None
```

---

## Frontend Implementation

### `web/lib/api-client.ts` — Auth interceptor

```typescript
class ApiClient {
  private accessToken: string | null = null;

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers = {
      'Content-Type': 'application/json',
      ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      ...options.headers,
    };

    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    if (res.status === 401 && this.accessToken) {
      // Auto-refresh
      const refreshed = await this.refreshToken();
      if (refreshed) {
        return this.request<T>(path, options);  // retry
      }
      window.location.href = '/login';
    }

    if (!res.ok) throw new ApiError(res.status, await res.json());
    return res.json();
  }

  async refreshToken(): Promise<boolean> {
    const refreshToken = getCookie('refresh_token');
    if (!refreshToken) return false;
    try {
      const data = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
        headers: { 'Content-Type': 'application/json' },
      }).then(r => r.json());
      this.accessToken = data.access_token;
      return true;
    } catch { return false; }
  }
}
```

### `web/app/(auth)/login/page.tsx`

```typescript
'use client';
export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await login(fd.get('email') as string, fd.get('password') as string);
      router.push('/dashboard');
    } catch (err) {
      setError('Email hoặc mật khẩu không đúng');
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Input name="email" type="email" placeholder="Email" required />
      <Input name="password" type="password" placeholder="Mật khẩu" required />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <Button type="submit">Đăng nhập</Button>
      <Link href="/forgot-password">Quên mật khẩu?</Link>
    </form>
  );
}
```

---

## Environment Variables

```env
# api/.env
SECRET_KEY=your-256-bit-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

---

## Database Migration

```python
# alembic/versions/0001_initial_schema.py
# users, user_sessions, password_reset_tokens, email_verifications
# (included in main migration file)
```
