import React, { useState, useRef, useEffect } from 'react';
import { Folder, Upload } from 'lucide-react';
import { uploadFiles } from '../api';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Button } from '../components/ui/button';

interface ImportDirectoryDialogProps {
  onImportComplete: () => void;
}

const ImportDirectoryDialog: React.FC<ImportDirectoryDialogProps> = ({ onImportComplete }) => {
  const [directoryPath, setDirectoryPath] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  
  // Reset states when dialog opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(null);
      setIsProcessing(false);
      setSelectedFiles([]);
      setCategories({});
      setDirectoryPath('');
    }
  }, [isOpen]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [browserSupport, setBrowserSupport] = useState({
    hasFileSystemAccessAPI: false,
    hasWebkitDirectory: false
  });
  
  // We'll use this ref to access the file input element
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Detect browser capabilities on component mount
  useEffect(() => {
    const checkBrowserSupport = () => {
      const hasFileSystemAPI = typeof window !== 'undefined' && 'showDirectoryPicker' in window;
      
      // Check for webkitdirectory support
      const input = document.createElement('input');
      input.type = 'file';
      const hasWebkitDir = 'webkitdirectory' in input || 'directory' in input;
      
      setBrowserSupport({
        hasFileSystemAccessAPI: hasFileSystemAPI,
        hasWebkitDirectory: hasWebkitDir
      });
      
      console.log(`Browser support: File System API: ${hasFileSystemAPI}, webkitdirectory: ${hasWebkitDir}`);
    };
    
    checkBrowserSupport();
  }, []);

  const handleDirectorySelect = async () => {
    // Reset states before starting new selection
    setError(null);
    setSuccess(null);
    setIsProcessing(true);
    
    try {
      // Use modern File System Access API if available
      if (browserSupport.hasFileSystemAccessAPI) {
        try {
          console.log('Attempting to open directory picker...');
          // @ts-ignore - TypeScript doesn't recognize showDirectoryPicker yet
          const directoryHandle = await window.showDirectoryPicker({
            id: 'markdown-cms-directory',
            mode: 'read',
            startIn: 'documents'
          });
          
          // Get the directory path - try to get a more complete path if possible
          let path = '';
          try {
            // Try to get a more complete path if possible
            // @ts-ignore - TypeScript doesn't recognize FileSystemHandle properties
            path = directoryHandle.name;
            
            // Some browsers might support getting a better path
            // @ts-ignore - Not standard but some browsers support it
            if (directoryHandle.fullPath) {
              // @ts-ignore
              path = directoryHandle.fullPath;
            }
          } catch (pathErr) {
            console.warn('Could not get full path:', pathErr);
            // @ts-ignore
            path = directoryHandle.name;
          }
          
          // Get file count to provide better feedback
          let fileCount = 0;
          let mdFiles: Array<{name: string, path: string}> = [];
          let categoriesSet = new Set<string>();
          
          // Recursive function to process directories
          const processDirectory = async (dirHandle: any, relativePath = '') => {
            try {
              // @ts-ignore - TypeScript doesn't recognize directory handle methods
              for await (const entry of dirHandle.values()) {
                if (entry.kind === 'file' && entry.name.endsWith('.md')) {
                  fileCount++;
                  const fullPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
                  mdFiles.push({ name: entry.name, path: fullPath });
                } else if (entry.kind === 'directory') {
                  // Add to categories if it's a direct subdirectory
                  if (!relativePath) {
                    categoriesSet.add(entry.name);
                  }
                  // Process subdirectory recursively
                  const newPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
                  // @ts-ignore
                  await processDirectory(entry, newPath);
                }
              }
            } catch (err) {
              console.warn(`Error processing directory ${relativePath}:`, err);
            }
          };
          
          // Start recursive processing
          await processDirectory(directoryHandle);
          
          setDirectoryPath(path);
          setError(null);
          console.log(`Selected directory using File System Access API: ${path} with ${fileCount} markdown files in ${categoriesSet.size} categories`);
          
          // Show success feedback
          if (fileCount > 0) {
            setSuccess(`找到 ${fileCount} 个 Markdown 文件在 "${path}" 目录中的 ${categoriesSet.size} 个分类下。点击"导入"按钮继续。`);
            setError(null);
          } else {
            setSuccess(`已选择 "${path}" 目录。未找到 Markdown 文件，您仍可以尝试导入。`);
            setError(null);
          }
          
          // Store files for upload - convert the file-like objects to actual File objects
          const actualFiles: File[] = [];
          
          // Create categories mapping
          const categoriesMap: Record<string, string> = {};
          
          // We'll need to read the files manually since we can't directly get File objects
          const readFiles = async () => {
            for (const fileInfo of mdFiles) {
              try {
                // Get the file handle
                const fileHandle = await directoryHandle.getFileHandle(fileInfo.path);
                // Get the file
                const file = await fileHandle.getFile();
                // Store the file with its path
                actualFiles.push(file);
                
                // Extract category from path
                const pathParts = fileInfo.path.split('/');
                let category = 'default';
                if (pathParts.length > 1) {
                  category = pathParts[0]; // First part of path is category
                }
                
                // Use the full path as the key
                categoriesMap[fileInfo.path] = category;
              } catch (err) {
                console.error(`Error reading file ${fileInfo.path}:`, err);
              }
            }
            
            // Set the files and categories
            setSelectedFiles(actualFiles);
            setCategories(categoriesMap);
            
            console.log(`Prepared ${actualFiles.length} files for upload with ${categoriesSet.size} categories`);
          };
          
          // Set processing state to false when done
          setIsProcessing(false);
          
          // Read the files
          await readFiles();
          
          // Don't automatically trigger import - let the user click the button
          // This gives them time to see what was found and decide whether to proceed
        } catch (err) {
          // User cancelled the picker or permission denied
          if (err instanceof Error && err.name === 'AbortError') {
            console.log('User cancelled the directory picker');
            // Provide clear feedback for user cancellation
            setError('您取消了目录选择。请重新点击"选择文章目录"按钮。');
          } else {
            console.error('Error with File System Access API:', err);
            setError('选择目录失败。请重试或手动输入路径。');
            
            // If File System API failed, try fallback to webkitdirectory
            if (browserSupport.hasWebkitDirectory && fileInputRef.current) {
              console.log('Falling back to webkitdirectory...');
              fileInputRef.current.click();
            }
          }
        }
      } else if (browserSupport.hasWebkitDirectory && fileInputRef.current) {
        // Fallback to webkitdirectory
        console.log('Using webkitdirectory fallback...');
        fileInputRef.current.click();
      } else {
        // No directory selection APIs available
        setError('您的浏览器不支持目录选择功能。请手动输入路径。');
      }
    } catch (err) {
      console.error('Error selecting directory:', err);
      setError('选择目录失败。请重试或手动输入路径。');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      try {
        // Get the directory path from the first file
        const path = files[0].webkitRelativePath.split('/')[0];
        
        // Count markdown files
        const markdownFiles = files.filter(file => file.name.endsWith('.md'));
        
        setDirectoryPath(path);
        setError(null);
        console.log(`Selected directory: ${path} with ${files.length} total files, ${markdownFiles.length} markdown files`);
        
        // Store files for upload
        setSelectedFiles(markdownFiles);
        
        // Create categories mapping
        const categoriesMap: Record<string, string> = {};
        // Track unique categories
        const categoriesSet = new Set<string>();
        
        markdownFiles.forEach(file => {
          // Extract category from relative path
          const relativePath = file.webkitRelativePath;
          const pathParts = relativePath.split('/');
          
          // If file is in a subdirectory, use that as category
          let category = 'default';
          if (pathParts.length > 2) {
            category = pathParts[1]; // First subdirectory after root
            categoriesSet.add(category);
          }
          
          // Use the full relative path as the key instead of just the filename
          categoriesMap[relativePath] = category;
        });
        
        setCategories(categoriesMap);
        
        // Show success feedback
        if (markdownFiles.length > 0) {
          setSuccess(`找到 ${markdownFiles.length} 个 Markdown 文件在 "${path}" 目录中的 ${categoriesSet.size} 个分类下。点击"导入"按钮继续。`);
          setError(null);
          
          // Don't automatically trigger import - let the user click the button
          // This gives them time to see what was found and decide whether to proceed
        } else {
          setSuccess(`已选择 "${path}" 目录。未找到 Markdown 文件，您仍可以尝试导入。`);
          setError(null);
        }
      } catch (err) {
        console.error('Error processing selected files:', err);
        setError('处理选择的文件失败。请重试。');
        // Set processing state to false when done
        setIsProcessing(false);

      }
    } else {
      // User cancelled the selection
      console.log('No files selected');
    }
  };

  const handleImport = async () => {
    if (selectedFiles.length === 0) {
      setError('请选择包含Markdown文件的目录');
      setSuccess(null);
      return;
    }

    setIsImporting(true);
    setError(null);
    setSuccess(null);

    try {
      console.log(`Uploading ${selectedFiles.length} files with categories:`, categories);
      const result = await uploadFiles(selectedFiles, categories);
      
      if (result.success) {
        console.log(`Upload successful: ${JSON.stringify(result.stats)}`);
        setSuccess(`上传成功！导入了 ${result.stats?.articles || 0} 篇文章，${result.stats?.categories || 0} 个分类。`);
        // Keep dialog open for a moment to show success message
        setTimeout(() => {
          setIsOpen(false);
          onImportComplete();
        }, 1500);
      } else {
        console.error(`Upload failed: ${result.message}`);
        setError(result.message || '上传文件失败');
      }
    } catch (err) {
      console.error('Error uploading files:', err);
      if (err instanceof Error) {
        setError(`上传文件时发生错误: ${err.message}`);
      } else {
        setError('上传文件时发生未知错误');
      }
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild onClick={() => setIsOpen(true)}>
        <Button variant="outline" className="gap-2">
          <Folder className="h-4 w-4" />
          导入文章
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>导入文章</DialogTitle>
          <DialogDescription>
            选择一个本地目录导入文章。目录中的子文件夹将作为文章分类，子文件夹内的Markdown文件将作为该分类下的文章导入。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <div className="flex flex-col gap-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleDirectorySelect}
                className="flex gap-2 items-center justify-center py-8"
              >
                <Folder className="h-6 w-6" />
                <span className="text-lg">选择文章目录</span>
              </Button>
              <input
                type="file"
                ref={fileInputRef}
                // @ts-ignore - TypeScript doesn't recognize webkitdirectory attribute
                webkitdirectory=""
                // @ts-ignore - TypeScript doesn't recognize directory attribute
                directory=""
                style={{ display: 'none' }}
                onChange={handleFileInputChange}
                multiple
              />
              {directoryPath && (
                <div className="p-4 border rounded-md bg-gray-50">
                  <p className="font-medium">已选择目录: {directoryPath}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedFiles.length > 0 
                      ? `找到 ${selectedFiles.length} 个 Markdown 文件` 
                      : '未找到 Markdown 文件'}
                  </p>
                </div>
              )}
            </div>
            {success && <p className="text-sm text-green-600">{success}</p>}
            {error && <p className="text-sm text-red-500">{error}</p>}
            {isProcessing && <p className="text-sm text-blue-500">正在处理目录，请稍候...</p>}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleImport} disabled={isImporting} className="gap-2">
            {isImporting ? '导入中...' : '导入'}
            <Upload className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ImportDirectoryDialog;
