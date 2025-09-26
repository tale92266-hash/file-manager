const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');
const { parseGitignore } = require('parse-gitignore-ts');
const simpleGit = require('simple-git'); 
const multer = require('multer'); 
const AdmZip = require('adm-zip');
const archiver = require('archiver');
const os = require('os'); 
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = 'uploads/';
    fs.ensureDirSync(tempDir);
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});
const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', './views');

function getFileIcon(fileName, isDirectory) {
  if (isDirectory) return 'bi bi-folder-fill'; 
  
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

app.get('/', async (req, res) => {
  try {
    const currentPath = req.query.path || process.cwd();
    const files = await fs.readdir(currentPath, { withFileTypes: true });
    
    const userHomePath = path.join(require('os').homedir());
    
    const fileList = await Promise.all(
      files.map(async (file) => {
        const filePath = path.join(currentPath, file.name);
        const stats = await fs.stat(filePath);
        
        return {
          name: file.name,
          isDirectory: file.isDirectory(),
          size: file.isDirectory() ? '-' : formatFileSize(stats.size),
          iconClass: getFileIcon(file.name, file.isDirectory()),
          isHidden: file.name.startsWith('.'),
          fullPath: filePath,
          fileExtension: file.isDirectory() ? 'folder' : path.extname(file.name).toLowerCase().substring(1)
        };
      })
    );

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

app.get('/file-content', async (req, res) => {
  try {
    const filePath = req.query.path;
    const content = await fs.readFile(filePath, 'utf8');
    res.json({ content: content, path: filePath });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/save-file', async (req, res) => {
  try {
    const { filePath, content } = req.body;
    await fs.writeFile(filePath, content, 'utf8');
    res.json({ success: true, message: 'File saved successfully!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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

app.delete('/delete', async (req, res) => {
  try {
    const { path: itemPath } = req.body;
    await fs.remove(itemPath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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

app.get('/download', (req, res) => {
  const filePath = req.query.path;
  res.download(filePath, (err) => {
      if (err) {
          console.error(`Error downloading file: ${err.message}`);
          if (!res.headersSent) {
              res.status(500).send('Error downloading file.');
          }
      }
  });
});

app.get('/download-folder', (req, res) => {
    const folderPath = req.query.path;
    const folderName = path.basename(folderPath);
    const archiver = require('archiver');
    const archive = archiver('zip', {
        zlib: { level: 9 }
    });

    res.attachment(`${folderName}.zip`);

    archive.on('error', (err) => {
        console.error(`Error zipping folder: ${err.message}`);
        if (!res.headersSent) {
            res.status(500).send('Error zipping folder.');
        }
    });

    archive.pipe(res);
    archive.directory(folderPath, false);
    archive.finalize();
});

// Git import ka naya implementation
app.post('/import-git', async (req, res) => {
  try {
    let { repoUrl, currentPath } = req.body;
    if (!repoUrl) {
      return res.status(400).json({ success: false, error: 'GitHub repository URL is required.' });
    }

    // .git ko URL se hata dein agar maujood hai
    if (repoUrl.endsWith('.git')) {
        repoUrl = repoUrl.slice(0, -4);
    }

    const repoName = path.basename(repoUrl);
    const branchesToTry = ['main', 'master'];
    let zipUrl = '';
    let response;

    // Branches ko try karein
    for (const branch of branchesToTry) {
        zipUrl = `${repoUrl}/archive/refs/heads/${branch}.zip`;
        response = await fetch(zipUrl);
        if (response.ok) {
            break; // Agar download success ho gaya to loop se bahar aa jayen
        }
    }

    if (!response || !response.ok) {
      return res.status(500).json({ success: false, error: `Failed to download repository zip from main/master branch. Please check the URL and branch name.` });
    }

    const tempDirPrefix = 'git-zip-';
    const tempDirPath = await fs.mkdtemp(path.join(os.tmpdir(), tempDirPrefix));
    const zipFilePath = path.join(tempDirPath, `${repoName}.zip`);

    // Download the zip file
    const fileStream = fs.createWriteStream(zipFilePath);
    await new Promise((resolve, reject) => {
      response.body.pipe(fileStream);
      response.body.on("error", reject);
      fileStream.on("finish", resolve);
    });

    // Extract the zip file
    const zip = new AdmZip(zipFilePath);
    const tempExtractionPath = path.join(tempDirPath, 'extracted');
    zip.extractAllTo(tempExtractionPath, true);

    // Cloned repository ka naam nikalne ke liye
    const filesInTemp = await fs.readdir(tempExtractionPath, { withFileTypes: true });
    const clonedRepoFolder = filesInTemp.find(item => item.isDirectory() && item.name !== '.git');
    
    if (!clonedRepoFolder) {
      await fs.remove(tempDirPath);
      return res.status(500).json({ success: false, error: 'Cloned repository folder not found after extraction.' });
    }

    const clonedRepoPath = path.join(tempExtractionPath, clonedRepoFolder.name);

    // Temp directory se files ko current path mein copy karein
    await fs.copy(clonedRepoPath, currentPath, { overwrite: true });
    
    // Temporary directory ko delete karein
    await fs.remove(tempDirPath);

    res.json({ success: true, message: `Repository files imported successfully from ZIP to current path!` });

  } catch (error) {
    console.error('Git import error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/import-zip', upload.single('zipFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }

    const zipFilePath = req.file.path;
    const currentPath = req.body.currentPath;

    if (!fs.existsSync(zipFilePath)) {
      return res.status(404).json({ success: false, error: 'Zip file not found on server.' });
    }

    const zip = new AdmZip(zipFilePath);
    zip.extractAllTo(currentPath, true);

    await fs.remove(zipFilePath);

    res.json({ success: true, message: 'Files imported successfully from ZIP!' });

  } catch (error) {
    console.error('Zip import error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/export-zip', async (req, res) => {
    try {
        const { currentPath } = req.body;
        const folderName = path.basename(currentPath) || 'all-files';
        const outputFileName = `${folderName}.zip`;
        const tempDir = path.join(__dirname, 'temp');
        await fs.ensureDir(tempDir);
        const outputPath = path.join(tempDir, outputFileName);

        const output = fs.createWriteStream(outputPath);
        const archive = archiver('zip', {
            zlib: { level: 9 }
        });
        
        archive.on('error', (err) => {
            console.error(`Error zipping folder: ${err.message}`);
            res.status(500).json({ success: false, error: 'Error zipping folder.' });
        });

        output.on('close', async () => {
            try {
                const stats = await fs.stat(outputPath);
                const fileSize = formatFileSize(stats.size);
                res.json({ success: true, filePath: outputPath, fileSize: fileSize });
            } catch (err) {
                res.status(500).json({ success: false, error: 'Could not get file size.' });
            }
        });
        
        archive.pipe(output);
        const filesAndFolders = await fs.readdir(currentPath, { withFileTypes: true });
        for (const item of filesAndFolders) {
            if (item.name === 'node_modules') {
                continue;
            }
            const itemPath = path.join(currentPath, item.name);
            if (item.isDirectory()) {
                archive.directory(itemPath, item.name);
            } else {
                archive.file(itemPath, { name: item.name });
            }
        }
        
        archive.finalize();

    } catch (error) {
        console.error('Export zip error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/download-zip-file', (req, res) => {
    const filePath = req.query.path;
    const fileName = path.basename(filePath);
    
    res.download(filePath, fileName, (err) => {
        if (err) {
            console.error('Download error:', err);
        }
        fs.remove(filePath, removeErr => {
            if (removeErr) console.error('Failed to remove temp file:', removeErr);
        });
    });
});


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
