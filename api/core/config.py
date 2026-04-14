from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440

    AGENT_SERVICE_URL: str = "http://agent:8001"
    INTERNAL_API_URL: str = "http://api:8000"

    OPENAI_API_KEY: str = ""
    QWEN_BASE_URL: str = "http://171.238.156.10:11434/v1"
    QWEN_MODEL: str = "qwen2.5:7b"
    QWEN_TIMEOUT: int = 15

    class Config:
        env_file = ".env"


settings = Settings()
