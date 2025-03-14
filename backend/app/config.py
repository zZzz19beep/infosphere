from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    # Path to the content directory containing markdown files
    CONTENT_DIR: str = "/home/ubuntu/markdown-cms/sample-content"
    
    # AI API settings
    OPENAI_API_KEY: str = ""
    SANKUAI_API_URL: str = "https://aigc.sankuai.com/v1/openai/native/chat/completions"
    SANKUAI_API_TOKEN: str = "申21899286156743991368"
    SANKUAI_API_MODEL: str = "deepseek-v3-friday"
    
    # Path to store comments data
    COMMENTS_FILE: str = "/home/ubuntu/markdown-cms/backend/data/comments.json"
    
    # Path to store article summaries
    SUMMARIES_FILE: str = "/home/ubuntu/markdown-cms/backend/data/summaries.json"

settings = Settings()
