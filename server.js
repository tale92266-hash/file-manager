const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const mime = require('mime-types');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = req.body.currentPath || './';
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', './views');

// Helper function to get file icon
function getFileIcon(fileName, isDirectory) {
  if (isDirectory) return '📁';
  
  const ext = path.extname(fileName).toLowerCase();
  const iconMap = {
    '.js': '📜', '.html': '🌐', '.css': '🎨', '.json': '📋',
    '.txt': '📄', '.md': '📝', '.png': '🖼️', '.jpg': '🖼️',
    '.gif': '🖼️', '.mp4': '🎬', '.mp3': '🎵', '.pdf': '📕'
  };
  
  return iconMap[ext] || '📄';
}

// Main route
app.get('/', async (req, res) => {
  try {
    const currentPath = req.query.path || process.cwd();
    const files = await fs.readdir(currentPath, { withFileTypes: true });
    
    const fileList = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(currentPath, file.name);
        const stats = await fs.stat(filePath);
        
        return {
          name: file.name,
          isDirectory: file.isDirectory(),
          size: file.isDirectory() ? '-' : formatFileSize(stats.size),
          modified: stats.mtime.toLocaleDateString(),
          icon: getFileIcon(file.name, file.isDirectory()),
          isHidden: file.name.startsWith('.'),
          fullPath: filePath
        };
      })
    );

    // Sort: directories first, then files
    fileList.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    res.render('index', {
      files: fileList,
      currentPath: currentPath,
      parentPath: path.dirname(currentPath),
      pathSegments: currentPath.split(path.sep).filter(Boolean)
    });
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

// File content route
app.get('/file-content', async (req, res) => {
  try {
    const filePath = req.query.path;
    const content = await fs.readFile(filePath, 'utf8');
    res.json({ content: content, path: filePath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save file content
app.post('/save-file', async (req, res) => {
  try {
    const { filePath, content } = req.body;
    await fs.writeFile(filePath, content, 'utf8');
    res.json({ success: true, message: 'File saved successfully!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new file/folder
app.post('/create', async (req, res) => {
  try {
    const { name, type, currentPath } = req.body;
    const newPath = path.join(currentPath, name);
    
    if (type === 'folder') {
      await fs.ensureDir(newPath);
    } else {
      await fs.writeFile(newPath, '');
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete file/folder
app.delete('/delete', async (req, res) => {
  try {
    const { path: itemPath } = req.body;
    await fs.remove(itemPath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rename file/folder
app.post('/rename', async (req, res) => {
  try {
    const { oldPath, newName } = req.body;
    const newPath = path.join(path.dirname(oldPath), newName);
    await fs.rename(oldPath, newPath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload file
app.post('/upload', upload.single('file'), (req, res) => {
  try {
    res.json({ success: true, message: 'File uploaded successfully!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

app.listen(PORT, () => {
  console.log(`📱 File Manager Server running on http://localhost:${PORT}`);
  console.log(`🔧 Terminal Path: ${process.cwd()}`);
});
