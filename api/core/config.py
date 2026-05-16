from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440

    AGENT_SERVICE_URL: str = "http://agent:8001"
    INTERNAL_API_URL: str = "http://api:8000"

    OPENAI_API_KEY: str = ""
    DEEPSEEK_BASE_URL: str = "http://171.238.156.10:11434/v1"
    DEEPSEEK_MODEL: str = "qwen2.5:14b"
    QWEN_BASE_URL: str = "http://171.238.156.10:11434/v1"
    QWEN_MODEL: str = "qwen2.5:14b"
    # Giay: timeout doc mot lan completion Qwen/Ollama (VPS cham nen mac dinh cao hon).
    QWEN_TIMEOUT: int = 180
    CUSTOMER_TABLE_ALLOWED_EXTENSIONS: str = ".csv,.xlsx"
    CUSTOMER_TABLE_MAX_ROWS: int = 5000

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    EMAIL_OTP_EXPIRE_MINUTES: int = 10
    # URL gốc của API (trình đọc mail phải truy cập được) — pixel mở / link click.
    TRACKING_PUBLIC_BASE_URL: str = "http://localhost:8000"
    # Redirect sau khi ghi nhận click.
    TRACKING_DEFAULT_REDIRECT_URL: str = "http://localhost:3000"
    CALENDAR_REMINDER_ENABLED: bool = False
    CALENDAR_REMINDER_HOUR: int = 8
    WORKFLOW_SCHEDULER_ENABLED: bool = True
    WORKFLOW_SCHEDULER_INTERVAL_MINUTES: int = 5
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""
    CLOUDINARY_FOLDER: str = "aimap/campaigns"
    STATIC_DIR: str = ""
    STATIC_BASE_URL: str = "http://localhost:8000/static/uploads"
    CORS_ORIGINS: str = "http://localhost:3000"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
