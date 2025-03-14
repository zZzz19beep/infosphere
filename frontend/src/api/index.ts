import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
});

export interface Category {
  id: string;
  name: string;
  path: string;
}

export interface ArticleSummary {
  id: string;
  title: string;
  category_id: string;
  summary: string | null;
  comment_count: number;
  path: string;
}

export interface Article extends ArticleSummary {
  content: string;
}

export interface Comment {
  id: string;
  article_id: string;
  author: string;
  content: string;
  created_at: string;
}

export const getCategories = async (): Promise<Category[]> => {
  const response = await api.get('/api/categories');
  return response.data;
};

export const getArticlesByCategory = async (categoryId: string): Promise<ArticleSummary[]> => {
  const response = await api.get(`/api/categories/${categoryId}/articles`);
  return response.data;
};

export const getArticle = async (categoryId: string, filename: string): Promise<Article> => {
  const response = await api.get(`/api/articles/${categoryId}/${filename}`);
  return response.data;
};

export const getComments = async (categoryId: string, filename: string): Promise<Comment[]> => {
  const response = await api.get(`/api/articles/${categoryId}/${filename}/comments`);
  return response.data;
};

export const addComment = async (categoryId: string, filename: string, author: string, content: string): Promise<Comment> => {
  const response = await api.post(`/api/articles/${categoryId}/${filename}/comments`, {
    author,
    content,
  });
  return response.data;
};

export const summarizeArticle = async (categoryId: string, filename: string): Promise<{ summary: string }> => {
  const response = await api.post(`/api/articles/${categoryId}/${filename}/summarize`);
  return response.data;
};

export const importDirectory = async (directoryPath: string): Promise<{ success: boolean; stats?: any; message?: string }> => {
  const response = await api.post('/api/import-directory', {
    directory_path: directoryPath
  });
  return response.data;
};

export const uploadFiles = async (
  files: File[],
  categories: Record<string, string>
): Promise<{ success: boolean; stats?: any; message?: string }> => {
  const formData = new FormData();
  
  // Append each file to the form data
  files.forEach(file => {
    formData.append('files', file);
  });
  
  // Append categories as JSON string
  formData.append('categories', JSON.stringify(categories));
  
  const response = await api.post('/api/upload-files', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};
