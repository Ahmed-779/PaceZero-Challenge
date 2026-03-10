import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    TAVILY_API_KEY: str = os.getenv("TAVILY_API_KEY", "")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./pacezero.db")
    OPENAI_MODEL: str = "gpt-4o"
    # Cost constants (USD)
    GPT4O_INPUT_COST_PER_1K: float = 0.0025
    GPT4O_OUTPUT_COST_PER_1K: float = 0.01
    TAVILY_COST_PER_SEARCH: float = 0.016  # advanced search = 2 credits × $0.008


settings = Settings()
