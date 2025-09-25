const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 5000;

app.use(express.json());

// List files & folders
app.get('/api/files', (req, res) => {
  const dirPath = req.query.path || __dirname;
  fs.readdir(dirPath, { withFileTypes: true }, (err, files) => {
    if (err) return res.status(500).json({ error: err.message });
    const list = files.map(file => ({
      name: file.name,
      isFolder: file.isDirectory(),
    }));
    res.json(list);
  });
});

// Read file
app.get('/api/file', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: 'No file path' });
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ content: data });
  });
});

// Write file
app.post('/api/file', (req, res) => {
  const { path: filePath, content } = req.body;
  fs.writeFile(filePath, content, err => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Create folder
app.post('/api/folder', (req, res) => {
  const { path: folderPath } = req.body;
  fs.mkdir(folderPath, err => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Delete file/folder
app.delete('/api/item', (req, res) => {
  const itemPath = req.query.path;
  if (!itemPath) return res.status(400).json({ error: 'No path' });
  fs.rm(itemPath, { recursive: true, force: true }, err => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Copy / Paste
app.post('/api/copy', (req, res) => {
  const { source, dest } = req.body;
  fs.copyFile(source, dest, err => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// Download file (as attachment)
app.get('/api/download', (req, res) => {
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: 'No file path' });
  res.download(filePath);
});

// Purane tarike me
app.listen(PORT, '0.0.0.0', ()=> console.log('Server running!'));
