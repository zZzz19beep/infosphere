import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Folder } from 'lucide-react';
import { getCategories, Category } from '../api';

const CategoryList: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const data = await getCategories();
        setCategories(data);
        setLoading(false);
      } catch (err) {
        setError('Failed to load categories');
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const handleCategoryClick = (categoryId: string) => {
    navigate(`/?category=${categoryId}`);
  };

  const getActiveCategory = (): string | null => {
    const params = new URLSearchParams(location.search);
    return params.get('category');
  };

  const activeCategory = getActiveCategory();

  // Group categories by their parent paths
  const groupCategoriesByParent = (categories: Category[]) => {
    const result: Record<string, Category[]> = { '': [] };
    
    // First pass: create entries for all categories
    categories.forEach(category => {
      const parts = category.id.split('/');
      if (parts.length === 1) {
        // Top-level category
        if (!result['']) result[''] = [];
        result[''].push(category);
      } else {
        // Nested category
        const parentPath = parts.slice(0, -1).join('/');
        if (!result[parentPath]) result[parentPath] = [];
        result[parentPath].push(category);
      }
    });
    
    return result;
  };

  // Group the categories
  const groupedCategories = groupCategoriesByParent(categories);

  // Render a category and its subcategories recursively
  const renderCategory = (category: Category, level: number = 0) => {
    const isActive = activeCategory === category.id;
    const hasSubcategories = groupedCategories[category.id] && groupedCategories[category.id].length > 0;
    
    return (
      <li key={category.id}>
        <button
          onClick={() => handleCategoryClick(category.id)}
          className={`flex items-center gap-2 w-full p-2 rounded-md text-left ${
            isActive ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100'
          }`}
          style={{ paddingLeft: `${level * 0.5 + 0.5}rem` }}
        >
          <Folder className="h-4 w-4" />
          <span>{category.name}</span>
        </button>
        {hasSubcategories && (
          <ul className="ml-4">
            {groupedCategories[category.id].map(subcat => renderCategory(subcat, level + 1))}
          </ul>
        )}
      </li>
    );
  };

  if (loading) {
    return (
      <div className="p-4 border rounded-lg bg-white">
        <p className="text-gray-500">Loading categories...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border rounded-lg bg-white">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-white">
      <h2 className="text-lg font-semibold mb-4">Categories</h2>
      <ul className="space-y-2">
        {groupedCategories[''] && groupedCategories[''].map(category => renderCategory(category))}
      </ul>
    </div>
  );
};

export default CategoryList;
