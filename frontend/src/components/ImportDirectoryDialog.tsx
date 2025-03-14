import React, { useState, useRef, useEffect } from 'react';
import { Folder, Upload } from 'lucide-react';
import { importDirectory } from '../api';
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
import { Input } from '../components/ui/input';

interface ImportDirectoryDialogProps {
  onImportComplete: () => void;
}

const ImportDirectoryDialog: React.FC<ImportDirectoryDialogProps> = ({ onImportComplete }) => {
  const [directoryPath, setDirectoryPath] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
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
    try {
      // Use modern File System Access API if available
      if (browserSupport.hasFileSystemAccessAPI) {
        try {
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
          let mdFiles = [];
          try {
            // @ts-ignore - TypeScript doesn't recognize directory handle methods
            for await (const entry of directoryHandle.values()) {
              if (entry.kind === 'file' && entry.name.endsWith('.md')) {
                fileCount++;
                mdFiles.push(entry.name);
              }
            }
          } catch (countErr) {
            console.warn('Could not count files in directory:', countErr);
          }
          
          setDirectoryPath(path);
          setError(null);
          console.log(`Selected directory using File System Access API: ${path} with ${fileCount} markdown files`);
          
          // Show success feedback
          if (fileCount > 0) {
            setError(`找到 ${fileCount} 个 Markdown 文件在 "${path}" 目录中。点击"导入"按钮继续。`);
          } else {
            setError(`已选择 "${path}" 目录。未找到 Markdown 文件，您仍可以尝试导入。`);
          }
          
          // Automatically trigger import if files were found
          if (fileCount > 0 && path) {
            // Wait a moment to let the user see what was found
            setTimeout(() => {
              handleImport();
            }, 1500);
          }
        } catch (err) {
          // User cancelled the picker or permission denied
          if (err instanceof Error && err.name === 'AbortError') {
            console.log('User cancelled the directory picker');
            // Don't show error for user cancellation
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
        
        // Show success feedback
        if (markdownFiles.length > 0) {
          setError(`找到 ${markdownFiles.length} 个 Markdown 文件在 "${path}" 目录中。点击"导入"按钮继续。`);
          
          // Automatically trigger import if files were found
          setTimeout(() => {
            handleImport();
          }, 1500);
        } else {
          setError(`已选择 "${path}" 目录。未找到 Markdown 文件，您仍可以尝试导入。`);
        }
      } catch (err) {
        console.error('Error processing selected files:', err);
        setError('处理选择的文件失败。请重试。');
      }
    } else {
      // User cancelled the selection
      console.log('No files selected');
    }
  };

  const handleImport = async () => {
    if (!directoryPath.trim()) {
      setError('请选择一个目录或输入目录路径');
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      const result = await importDirectory(directoryPath);
      
      if (result.success) {
        setIsOpen(false);
        onImportComplete();
      } else {
        setError(result.message || '导入目录失败');
      }
    } catch (err) {
      console.error('Error importing directory:', err);
      setError('导入目录时发生错误');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Folder className="h-4 w-4" />
          导入文章
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>导入文章</DialogTitle>
          <DialogDescription>
            选择一个本地目录导入文章。子文件夹将作为文章分类，Markdown文件将作为文章导入。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label htmlFor="directory" className="text-sm font-medium">
              目录路径
            </label>
            <div className="flex gap-2">
              <Input
                id="directory"
                placeholder="/path/to/articles"
                value={directoryPath}
                onChange={(e) => setDirectoryPath(e.target.value)}
                className="flex-1"
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleDirectorySelect}
                className="whitespace-nowrap"
              >
                选择目录
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
            </div>
            {error && <p className={`text-sm ${error.includes('找到') ? 'text-green-600' : 'text-red-500'}`}>{error}</p>}
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
