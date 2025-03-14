from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import List

from app.services import ContentService
from app.models import Category, ArticleSummary, Article, Comment, CommentCreate, DirectoryImport

app = FastAPI(title="Markdown CMS API")

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Dependency to get content service
def get_content_service():
    return ContentService()

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

@app.get("/api/categories", response_model=List[Category])
async def get_categories(content_service: ContentService = Depends(get_content_service)):
    """Get all categories"""
    return content_service.get_categories()

@app.get("/api/categories/{category_id}/articles", response_model=List[ArticleSummary])
async def get_articles_by_category(
    category_id: str, 
    content_service: ContentService = Depends(get_content_service)
):
    """Get all articles in a category"""
    return content_service.get_articles_by_category(category_id)

@app.get("/api/articles/{category_id}/{filename}", response_model=Article)
async def get_article(
    category_id: str,
    filename: str,
    content_service: ContentService = Depends(get_content_service)
):
    """Get a single article by category and filename"""
    article_id = f"{category_id}/{filename}"
    article = content_service.get_article(article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return article

@app.get("/api/articles/{category_id}/{filename}/comments", response_model=List[Comment])
async def get_comments(
    category_id: str,
    filename: str,
    content_service: ContentService = Depends(get_content_service)
):
    """Get all comments for an article"""
    article_id = f"{category_id}/{filename}"
    return content_service.get_comments(article_id)

@app.post("/api/articles/{category_id}/{filename}/comments", response_model=Comment)
async def add_comment(
    category_id: str,
    filename: str,
    comment: CommentCreate,
    content_service: ContentService = Depends(get_content_service)
):
    """Add a comment to an article"""
    article_id = f"{category_id}/{filename}"
    # Verify article exists
    article = content_service.get_article(article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    return content_service.add_comment(
        article_id=article_id,
        author=comment.author,
        content=comment.content
    )

@app.post("/api/articles/{category_id}/{filename}/summarize")
async def summarize_article(
    category_id: str,
    filename: str,
    content_service: ContentService = Depends(get_content_service)
):
    """Generate a summary for an article using AI"""
    from app.ai_service import AIService
    
    article_id = f"{category_id}/{filename}"
    article = content_service.get_article(article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    
    # Generate summary
    ai_service = AIService()
    summary = ai_service.summarize_article(article.content)
    
    # Save summary
    content_service.save_summary(article_id, summary)
    
    return {"summary": summary}

@app.post("/api/import-directory", status_code=201)
async def import_directory(
    directory_import: DirectoryImport,
    content_service: ContentService = Depends(get_content_service)
):
    """Import articles from a directory"""
    try:
        result = content_service.import_from_directory(directory_import.directory_path)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/debug/config", include_in_schema=False)
async def debug_config():
    """Debug endpoint to check configuration"""
    import os
    from app.config import settings
    
    return {
        "env_vars": {
            "CONTENT_DIR": os.environ.get("CONTENT_DIR", "Not set"),
            "COMMENTS_FILE": os.environ.get("COMMENTS_FILE", "Not set"),
            "SUMMARIES_FILE": os.environ.get("SUMMARIES_FILE", "Not set"),
        },
        "settings": {
            "CONTENT_DIR": settings.CONTENT_DIR,
            "COMMENTS_FILE": settings.COMMENTS_FILE,
            "SUMMARIES_FILE": settings.SUMMARIES_FILE,
        }
    }
