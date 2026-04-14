# F01 — Authentication & User Profile: Test Plan

---

## Test Strategy

| Layer | Tool | Coverage |
|---|---|---|
| Unit Tests | pytest + pytest-asyncio | Password hashing, JWT creation/decode, token generation |
| Integration Tests | httpx + pytest | API endpoints với real DB (test database) |
| Acceptance Tests | Manual (Gherkin format) | Full user flows qua browser |

---

## Unit Tests

### `api/tests/test_security.py`

```python
import pytest
from api.core.security import (
    hash_password, verify_password, create_access_token,
    decode_access_token, generate_refresh_token
)

def test_password_hash_and_verify():
    plain = "MySecurePassword123"
    hashed = hash_password(plain)
    assert hashed != plain
    assert verify_password(plain, hashed)

def test_password_wrong_password_returns_false():
    hashed = hash_password("correct_password")
    assert not verify_password("wrong_password", hashed)

def test_create_and_decode_access_token():
    user_id = "11111111-1111-1111-1111-111111111111"
    token = create_access_token(user_id)
    decoded_id = decode_access_token(token)
    assert decoded_id == user_id

def test_expired_token_raises():
    from jose import jwt
    from datetime import datetime, timedelta
    expired_payload = {"sub": "user_id", "exp": datetime.utcnow() - timedelta(minutes=1)}
    token = jwt.encode(expired_payload, settings.SECRET_KEY)
    with pytest.raises(Exception):
        decode_access_token(token)

def test_refresh_token_is_random_and_long():
    t1 = generate_refresh_token()
    t2 = generate_refresh_token()
    assert t1 != t2
    assert len(t1) >= 32
```

---

## Integration Tests

### `api/tests/test_auth_endpoints.py`

```python
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_register_success(client: AsyncClient):
    response = await client.post("/auth/register", json={
        "email": "newuser@test.com",
        "password": "SecurePass123",
        "full_name": "Test User"
    })
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@test.com"
    assert "id" in data

@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient, existing_user):
    response = await client.post("/auth/register", json={
        "email": existing_user["email"],
        "password": "AnotherPass123",
        "full_name": "Another User"
    })
    assert response.status_code == 400
    assert "Email" in response.json()["detail"]

@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, verified_user):
    response = await client.post("/auth/login", json={
        "email": verified_user["email"],
        "password": "TestPassword123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"

@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, verified_user):
    response = await client.post("/auth/login", json={
        "email": verified_user["email"],
        "password": "WrongPassword"
    })
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_refresh_token(client: AsyncClient, auth_tokens):
    response = await client.post("/auth/refresh", json={
        "refresh_token": auth_tokens["refresh_token"]
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["access_token"] != auth_tokens["access_token"]  # new token

@pytest.mark.asyncio
async def test_get_me_authenticated(client: AsyncClient, auth_headers):
    response = await client.get("/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert "email" in data
    assert "id" in data

@pytest.mark.asyncio
async def test_get_me_unauthenticated(client: AsyncClient):
    response = await client.get("/auth/me")
    assert response.status_code == 401

@pytest.mark.asyncio
async def test_update_profile(client: AsyncClient, auth_headers):
    response = await client.put("/auth/me", json={
        "full_name": "Updated Name",
        "city": "Hà Nội",
        "business_type": "cafe"
    }, headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["full_name"] == "Updated Name"
    assert data["city"] == "Hà Nội"

@pytest.mark.asyncio
async def test_forgot_password_always_returns_200(client: AsyncClient):
    # Security: không tiết lộ email có tồn tại không
    response = await client.post("/auth/forgot-password", json={
        "email": "nonexistent@example.com"
    })
    assert response.status_code == 200  # luôn trả 200

@pytest.mark.asyncio
async def test_reset_password_with_valid_token(client: AsyncClient, reset_token, user_id):
    response = await client.post("/auth/reset-password", json={
        "token": reset_token,
        "new_password": "NewSecurePass456"
    })
    assert response.status_code == 200
    # Verify: login với mật khẩu mới thành công
    login_response = await client.post("/auth/login", json={
        "email": "user@test.com",
        "password": "NewSecurePass456"
    })
    assert login_response.status_code == 200

@pytest.mark.asyncio
async def test_reset_password_used_token_fails(client: AsyncClient, used_reset_token):
    response = await client.post("/auth/reset-password", json={
        "token": used_reset_token,
        "new_password": "NewPass789"
    })
    assert response.status_code == 400
```

