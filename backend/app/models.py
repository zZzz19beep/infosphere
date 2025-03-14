from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime

class Category(BaseModel):
    id: str
    name: str
    path: str

class ArticleSummary(BaseModel):
    id: str
    title: str
    category_id: str
    summary: Optional[str] = None
    comment_count: int = 0
    path: str

class Article(ArticleSummary):
    content: str
    
class Comment(BaseModel):
    id: str
    article_id: str
    author: str
    content: str
    created_at: datetime = datetime.now()

class CommentCreate(BaseModel):
    author: str
    content: str

class DirectoryImport(BaseModel):
    """Model for importing articles from a directory"""
    directory_path: str
