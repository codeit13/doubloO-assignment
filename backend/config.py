from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MONGODB_URL: str
    MONGODB_DB: str
    OPENAI_API_KEY: str
    TAVILY_SEARCH_API_KEY: str
    LANGSMITH_TRACING: bool
    LANGSMITH_ENDPOINT: str
    LANGSMITH_API_KEY: str
    LANGSMITH_PROJECT: str

    class Config:
        env_file = ".env"


settings = Settings()