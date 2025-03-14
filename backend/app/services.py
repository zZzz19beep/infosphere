import os
import json
import uuid
from pathlib import Path
from typing import List, Dict, Optional
import markdown
import frontmatter
from datetime import datetime

from app.models import Category, Article, ArticleSummary, Comment
from app.config import settings

class ContentService:
    def __init__(self, content_dir: str = settings.CONTENT_DIR):
        self.content_dir = Path(content_dir)
        self.comments_file = Path(settings.COMMENTS_FILE)
        self.summaries_file = Path(settings.SUMMARIES_FILE)
        
        # Create data files if they don't exist
        self._ensure_data_files()
    
    def _ensure_data_files(self):
        """Ensure data files exist"""
        if not self.comments_file.parent.exists():
            self.comments_file.parent.mkdir(parents=True)
        
        if not self.comments_file.exists():
            with open(self.comments_file, 'w') as f:
                json.dump({}, f)
        
        if not self.summaries_file.exists():
            with open(self.summaries_file, 'w') as f:
                json.dump({}, f)
    
    def get_categories(self) -> List[Category]:
        """Get all categories from the content directory"""
        categories = []
        
        # List all directories in the content directory
        for item in os.listdir(self.content_dir):
            item_path = self.content_dir / item
            if item_path.is_dir():
                category_id = item
                categories.append(
                    Category(
                        id=category_id,
                        name=item,
                        path=str(item_path)
                    )
                )
        
        return categories
    
    def get_articles_by_category(self, category_id: str) -> List[ArticleSummary]:
        """Get all articles in a category"""
        articles = []
        category_path = self.content_dir / category_id
        
        if not category_path.exists() or not category_path.is_dir():
            return []
        
        # Load comments and summaries
        comments = self._load_comments()
        summaries = self._load_summaries()
        
        # List all markdown files in the category directory
        for item in os.listdir(category_path):
            if item.endswith('.md'):
                file_path = category_path / item
                article_id = f"{category_id}/{item}"
                
                # Get article title from the first line of the file
                with open(file_path, 'r') as f:
                    content = f.read()
                    title = content.splitlines()[0].lstrip('#').strip()
                
                # Get comment count
                comment_count = len(comments.get(article_id, []))
                
                # Get summary if available
                summary = summaries.get(article_id, {}).get('summary', None)
                
                articles.append(
                    ArticleSummary(
                        id=article_id,
                        title=title,
                        category_id=category_id,
                        summary=summary,
                        comment_count=comment_count,
                        path=str(file_path)
                    )
                )
        
        return articles
    
    def get_article(self, article_id: str) -> Optional[Article]:
        """Get a single article by ID"""
        parts = article_id.split('/', 1)
        if len(parts) != 2:
            return None
        
        category_id, filename = parts
        file_path = self.content_dir / category_id / filename
        
        if not file_path.exists() or not file_path.is_file():
            return None
        
        # Load comments and summaries
        comments = self._load_comments()
        summaries = self._load_summaries()
        
        # Read the file content
        with open(file_path, 'r') as f:
            content = f.read()
            
        # Extract title from the first line
        title = content.splitlines()[0].lstrip('#').strip()
        
        # Get comment count
        comment_count = len(comments.get(article_id, []))
        
        # Get summary if available
        summary = summaries.get(article_id, {}).get('summary', None)
        
        return Article(
            id=article_id,
            title=title,
            category_id=category_id,
            content=content,
            summary=summary,
            comment_count=comment_count,
            path=str(file_path)
        )
    
    def get_comments(self, article_id: str) -> List[Comment]:
        """Get all comments for an article"""
        comments_data = self._load_comments()
        article_comments = comments_data.get(article_id, [])
        
        return [Comment(**comment) for comment in article_comments]
    
    def add_comment(self, article_id: str, author: str, content: str) -> Comment:
        """Add a comment to an article"""
        comments_data = self._load_comments()
        
        # Create new comment
        comment = Comment(
            id=str(uuid.uuid4()),
            article_id=article_id,
            author=author,
            content=content,
            created_at=datetime.now()
        )
        
        # Add to comments data
        if article_id not in comments_data:
            comments_data[article_id] = []
        
        comments_data[article_id].append(comment.dict())
        
        # Save comments data
        self._save_comments(comments_data)
        
        return comment
    
    def save_summary(self, article_id: str, summary: str) -> None:
        """Save a summary for an article"""
        summaries = self._load_summaries()
        
        # Update or create summary
        summaries[article_id] = {
            'summary': summary,
            'updated_at': datetime.now().isoformat()
        }
        
        # Save summaries
        self._save_summaries(summaries)
    
    def _load_comments(self) -> Dict:
        """Load comments from file"""
        if not self.comments_file.exists():
            return {}
        
        with open(self.comments_file, 'r') as f:
            return json.load(f)
    
    def _save_comments(self, comments_data: Dict) -> None:
        """Save comments to file"""
        with open(self.comments_file, 'w') as f:
            json.dump(comments_data, f, default=self._json_serializer)
    
    def _load_summaries(self) -> Dict:
        """Load summaries from file"""
        if not self.summaries_file.exists():
            return {}
        
        with open(self.summaries_file, 'r') as f:
            return json.load(f)
    
    def _save_summaries(self, summaries_data: Dict) -> None:
        """Save summaries to file"""
        with open(self.summaries_file, 'w') as f:
            json.dump(summaries_data, f, default=self._json_serializer)
    
    def _json_serializer(self, obj):
        """JSON serializer for objects not serializable by default json code"""
        if isinstance(obj, datetime):
            return obj.isoformat()
        raise TypeError(f"Type {type(obj)} not serializable")
        
    def import_from_directory(self, directory_path: str) -> Dict:
        """Import articles from a directory"""
        import shutil
        import os
        from pathlib import Path
        
        source_dir = Path(directory_path)
        if not source_dir.exists() or not source_dir.is_dir():
            return {"success": False, "message": "Directory not found"}
        
        # Track import statistics
        stats = {"categories": 0, "articles": 0}
        
        # Process each subdirectory as a category
        for item in os.listdir(source_dir):
            item_path = source_dir / item
            if item_path.is_dir():
                # Create category directory if it doesn't exist
                category_dir = self.content_dir / item
                if not category_dir.exists():
                    category_dir.mkdir(parents=True, exist_ok=True)
                    stats["categories"] += 1
                
                # Copy markdown files to category directory
                for file in os.listdir(item_path):
                    if file.endswith('.md'):
                        source_file = item_path / file
                        target_file = category_dir / file
                        shutil.copy2(source_file, target_file)
                        stats["articles"] += 1
        
        return {"success": True, "stats": stats}
