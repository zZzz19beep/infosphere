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
  
  // Ensure we have files to upload
  if (files.length === 0) {
    return { success: false, message: "No files selected for upload" };
  }
  
  // Log the files being uploaded for debugging
  console.log(`Preparing to upload ${files.length} files`);
  
  // Append each file to the form data with their relative paths
  files.forEach(file => {
    try {
      // Use the webkitRelativePath as the filename to preserve directory structure
      // If webkitRelativePath is not available, use the filename
      const relativePath = file.webkitRelativePath || file.name;
      console.log(`Uploading file: ${relativePath}, type: ${file.type}, size: ${file.size} bytes`);
      formData.append('files', file, relativePath);
    } catch (err) {
      console.error(`Error appending file ${file.name} to form data:`, err);
    }
  });
  
  // Log the categories for debugging
  console.log('Categories mapping:', categories);
  
  // Append categories as JSON string
  formData.append('categories', JSON.stringify(categories));
  
  try {
    const response = await api.post('/api/upload-files', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000 // Increase timeout to 30 seconds for larger uploads
    });
    return response.data;
  } catch (error: any) {
    console.error('Error uploading files:', error);
    if (error.response) {
      console.error('Response error data:', error.response.data);
      return { 
        success: false, 
        message: `上传失败: ${error.response.data?.detail || error.response.statusText || '服务器错误'}`
      };
    }
    if (error.code === 'ECONNABORTED') {
      return {
        success: false,
        message: '上传超时，请尝试上传较少的文件或检查网络连接'
      };
    }
    return { 
      success: false, 
      message: `上传失败: ${error.message || '未知错误'}`
    };
  }
};
