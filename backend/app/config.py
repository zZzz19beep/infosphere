from pydantic_settings import BaseSettings
from pathlib import Path
import os

class Settings(BaseSettings):
    # Path to the content directory containing markdown files
    CONTENT_DIR: str = os.environ.get("CONTENT_DIR", "/home/ubuntu/markdown-cms/sample-content")
    
    # AI API settings
    OPENAI_API_KEY: str = os.environ.get("OPENAI_API_KEY", "")
    SANKUAI_API_URL: str = os.environ.get("SANKUAI_API_URL", "https://aigc.sankuai.com/v1/openai/native/chat/completions")
    SANKUAI_API_TOKEN: str = os.environ.get("SANKUAI_API_TOKEN", "申21899286156743991368")
    SANKUAI_API_MODEL: str = os.environ.get("SANKUAI_API_MODEL", "deepseek-v3-friday")
    
    # Path to store comments data
    COMMENTS_FILE: str = os.environ.get("COMMENTS_FILE", "/home/ubuntu/markdown-cms/backend/data/comments.json")
    
    # Path to store article summaries
    SUMMARIES_FILE: str = os.environ.get("SUMMARIES_FILE", "/home/ubuntu/markdown-cms/backend/data/summaries.json")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

settings = Settings()
