from pydantic_settings import BaseSettings
from pathlib import Path
import os

class Settings(BaseSettings):
    # Path to the content directory containing markdown files
    CONTENT_DIR: str = os.environ.get("CONTENT_DIR", "/app/sample-content")
    
    # AI API settings
    OPENAI_API_KEY: str = os.environ.get("OPENAI_API_KEY", "")
    
    # DeepSeek API settings
    DEEPSEEK_API_URL: str = os.environ.get("DEEPSEEK_API_URL", "https://api.deepseek.com/chat/completions")
    DEEPSEEK_API_TOKEN: str = os.environ.get("DEEPSEEK_API_TOKEN", "sk-2e42fb2d6a4a4f118859307cce9d1ec0")
    DEEPSEEK_API_MODEL: str = os.environ.get("DEEPSEEK_API_MODEL", "deepseek-chat")
    
    # Legacy Sankuai API settings (kept for backward compatibility)
    SANKUAI_API_URL: str = os.environ.get("SANKUAI_API_URL", "https://aigc.sankuai.com/v1/openai/native/chat/completions")
    SANKUAI_API_TOKEN: str = os.environ.get("SANKUAI_API_TOKEN", "申21899286156743991368")
    SANKUAI_API_MODEL: str = os.environ.get("SANKUAI_API_MODEL", "deepseek-v3-friday")
    
    # Path to store comments data
    COMMENTS_FILE: str = os.environ.get("COMMENTS_FILE", "/app/data/comments.json")
    
    # Path to store article summaries
    SUMMARIES_FILE: str = os.environ.get("SUMMARIES_FILE", "/app/data/summaries.json")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        env_prefix = ""

settings = Settings()
