import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, MessageSquare } from 'lucide-react';
import { getArticle, getComments, addComment, summarizeArticle, Article, Comment } from '../api';

const ArticlePage: React.FC = () => {
  const { categoryId, filename } = useParams<{ categoryId: string; filename: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentAuthor, setCommentAuthor] = useState('');
  const [commentContent, setCommentContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    if (!categoryId || !filename) return;

    const fetchArticleData = async () => {
      try {
        setLoading(true);
        const articleData = await getArticle(categoryId, filename);
        setArticle(articleData);
        
        const commentsData = await getComments(categoryId, filename);
        setComments(commentsData);
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching article data:', err);
        setError('Failed to load article');
        setLoading(false);
      }
    };

    fetchArticleData();
  }, [categoryId, filename]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!categoryId || !filename || !commentAuthor.trim() || !commentContent.trim()) return;
    
    try {
      setSubmitting(true);
      const newComment = await addComment(categoryId, filename, commentAuthor, commentContent);
      setComments([...comments, newComment]);
      setCommentAuthor('');
      setCommentContent('');
      setSubmitting(false);
    } catch (err) {
      console.error('Error adding comment:', err);
      setSubmitting(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!categoryId || !filename || !article) return;
    
    try {
      setSummarizing(true);
      const result = await summarizeArticle(categoryId, filename);
      setArticle({ ...article, summary: result.summary });
      setSummarizing(false);
    } catch (err) {
      console.error('Error generating summary:', err);
      setSummarizing(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading article...</p>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500">{error || 'Article not found'}</p>
        <Link to="/" className="mt-4 inline-block text-blue-500 hover:underline">
          Back to articles
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link 
        to={`/?category=${categoryId ? (categoryId.includes('/') ? categoryId.split('/')[0] : categoryId) : ''}`} 
        className="inline-flex items-center text-blue-500 hover:underline mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to articles
      </Link>
      
      <article className="bg-white rounded-lg border p-6 mb-8">
        <h1 className="text-3xl font-bold mb-6">{article.title}</h1>
        
        {article.summary ? (
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-blue-800 mb-2">Summary</h2>
            <p className="text-blue-700">{article.summary}</p>
          </div>
        ) : (
          <div className="mb-6">
            <button
              onClick={handleGenerateSummary}
              disabled={summarizing}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {summarizing ? 'Generating Summary...' : 'Generate Summary'}
            </button>
          </div>
        )}
        
        <div className="prose max-w-none">
          <ReactMarkdown>{article.content}</ReactMarkdown>
        </div>
      </article>
      
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center gap-2 mb-6">
          <MessageSquare className="h-5 w-5 text-gray-500" />
          <h2 className="text-xl font-semibold">Comments ({comments.length})</h2>
        </div>
        
        {comments.length > 0 ? (
          <div className="space-y-6 mb-8">
            {comments.map((comment) => (
              <div key={comment.id} className="border-b pb-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-medium">{comment.author}</h3>
                  <span className="text-sm text-gray-500">
                    {new Date(comment.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-gray-700">{comment.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 mb-8">No comments yet</p>
        )}
        
        <form onSubmit={handleSubmitComment} className="space-y-4">
          <h3 className="text-lg font-medium">Add a Comment</h3>
          
          <div>
            <label htmlFor="author" className="block text-sm font-medium text-gray-700 mb-1">
              Name
            </label>
            <input
              type="text"
              id="author"
              value={commentAuthor}
              onChange={(e) => setCommentAuthor(e.target.value)}
              className="w-full px-3 py-2 border rounded-md"
              required
            />
          </div>
          
          <div>
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
              Comment
            </label>
            <textarea
              id="content"
              value={commentContent}
              onChange={(e) => setCommentContent(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border rounded-md"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {submitting ? 'Submitting...' : 'Submit Comment'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ArticlePage;
