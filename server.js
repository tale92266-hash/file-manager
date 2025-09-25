const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const multer = require('multer');
const mime = require('mime-types');
const archiver = require('archiver');
const { parseGitignore } = require('parse-gitignore-ts');
const AdmZip = require('adm-zip');

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

// Helper function to get file icon based on file type
function getFileIcon(fileName, isDirectory) {
  if (isDirectory) return 'bi bi-folder-fill'; // Folder icon
  
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case '.js':
      return 'bi bi-filetype-js';
    case '.html':
    case '.htm':
      return 'bi bi-filetype-html';
    case '.css':
      return 'bi bi-filetype-css';
    case '.json':
      return 'bi bi-filetype-json';
    case '.txt':
      return 'bi bi-file-earmark-text';
    case '.md':
      return 'bi bi-file-earmark-code';
    case '.py':
      return 'bi bi-filetype-py';
    case '.env':
      return 'bi bi-gear';
    case '.sh':
    case '.bash':
      return 'bi bi-terminal';
    case '.png':
    case '.jpg':
    case '.jpeg':
    case '.gif':
    case '.svg':
      return 'bi bi-file-earmark-image';
    case '.mp4':
    case '.mov':
    case '.avi':
      return 'bi bi-file-earmark-play';
    case '.mp3':
    case '.wav':
      return 'bi bi-file-earmark-music';
    case '.pdf':
      return 'bi bi-file-earmark-pdf';
    default:
      return 'bi bi-file-earmark';
  }
}

// Main route
app.get('/', async (req, res) => {
  try {
    const currentPath = req.query.path || process.cwd();
    const files = await fs.readdir(currentPath, { withFileTypes: true });
    
    // Get user's home directory path
    const userHomePath = path.join(require('os').homedir());
    
    const fileList = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(currentPath, file.name);
        const stats = await fs.stat(filePath);
        
        return {
          name: file.name,
          isDirectory: file.isDirectory(),
          size: file.isDirectory() ? '-' : formatFileSize(stats.size),
          // removed 'modified' attribute
          iconClass: getFileIcon(file.name, file.isDirectory()),
          isHidden: file.name.startsWith('.'),
          fullPath: filePath,
          fileExtension: file.isDirectory() ? 'folder' : path.extname(file.name).toLowerCase().substring(1)
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
      pathSegments: currentPath.split(path.sep).filter(Boolean),
      userHomePath: userHomePath
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

// New Export Route
app.get('/export', async (req, res) => {
  const currentPath = req.query.path || process.cwd();
  const projectName = path.basename(currentPath) || 'project-export';
  const output = archiver('zip', {
    zlib: { level: 9 }
  });

  res.attachment(`${projectName}.zip`);

  output.pipe(res);

  try {
    const gitignorePath = path.join(currentPath, '.gitignore');
    const ignoreList = ['node_modules'];
    
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
      const parsedIgnore = parseGitignore(gitignoreContent);
      ignoreList.push(...parsedIgnore);
    }

    const files = await fs.readdir(currentPath);

    for (const file of files) {
      const filePath = path.join(currentPath, file);
      
      // Check if the file/folder should be ignored
      const shouldIgnore = ignoreList.some(ignorePattern => {
        // Normalize for consistent comparison
        const normalizedFile = path.normalize(file);
        const normalizedPattern = path.normalize(ignorePattern);
        
        // Use `startsWith` for directory patterns and exact match for files
        return normalizedFile === normalizedPattern || normalizedFile.startsWith(normalizedPattern + path.sep);
      });

      if (!shouldIgnore) {
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) {
          output.directory(filePath, file);
        } else {
          output.file(filePath, { name: file });
        }
      }
    }
    
    // Finalize the archive after all files/folders have been appended
    output.finalize();

  } catch (error) {
    console.error(`Error during project export: ${error.message}`);
    res.status(500).send(`Error exporting project: ${error.message}`);
  }
});

// New Import Route
app.post('/import', upload.single('zipFile'), async (req, res) => {
    try {
        const zipFilePath = req.file.path;
        const currentPath = req.body.currentPath;

        if (!zipFilePath || !currentPath) {
            return res.status(400).json({ error: 'Zip file or current path is missing.' });
        }

        const zip = new AdmZip(zipFilePath);
        zip.extractAllTo(currentPath, true); // `true` for overwrite

        // Clean up the uploaded zip file
        await fs.remove(zipFilePath);

        res.json({ success: true, message: 'Project imported successfully!' });
    } catch (error) {
        res.status(500).json({ error: `Error importing project: ${error.message}` });
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