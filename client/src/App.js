import React, { useState } from 'react';
import Editor from './Editor';

function App() {
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [selectedFile, setSelectedFile] = useState(null);

  // Fetch files/folders list
  const fetchFiles = async (dir = "/") => {
    const res = await fetch(`/api/files?path=${dir}`);
    setFiles(await res.json());
    setCurrentPath(dir);
  };

  // UI buttons like create, delete etc.

  return (
    <div style={{ width:'100vw',height:'100vh', background:'#edecec', display:'flex', flexDirection:'column'}}>
      <header style={{padding:12, fontSize:18}}>File Manager</header>
      <div>
        {files.map(file => (
          <div key={file.name} style={{padding:8, borderBottom:'1px solid #ddd'}}>
            <span onClick={() => file.isFolder ? fetchFiles(`${currentPath}/${file.name}`) : setSelectedFile(`${currentPath}/${file.name}`)}>
              {file.isFolder ? '📁' : '📄'} {file.name}
            </span>
          </div>
        ))}
      </div>
      {!!selectedFile && <Editor filePath={selectedFile} onClose={()=>setSelectedFile(null)} />}
      <footer style={{position:'fixed', bottom:0, left:0, width:'100%', background:'#fff', display:'flex', justifyContent:'space-between'}}>
        {/* Buttons for create, paste, save, cancel etc. */}
        <button onClick={()=>/*createFile*/}>New File</button>
        <button onClick={()=>/*createFolder*/}>New Folder</button>
        <button onClick={()=>/*deleteItem*/}>Delete</button>
        <button onClick={()=>/*copyPaste*/}>Copy-Paste</button>
        <button onClick={()=>fetchFiles(currentPath)}>Refresh</button>
      </footer>
    </div>
  );
}

export default App;
