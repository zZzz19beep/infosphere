import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
});

export interface Category {
  id: string;
  name: string;
  path: string;
  // Add a helper property to determine if this is a nested category
  isNested?: boolean;
  parentId?: string;
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
  // Ensure we have files to upload
  if (files.length === 0) {
    return { success: false, message: "未选择任何文件上传" };
  }
  
  // Log the files being uploaded for debugging
  console.log(`Preparing to upload ${files.length} files`);
  
  // Maximum file size for a single chunk (5MB)
  const MAX_CHUNK_SIZE = 5 * 1024 * 1024;
  
  // Maximum number of retry attempts
  const MAX_RETRIES = 3;
  
  // Timeout for uploads (increased to 120 seconds)
  const UPLOAD_TIMEOUT = 120000;
  
  // Count of successfully appended files
  let successfullyAppended = 0;
  let failedToAppend = 0;
  
  // Create a new FormData object
  const formData = new FormData();
  
  // Append each file to the form data with their relative paths
  files.forEach(file => {
    try {
      // Use the webkitRelativePath as the filename to preserve directory structure
      // If webkitRelativePath is not available, use the filename
      const relativePath = file.webkitRelativePath || file.name;
      console.log(`Uploading file: ${relativePath}, type: ${file.type}, size: ${file.size} bytes`);
      
      // For large files, we'll use chunked upload in the next step
      // For now, just append to formData for small files
      if (file.size <= MAX_CHUNK_SIZE) {
        formData.append('files', file, relativePath);
        successfullyAppended++;
      } else {
        // For large files, we'll handle them separately
        // Just count them as successfully appended for now
        formData.append('files', file, relativePath);
        successfullyAppended++;
      }
    } catch (err) {
      console.error(`Error appending file ${file.name} to form data:`, err);
      failedToAppend++;
    }
  });
  
  // Check if any files failed to append
  if (successfullyAppended === 0) {
    return { 
      success: false, 
      message: `无法处理所选文件。请尝试选择其他目录或联系管理员。` 
    };
  }
  
  if (failedToAppend > 0) {
    console.warn(`Failed to append ${failedToAppend} files to form data`);
  }
  
  // Log the categories for debugging
  console.log('Categories mapping:', categories);
  
  // Append categories as JSON string
  formData.append('categories', JSON.stringify(categories));
  
  // Function to upload with retry logic
  const uploadWithRetry = async (retryCount = 0): Promise<any> => {
    try {
      // Show progress with longer timeout for larger uploads
      const response = await api.post('/api/upload-files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: UPLOAD_TIMEOUT,
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            console.log(`Upload progress: ${percentCompleted}%`);
            
            // Dispatch custom event for progress updates
            try {
              window.dispatchEvent(new CustomEvent('upload-progress', { 
                detail: { percent: percentCompleted } 
              }));
            } catch (err) {
              console.error('Error dispatching progress event:', err);
            }
          }
        }
      });
      
      // Validate response
      if (!response.data) {
        return { 
          success: false, 
          message: '服务器返回了空响应，请重试或联系管理员' 
        };
      }
      
      return response.data;
    } catch (error: any) {
      console.error(`Error uploading files (attempt ${retryCount + 1}):`, error);
      
      // Handle different error types
      if (error.response) {
        console.error('Response error data:', error.response.data);
        // Handle specific HTTP status codes
        if (error.response.status === 413) {
          return {
            success: false,
            message: '上传文件过大，请尝试分批上传或减少文件数量'
          };
        }
        return { 
          success: false, 
          message: `上传失败: ${error.response.data?.detail || error.response.statusText || '服务器错误'}`
        };
      }
      
      // For timeout or network errors, retry if we haven't exceeded max retries
      if ((error.code === 'ECONNABORTED' || 
           (error.message && error.message.includes('Network Error'))) && 
          retryCount < MAX_RETRIES) {
        console.log(`Retrying upload (attempt ${retryCount + 1} of ${MAX_RETRIES})...`);
        
        // Wait before retrying (exponential backoff)
        const delay = Math.pow(2, retryCount) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Dispatch retry event for UI feedback
        window.dispatchEvent(new CustomEvent('upload-retry', { 
          detail: { attempt: retryCount + 1, maxRetries: MAX_RETRIES } 
        }));
        
        // Retry the upload
        return uploadWithRetry(retryCount + 1);
      }
      
      // If we've exhausted retries or it's another type of error
      if (error.code === 'ECONNABORTED') {
        return {
          success: false,
          message: '上传超时，请尝试上传较少的文件或检查网络连接'
        };
      }
      
      if (error.message && error.message.includes('Network Error')) {
        return {
          success: false,
          message: '网络连接错误，请检查您的网络连接并重试'
        };
      }
      
      return { 
        success: false, 
        message: `上传失败: ${error.message || '未知错误'}`
      };
    }
  };
  
  // Start the upload with retry logic
  return await uploadWithRetry();
};
