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
        
        # Create content directory if it doesn't exist
        if not self.content_dir.exists():
            self.content_dir.mkdir(parents=True, exist_ok=True)
        
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
        import traceback
        
        try:
            print(f"Attempting to import from directory: {directory_path}")
            print(f"Content directory: {self.content_dir}")
            
            source_dir = Path(directory_path)
            if not source_dir.exists() or not source_dir.is_dir():
                print(f"Directory not found: {directory_path}")
                return {"success": False, "message": f"目录未找到: {directory_path}"}
            
            # Ensure content directory exists
            if not self.content_dir.exists():
                try:
                    print(f"Creating content directory: {self.content_dir}")
                    self.content_dir.mkdir(parents=True, exist_ok=True)
                except Exception as e:
                    print(f"Error creating content directory: {str(e)}")
                    return {"success": False, "message": f"无法创建内容目录: {str(e)}"}
            
            # Track import statistics
            stats = {"categories": 0, "articles": 0}
            
            # Process directory structure recursively
            def process_directory(src_dir, relative_path=None):
                nonlocal stats
                
                # If this is a nested call, build the relative path
                current_rel_path = relative_path or ""
                
                print(f"Processing directory: {src_dir}, relative path: {current_rel_path}")
                
                # Process each item in the directory
                for item in os.listdir(src_dir):
                    item_path = src_dir / item
                    
                    # Handle directories (categories)
                    if item_path.is_dir():
                        # For top-level directories, use the directory name as category
                        if not relative_path:
                            category_name = item
                            category_dir = self.content_dir / category_name
                            if not category_dir.exists():
                                print(f"Creating category directory: {category_dir}")
                                category_dir.mkdir(parents=True, exist_ok=True)
                                stats["categories"] += 1
                            
                            # Process this category directory recursively
                            process_directory(item_path, category_name)
                        else:
                            # For nested directories, create nested structure under the category
                            nested_dir_path = self.content_dir / current_rel_path / item
                            if not nested_dir_path.exists():
                                print(f"Creating nested directory: {nested_dir_path}")
                                nested_dir_path.mkdir(parents=True, exist_ok=True)
                            
                            # Process this nested directory recursively
                            new_rel_path = f"{current_rel_path}/{item}" if current_rel_path else item
                            process_directory(item_path, new_rel_path)
                    
                    # Handle markdown files
                    elif item.endswith('.md'):
                        # Copy markdown file to the appropriate category directory
                        target_dir = self.content_dir
                        if current_rel_path:
                            target_dir = self.content_dir / current_rel_path
                            
                        if not target_dir.exists():
                            print(f"Creating target directory: {target_dir}")
                            target_dir.mkdir(parents=True, exist_ok=True)
                        
                        source_file = item_path
                        target_file = target_dir / item
                        print(f"Copying file: {source_file} -> {target_file}")
                        shutil.copy2(source_file, target_file)
                        stats["articles"] += 1
            
            # Start recursive processing from the source directory
            process_directory(source_dir)
            
            if stats["articles"] == 0:
                print(f"No markdown files found in: {directory_path}")
                return {"success": False, "message": f"在 {directory_path} 中未找到任何 Markdown 文件"}
                
            print(f"Import successful: {stats}")
            return {"success": True, "stats": stats}
        except Exception as e:
            error_details = traceback.format_exc()
            print(f"Import error: {error_details}")
            return {"success": False, "message": f"导入目录时发生错误: {str(e)}"}
