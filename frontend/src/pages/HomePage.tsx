import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import CategoryList from '../components/CategoryList';
import { getArticlesByCategory, ArticleSummary } from '../api';

const HomePage: React.FC = () => {
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // No categories state needed here as it's handled by CategoryList component
  const location = useLocation();
  const navigate = useNavigate();

  const getSelectedCategory = (): string | null => {
    const params = new URLSearchParams(location.search);
    return params.get('category');
  };
  
  const fetchArticles = async (categoryId: string) => {
    setLoading(true);
    try {
      const data = await getArticlesByCategory(categoryId);
      setArticles(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching articles:', err);
      setError('Failed to load articles');
    } finally {
      setLoading(false);
    }
  };

  // Force refresh when the component mounts or when the key changes
  useEffect(() => {
    // This will be triggered when the parent Layout component refreshes
    const selectedCategory = getSelectedCategory();
    if (selectedCategory) {
      fetchArticles(selectedCategory);
    } else {
      setArticles([]);
    }
  }, [location.key, location.search]);

  const handleArticleClick = (categoryId: string, filename: string) => {
    navigate(`/articles/${categoryId}/${filename}`);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="md:col-span-1">
        <CategoryList />
      </div>
      <div className="md:col-span-3">
        <div className="bg-white rounded-lg border p-6">
          <h2 className="text-2xl font-bold mb-6">Articles</h2>
          
          {!getSelectedCategory() && (
            <div className="text-center py-8 text-gray-500">
              <p>Select a category to view articles</p>
            </div>
          )}

          {loading && (
            <div className="text-center py-8 text-gray-500">
              <p>Loading articles...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-red-500">
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && getSelectedCategory() && articles.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No articles found in this category</p>
            </div>
          )}

          <div className="space-y-6">
            {articles.map((article) => (
              <div 
                key={article.id} 
                className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  // Extract filename from the full article ID path
                  const parts = article.id.split('/');
                  const filename = parts[parts.length - 1];
                  handleArticleClick(article.category_id, filename);
                }}
              >
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-blue-500 mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{article.title}</h3>
                    
                    {article.summary ? (
                      <p className="mt-2 text-gray-600">{article.summary}</p>
                    ) : (
                      <p className="mt-2 text-gray-400 italic">No summary available</p>
                    )}
                    
                    <div className="mt-3 text-sm text-gray-500">
                      {article.comment_count > 0 ? (
                        <span>{article.comment_count} comment{article.comment_count !== 1 ? 's' : ''}</span>
                      ) : (
                        <span>No comments</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
