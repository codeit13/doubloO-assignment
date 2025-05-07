from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    MONGODB_URL: str
    MONGODB_DB: str
    OPENAI_API_KEY: str
    GROQ_API_KEY: str
    BRAVE_SEARCH_API_KEY: str
    TAVILY_SEARCH_API_KEY: str
    TWITTER_USERNAME: str
    TWITTER_EMAIL: str
    TWITTER_PASSWORD: str
    TWITTER_USER_AGENT: str
    SCRAPER_API_KEY: str

    class Config:
        env_file = ".env"


settings = Settings()