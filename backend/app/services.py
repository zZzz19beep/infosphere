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
        
        # Process function to handle nested directories
        def process_directory(dir_path, parent_id=None):
            result = []
            
            # List all directories in the current directory
            for item in os.listdir(dir_path):
                item_path = dir_path / item
                if item_path.is_dir():
                    # Skip hidden directories
                    if item.startswith('.'):
                        continue
                    
                    # Check if this directory contains markdown files or subdirectories
                    has_content = False
                    
                    # Check for markdown files directly in this directory
                    for file in os.listdir(item_path):
                        if file.endswith('.md') or os.path.isdir(item_path / file):
                            has_content = True
                            break
                    
                    if has_content:
                        # Create category ID based on parent
                        category_id = item if parent_id is None else f"{parent_id}/{item}"
                        
                        # Add this category
                        result.append(
                            Category(
                                id=category_id,
                                name=item,
                                path=str(item_path)
                            )
                        )
                        
                        # Process subdirectories recursively
                        # Note: We're not adding subcategories to the result here
                        # as we want a flat list of all categories
                        result.extend(process_directory(item_path, category_id))
            
            return result
        
        # Start processing from the content directory
        categories = process_directory(self.content_dir)
        
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
        
        # Process this directory and its subdirectories
        def process_directory(dir_path, current_category):
            result = []
            
            # List all items in the directory
            for item in os.listdir(dir_path):
                item_path = dir_path / item
                
                # Process markdown files
                if item.endswith('.md'):
                    file_path = item_path
                    article_id = f"{current_category}/{item}"
                    
                    # Get article title from the first line of the file
                    try:
                        with open(file_path, 'r') as f:
                            content = f.read()
                            title = content.splitlines()[0].lstrip('#').strip() if content else item
                    except Exception:
                        # Fallback to filename if can't read content
                        title = item.replace('.md', '')
                    
                    # Get comment count
                    comment_count = len(comments.get(article_id, []))
                    
                    # Get summary if available
                    summary = summaries.get(article_id, {}).get('summary', None)
                    
                    result.append(
                        ArticleSummary(
                            id=article_id,
                            title=title,
                            category_id=current_category,
                            summary=summary,
                            comment_count=comment_count,
                            path=str(file_path)
                        )
                    )
                
                # Process subdirectories
                elif item_path.is_dir():
                    # Skip hidden directories
                    if item.startswith('.'):
                        continue
                    
                    # Process subdirectory
                    sub_category = f"{current_category}/{item}"
                    result.extend(process_directory(item_path, sub_category))
            
            return result
        
        # Start processing from the category directory
        articles = process_directory(category_path, category_id)
        
        return articles
    
    def get_article(self, article_id: str) -> Optional[Article]:
        """Get a single article by ID"""
        # Split the article_id into category path and filename
        parts = article_id.rsplit('/', 1)
        if len(parts) != 2:
            return None
        
        category_id, filename = parts
        
        # Build the file path by joining the content directory with the category path and filename
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
        title = content.splitlines()[0].lstrip('#').strip() if content else filename
        
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
            stats = {"categories": 0, "articles": 0, "categories_created": []}
            created_categories = set()
            
            # Find all markdown files in the directory structure
            md_files = []
            for root, _, files in os.walk(source_dir):
                for file in files:
                    if file.endswith('.md'):
                        rel_path = os.path.relpath(root, source_dir)
                        md_files.append((os.path.join(root, file), rel_path))
            
            if not md_files:
                print(f"No markdown files found in: {directory_path}")
                return {"success": False, "message": f"在 {directory_path} 中未找到任何 Markdown 文件"}
            
            print(f"Found {len(md_files)} markdown files")
            
            # Process each markdown file
            for file_path, rel_path in md_files:
                try:
                    # Determine category from relative path
                    if rel_path == '.':
                        # Files in the root directory - use parent folder name as category
                        category = os.path.basename(source_dir)
                    else:
                        # Use the relative path as the category
                        category = rel_path
                    
                    # Create category directory if it doesn't exist
                    category_dir = self.content_dir / category
                    if not category_dir.exists():
                        print(f"Creating category directory: {category_dir}")
                        category_dir.mkdir(parents=True, exist_ok=True)
                        
                        # Track top-level category creation
                        top_level_category = category.split('/')[0]
                        if top_level_category not in created_categories:
                            stats["categories"] += 1
                            created_categories.add(top_level_category)
                            stats["categories_created"].append(top_level_category)
                    
                    # Copy the file to the category directory
                    filename = os.path.basename(file_path)
                    target_file = category_dir / filename
                    print(f"Copying file: {file_path} -> {target_file}")
                    shutil.copy2(file_path, target_file)
                    stats["articles"] += 1
                except Exception as e:
                    print(f"Error processing file {file_path}: {str(e)}")
                    # Continue with other files even if one fails
            
            print(f"Import successful: {stats}")
            return {"success": True, "stats": stats}
        except Exception as e:
            error_details = traceback.format_exc()
            print(f"Import error: {error_details}")
            return {"success": False, "message": f"导入目录时发生错误: {str(e)}"}
            
    async def import_from_uploads(self, files: List, categories: Dict[str, str]) -> Dict:
        """Import articles from uploaded files"""
        import os
        import traceback
        
        try:
            print(f"Attempting to import {len(files)} uploaded files")
            print(f"Content directory: {self.content_dir}")
            print(f"Categories mapping: {categories}")
            
            # Ensure content directory exists
            if not self.content_dir.exists():
                try:
                    print(f"Creating content directory: {self.content_dir}")
                    self.content_dir.mkdir(parents=True, exist_ok=True)
                except Exception as e:
                    print(f"Error creating content directory: {str(e)}")
                    return {"success": False, "message": f"无法创建内容目录: {str(e)}"}
            
            # Track import statistics
            stats = {"categories": 0, "articles": 0, "categories_created": []}
            created_categories = set()
            
            # Process each uploaded file
            for file in files:
                try:
                    # Get file path and category from the categories dictionary
                    file_path = file.filename
                    if file_path not in categories:
                        print(f"No category found for file: {file_path}")
                        continue
                        
                    category = categories[file_path]
                    print(f"Processing file: {file_path}, category: {category}")
                    
                    # Handle nested category paths (e.g., "MainCategory/SubCategory")
                    category_parts = category.split('/')
                    current_path = self.content_dir
                    
                    # Create each level of the category hierarchy
                    for i, part in enumerate(category_parts):
                        current_path = current_path / part
                        if not current_path.exists():
                            print(f"Creating category directory: {current_path}")
                            current_path.mkdir(parents=True, exist_ok=True)
                            
                            # Only count top-level categories in the stats
                            if i == 0 and part not in created_categories:
                                stats["categories"] += 1
                                created_categories.add(part)
                                stats["categories_created"].append(part)
                    
                    # Get filename from path
                    filename = os.path.basename(file_path)
                    
                    # Save file content
                    content = await file.read()
                    target_file = current_path / filename
                    
                    print(f"Saving file: {filename} to {target_file}")
                    with open(target_file, "wb") as f:
                        f.write(content)
                    
                    stats["articles"] += 1
                except Exception as e:
                    error_details = traceback.format_exc()
                    print(f"Error processing file {file.filename}: {str(e)}")
                    print(f"Error details: {error_details}")
            
            if stats["articles"] == 0:
                return {"success": False, "message": "未能导入任何文件"}
                
            return {"success": True, "stats": stats}
        except Exception as e:
            error_details = traceback.format_exc()
            print(f"Import error: {error_details}")
            return {"success": False, "message": f"导入文件时发生错误: {str(e)}"}
