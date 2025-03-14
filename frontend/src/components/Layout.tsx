import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Book } from 'lucide-react';
import { uploadFiles } from '../api';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handleImportComplete = () => {
    // Refresh the page content by updating the key
    setRefreshKey(prev => prev + 1);
  };
  
  // Function to handle directory selection
  const handleDirectorySelect = () => {
    console.log('Directory selection requested');
    
    // Try to use the file input with webkitdirectory
    try {
      const fileInput = document.getElementById('file-input');
      if (fileInput) {
        console.log('Using file input for selection');
        fileInput.click();
        return;
      }
    } catch (err) {
      console.error('Error using file input:', err);
    }
    
    // If method fails, show an error
    console.error('No file input methods available');
    alert('无法找到文件选择器，请刷新页面重试。');
  };
  
  // Handle file input change for directory selection
  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File input change detected');
    const fileList = event.target.files;
    if (!fileList || fileList.length === 0) {
      console.log('No files selected');
      setIsProcessing(false);
      return;
    }
    
    setIsProcessing(true);
    console.log(`Selected ${fileList.length} files`);
    
    // Process the files
    const files: File[] = Array.from(fileList);
    const categories: Record<string, string> = {};
    
    // Log file details for debugging
    files.forEach((file, index) => {
      if (index < 5) { // Limit logging to first 5 files
        console.log(`File ${index}: ${file.name}, webkitRelativePath: ${(file as any).webkitRelativePath || 'N/A'}`);
      }
    });
    
    // Determine if we're using webkitdirectory (has relative paths) or regular file input
    const isUsingWebkitDirectory = files.length > 0 && !!(files[0] as any).webkitRelativePath;
    console.log(`Using webkitdirectory: ${isUsingWebkitDirectory}`);
    
    // Extract categories from file paths
    files.forEach(file => {
      if (file.name.endsWith('.md')) {
        // Use webkitRelativePath to get the full path if available
        const relativePath = isUsingWebkitDirectory 
          ? (file as any).webkitRelativePath 
          : file.name;
        
        let category = 'default';
        
        if (isUsingWebkitDirectory) {
          // For webkitdirectory, use the directory structure as category path
          const pathParts = relativePath.split('/');
          if (pathParts.length > 1) {
            // Use all directories except the last part (which is the filename)
            category = pathParts.slice(0, -1).join('/');
          }
        } else {
          // For regular file input, try to extract category from file path
          const fullPath = file.name;
          
          // Try to match a path pattern like "Category/SubCategory/file.md"
          const pathMatch = fullPath.match(/^(.+)[\/\\][^\/\\]+\.md$/);
          
          if (pathMatch && pathMatch[1]) {
            // If file is in a directory structure, use the directory path as category
            category = pathMatch[1].replace(/\\/g, '/'); // Normalize backslashes to forward slashes
            console.log(`Extracted category from path: ${category} for file ${fullPath}`);
          } else {
            // For regular file input with no directory structure
            // Try to extract from file name pattern if possible
            const fileNameParts = file.name.split('-');
            if (fileNameParts.length > 1) {
              category = fileNameParts[0]; // Use first part before dash as category
            } else {
              // Remove extension to use as category
              category = file.name.replace(/\.md$/, '');
            }
          }
        }
        
        console.log(`Processing file: ${relativePath}, category: ${category}`);
        
        // Use the relative path or filename as the key
        categories[relativePath] = category;
      } else {
        console.log(`Skipping non-markdown file: ${file.name}`);
      }
    });
    
    // Filter to only include markdown files
    const markdownFiles = files.filter(file => file.name.endsWith('.md'));
    console.log(`Found ${markdownFiles.length} markdown files`);
    
    // Log more detailed information about the files
    if (markdownFiles.length > 0) {
      console.log('Markdown files found:');
      markdownFiles.forEach((file, index) => {
        if (index < 10) { // Limit to first 10 files for brevity
          console.log(`- ${file.name} (${(file as any).webkitRelativePath || 'N/A'})`);
        }
      });
      
      // Log categories for debugging
      console.log('Categories mapping:');
      Object.entries(categories).forEach(([path, category]) => {
        console.log(`- ${path} => ${category}`);
      });
    }
    
    if (markdownFiles.length === 0) {
      alert('未找到 Markdown 文件，请选择包含 .md 文件的目录。');
      setIsProcessing(false);
      return;
    }
    
    // Show a confirmation dialog before proceeding with import
    const confirmImport = window.confirm(`找到 ${markdownFiles.length} 个 Markdown 文件，分类为 ${Object.keys(categories).length} 个类别。确定要导入吗？`);
    
    if (confirmImport) {
      // Handle the results
      handleImportResults(markdownFiles, categories);
    } else {
      console.log('Import cancelled by user');
      setIsProcessing(false);
    }
    
    // Reset the input
    event.target.value = '';
  };
  
  // Common handler for both import methods
  const handleImportResults = async (files: File[], categories: Record<string, string>) => {
    try {
      if (files.length > 0) {
        // Show success message
        alert(`找到 ${files.length} 个 Markdown 文件，正在导入...`);
        
        console.log(`Uploading ${files.length} files with ${Object.keys(categories).length} category mappings`);
        
        // Upload files
        setIsProcessing(true);
        const result = await uploadFiles(files, categories);
        console.log('Upload result:', result);
        
        if (result.success) {
          const categoriesCreated = result.stats?.categories_created 
            ? result.stats.categories_created.join(', ') 
            : result.stats?.categories || 0;
            
          alert(`上传成功！导入了 ${result.stats?.articles || 0} 篇文章，${categoriesCreated} 个分类。`);
          handleImportComplete();
        } else {
          alert(`上传失败: ${result.message || '未知错误'}`);
        }
      } else {
        alert('未找到 Markdown 文件，请选择包含 .md 文件的目录。');
      }
    } catch (err) {
      console.error('Error uploading files:', err);
      alert(`上传文件时发生错误: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setIsProcessing(false);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <Book className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">Markdown CMS</h1>
          </Link>
          <div className="relative">
            <button 
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 gap-2"
              onClick={handleDirectorySelect}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path>
              </svg>
              导入文章
            </button>
            
            {/* File input for selection */}
            <input 
              type="file" 
              id="file-input" 
              multiple
              accept=".md"
              webkitdirectory="true"
              directory="true"
              className="hidden"
              onChange={handleFileInputChange}
            />
            
            {/* Loading indicator */}
            {isProcessing && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                <div className="bg-white rounded-lg p-6 max-w-md w-full">
                  <h2 className="text-xl font-bold mb-4">正在处理...</h2>
                  <p className="mb-4">正在处理目录，请稍候...</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6" key={refreshKey}>
        {children}
      </main>
      <footer className="bg-white border-t mt-auto">
        <div className="container mx-auto px-4 py-4 text-center text-gray-500">
          <p>Markdown Content Management System</p>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