---

## Acceptance Tests (Gherkin Format)

### AT-01: Đăng ký tài khoản mới

```gherkin
Feature: User Registration

Scenario: Đăng ký thành công với email mới
  Given tôi đang ở trang /register
  When tôi điền email "newowner@cafebohho.vn"
    And tôi điền full_name "Nguyễn Văn A"
    And tôi điền password "SecurePass123"
    And tôi điền confirm_password "SecurePass123"
    And tôi click "Đăng ký"
  Then tôi thấy thông báo "Kiểm tra email của bạn để xác minh tài khoản"
    And database có 1 record trong users với email đó
    And database có 1 record trong email_verifications

Scenario: Đăng ký thất bại với email đã tồn tại
  Given email "existing@test.com" đã được đăng ký
  When tôi đăng ký với email "existing@test.com"
  Then tôi thấy lỗi "Email đã được sử dụng"
    And không có user mới được tạo
```

### AT-02: Đăng nhập và Refresh Token

```gherkin
Feature: User Login & Session Management

Scenario: Đăng nhập thành công
  Given tôi có tài khoản đã xác minh email với email "owner@test.com" và password "Pass123"
  When tôi vào /login và điền đúng credentials
  Then tôi được redirect tới /dashboard
    And tôi thấy tên mình ở header

Scenario: Refresh token tự động
  Given tôi đang đăng nhập, access token sắp hết hạn
  When tôi thực hiện bất kỳ API call nào
  Then access token được tự động làm mới
    And API call thành công không bị interrupt
    And tôi KHÔNG bị redirect tới /login
```

### AT-03: Quên mật khẩu

```gherkin
Feature: Password Reset

Scenario: Reset mật khẩu thành công
  Given tôi quên mật khẩu và có email "owner@test.com"
  When tôi vào /forgot-password và nhập email đó
    And tôi click "Gửi link đặt lại mật khẩu"
  Then tôi thấy thông báo "Kiểm tra email của bạn"
    And database có reset token chưa used và chưa hết hạn

  When tôi click link trong email (hoặc nhập token trực tiếp)
    And tôi nhập mật khẩu mới "NewPass456"
  Then mật khẩu được cập nhật
    And tôi có thể đăng nhập với "NewPass456"
    And reset token được đánh dấu used=TRUE
```

---

## Test Data

```python
# conftest.py fixtures
@pytest.fixture
async def verified_user(db):
    user = User(email="test@example.com",
                hashed_pw=hash_password("TestPassword123"),
                email_verified=True, is_active=True)
    db.add(user)
    await db.commit()
    return {"id": str(user.id), "email": user.email, "password": "TestPassword123"}

@pytest.fixture
async def auth_headers(client, verified_user):
    response = await client.post("/auth/login", json={
        "email": verified_user["email"],
        "password": verified_user["password"]
    })
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
```

---

## Edge Cases

| Case | Expected Behavior |
|---|---|
| Password < 8 ký tự | 422 Validation Error |
| Email không đúng format | 422 Validation Error |
| Refresh token đã expired | 401, phải login lại |
| Refresh token bị xóa (logout) | 401, phải login lại |
| Reset token đã dùng | 400 Bad Request |
| Reset token hết hạn (> 1h) | 400 Bad Request |
| Đăng nhập khi is_active=FALSE | 401 Unauthorized |
