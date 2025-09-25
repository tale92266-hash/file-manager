import React, { useState, useEffect } from 'react';

function Editor({ filePath, onClose }) {
  const [content, setContent] = useState('');
  useEffect(() => {
    fetch(`/api/file?path=${filePath}`)
      .then(res=>res.json())
      .then(data=>setContent(data.content));
  }, [filePath]);

  const save = async () => {
    await fetch('/api/file', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ path: filePath, content })
    });
    onClose();
  };

  return (
    <div style={{position:'fixed', top:0, left:0, width:'100vw', height:'100vh', background:'#eee', zIndex:100}}>
      <textarea value={content} onChange={e=>setContent(e.target.value)} style={{width:'100%',height:'80vh'}} />
      <div style={{display:'flex',justifyContent:'space-between',padding:8}}>
        <button onClick={save}>Save</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
export default Editor;
