/*
 * UPDATED: main.js with multi-select action button logic and context menu click fix
 */

let currentPath = '/';
let hideHidden = true;
let selectedFilePaths = [];
let selectedFileName = '';
let selectedFileType = '';
let originalContent = '';
let activeContextMenu = null;
let terminalWs;
let touchTimeout;
let longPressThreshold = 500;
let isMultiSelectMode = false;
let isLongPress = false; // NEW: Flag to track a successful long press
let isScrolling = false; // NEW: Flag to track scrolling motion
let touchStartX = 0; // NEW: To track touch start position
let touchStartY = 0; // NEW: To track touch start position
let isActionButtonMenuOpen = false; // NEW: To track if the action menu is open
let hasItemsToPaste = false; // NEW: To track if there are items in the paste buffer

// Helper function to get the base path from the URL
function getBasePath() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('path') || '/';
}

// Navigation functions
function navigateToPath(path) {
    window.location.href = `/?path=${encodeURIComponent(path)}`;
}

function refreshFiles() {
    window.location.reload();
}

// Sidebar toggle function
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('active');
}

// File filtering
function filterFiles(type) {
    const fileItems = document.querySelectorAll('.file-item');
    
    fileItems.forEach(item => {
        const fileName = item.querySelector('.file-name').textContent.toLowerCase();
        let shouldShow = true;
        
        if (type !== 'all' && type !== 'hidden') {
            shouldShow = fileName.match(/\.(js|html|css|json|py|java|cpp|c|php|rb|go|ts|jsx|tsx|yml|yaml|sql)$/);
            if (type === 'images') {
                shouldShow = fileName.match(/\.(jpg|jpeg|png|gif|svg|bmp|webp|ico)$/);
            }
        }
        
        if (type === 'hidden') {
            shouldShow = item.classList.contains('hidden-file');
        } else if (hideHidden && item.classList.contains('hidden-file')) {
            shouldShow = false;
        }

        if (shouldShow) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

// Context menu functions
function showContextMenu(event, filePath, fileName) {
    if (activeContextMenu) {
        hideContextMenu(activeContextMenu);
    }
    
    event.preventDefault();
    event.stopPropagation();
    
    selectedFilePaths = [];
    selectedFilePaths.push(filePath);
    selectedFileName = fileName;
    selectedFileType = event.currentTarget.closest('.file-item').dataset.type;

    const fileItems = document.querySelectorAll('.file-item');
    fileItems.forEach(item => {
        item.classList.remove('selected');
        if (item.dataset.path === filePath) {
            item.classList.add('selected');
        }
    });
    
    const contextMenu = document.getElementById('contextMenu');
    if (contextMenu) {
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const menuWidth = contextMenu.offsetWidth;
        const menuHeight = contextMenu.offsetHeight;
        let leftPosition = event.pageX;
        let topPosition = event.pageY;

        if (leftPosition + menuWidth > windowWidth - 20) {
            leftPosition = windowWidth - menuWidth - 20;
        }
        if (topPosition + menuHeight > windowHeight - 20) {
            topPosition = windowHeight - menuHeight - 20;
        }
        
        if (leftPosition < 20) {
            leftPosition = 20;
        }
        if (topPosition < 20) {
            topPosition = 20;
        }
        
        contextMenu.style.left = leftPosition + 'px';
        contextMenu.style.top = topPosition + 'px';
        contextMenu.classList.add('active');
        activeContextMenu = contextMenu;
    }
    
    document.addEventListener('click', function handleDocClick(e) {
        if (contextMenu && !contextMenu.contains(e.target)) {
            hideContextMenu();
            e.stopPropagation();
        }
        document.removeEventListener('click', handleDocClick);
    });
}

// FIX: hideContextMenu function ko update kiya gaya hai
function hideContextMenu() {
    const contextMenu = document.getElementById('contextMenu');
    if (contextMenu) {
        contextMenu.classList.remove('active');
        activeContextMenu = null;
        
        // Agar multi-select mode active nahi hai, toh selection hatana hai
        if (!isMultiSelectMode) {
            document.querySelectorAll('.file-item.selected').forEach(item => {
                item.classList.remove('selected');
            });
            selectedFilePaths = [];
        }
    }
}

function renameFile() {
    hideContextMenu();
    const renameModal = document.getElementById('renameModal');
    const renameNewNameInput = document.getElementById('renameNewName');
    
    const fileItem = document.querySelector('.file-item.selected');
    if (!fileItem || selectedFilePaths.length > 1) {
        showNotification('Please select a single item to rename.', 'error');
        return;
    }
    selectedFileName = fileItem.querySelector('.file-name').textContent;
    selectedFilePath = fileItem.dataset.path;

    renameNewNameInput.value = selectedFileName;
    renameModal.classList.add('active');

    document.addEventListener('click', function handleRenameClick(e) {
        if (!renameModal.contains(e.target)) {
            renameModal.classList.remove('active');
            e.stopPropagation();
        }
        document.removeEventListener('click', handleRenameClick);
    });
}

function saveRenamedFile() {
    const newName = document.getElementById('renameNewName').value.trim();
    if (!newName || newName === selectedFileName) {
        showNotification('Please enter a new name', 'error');
        return;
    }
    
    fetch('/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            oldPath: selectedFilePath,
            newName: newName
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('File renamed successfully!', 'success');
            document.getElementById('renameModal').classList.remove('active');
            setTimeout(() => window.location.reload(), 1000);
        } else {
            showNotification('Error renaming file: ' + data.error, 'error');
        }
    })
    .catch(error => {
        showNotification('Error: ' + error.message, 'error');
    });
}

function deleteFile() {
    hideContextMenu();
    const deleteModal = document.getElementById('deleteModal');
    const deleteItemName = document.getElementById('deleteItemName');
    
    const fileItem = document.querySelector('.file-item.selected');
    if (!fileItem || selectedFilePaths.length > 1) {
        showNotification('Please select a single item to delete.', 'error');
        return;
    }
    selectedFileName = fileItem.querySelector('.file-name').textContent;
    selectedFilePath = fileItem.dataset.path;

    deleteItemName.textContent = selectedFileName;
    deleteModal.classList.add('active');
}

function confirmDelete() {
    const itemsToDelete = selectedFilePaths.length > 0 ? selectedFilePaths : [selectedFilePath];

    fetch('/delete-multiple', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paths: itemsToDelete })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('File(s) deleted successfully!', 'success');
            document.getElementById('deleteModal').classList.remove('active');
            setTimeout(() => window.location.reload(), 1000);
        } else {
            showNotification('Error deleting file(s): ' + data.error, 'error');
        }
    })
    .catch(error => {
        showNotification('Error: ' + error.message, 'error');
    });
}

// UPDATED: deleteSelectedFiles function now called from the new action button menu
function deleteSelectedFiles() {
    if (selectedFilePaths.length === 0) {
        showNotification('No files selected for deletion.', 'error');
        return;
    }
    hideActionButtonMenu();
    document.getElementById('headerActionsModal').classList.remove('active');
    const deleteModal = document.getElementById('deleteModal');
    const deleteItemName = document.getElementById('deleteItemName');
    
    if (selectedFilePaths.length === 1) {
        const item = document.querySelector('.file-item.selected .file-name').textContent;
        deleteItemName.textContent = item;
    } else {
        deleteItemName.textContent = `${selectedFilePaths.length} items`;
    }

    deleteModal.classList.add('active');
}

function copyPath() {
    hideContextMenu();
    if (selectedFilePaths.length !== 1) {
        showNotification('Please select a single file to copy its path.', 'error');
        return;
    }
    navigator.clipboard.writeText(selectedFilePaths[0]).then(() => {
        showNotification('Path copied to clipboard!', 'success');
    });
}

function downloadFile() {
    hideContextMenu();
    if (selectedFilePaths.length !== 1) {
        showNotification('Please select a single item to download.', 'error');
        return;
    }
    const filePath = selectedFilePaths[0];
    const fileName = document.querySelector(`[data-path="${filePath}"] .file-name`).textContent;
    const fileType = document.querySelector(`[data-path="${filePath}"]`).dataset.type;

    let downloadUrl = '';
    if (fileType === 'folder') {
        downloadUrl = `/download-folder?path=${encodeURIComponent(filePath)}`;
        showNotification(`Downloading folder '${fileName}' as a zip file...`, 'info');
    } else {
        downloadUrl = `/download?path=${encodeURIComponent(filePath)}`;
        showNotification(`Downloading file '${fileName}'...`, 'info');
    }

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = fileName; 
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// UPDATED: downloadSelectedFiles function now called from the new action button menu
function downloadSelectedFiles() {
    if (selectedFilePaths.length === 0) {
        showNotification('No files selected for download.', 'error');
        return;
    }
    hideActionButtonMenu();
    document.getElementById('headerActionsModal').classList.remove('active');
    
    const itemsToDownload = selectedFilePaths.map(filePath => {
        const itemElement = document.querySelector(`[data-path="${filePath}"]`);
        const fileName = itemElement.querySelector('.file-name').textContent;
        const isDirectory = itemElement.dataset.type === 'folder';
        return { path: filePath, name: fileName, isDirectory: isDirectory };
    });

    const downloadUrl = `/download-multiple?paths=${encodeURIComponent(JSON.stringify(selectedFilePaths))}`;
    showNotification(`Downloading ${selectedFilePaths.length} selected items as a zip file...`, 'info');

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = 'selected_files.zip'; 
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}


// Create modal functions
function showCreateModal() {
    document.getElementById('createModal').classList.add('active');
}

function closeCreateModal() {
    document.getElementById('createModal').classList.remove('active');
    document.getElementById('newItemName').value = '';
}

function createItem(type) {
    const name = document.getElementById('newItemName').value.trim();
    if (!name) {
        showNotification('Please enter a name', 'error');
        return;
    }
    
    const currentPath = getBasePath();
    
    fetch('/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: name,
            type: type,
            currentPath: currentPath
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} created successfully!`, 'success');
            closeCreateModal();
            
            if (type === 'file') {
                openFileEditor(`${currentPath}/${name}`, name);
            } else {
                setTimeout(() => window.location.reload(), 1000);
            }

        } else {
            showNotification('Error creating item: ' + data.error, 'error');
        }
    })
    .catch(error => {
        showNotification('Error: ' + error.message, 'error');
    });
}

function updateEditorState() {
    const codeEditor = document.getElementById('codeEditor');
    const saveButton = document.getElementById('saveFileButton');
    const editorLineCount = document.getElementById('editorLineCount');
    const unsavedChangesStar = document.getElementById('unsavedChangesStar');

    const lineCount = codeEditor.value.split('\n').length;
    editorLineCount.textContent = `Lines: ${lineCount}`;

    if (codeEditor.value !== originalContent) {
        saveButton.disabled = false;
        unsavedChangesStar.style.display = 'inline';
    } else {
        saveButton.disabled = true;
        unsavedChangesStar.style.display = 'none';
    }
}

function openFileEditor(filePath, fileName) {
    const editorModal = document.getElementById('editorModal');
    const editorTitle = document.getElementById('editorTitle');
    const codeEditor = document.getElementById('codeEditor');
    const saveButton = document.getElementById('saveFileButton');
    const unsavedChangesStar = document.getElementById('unsavedChangesStar');

    selectedFilePath = filePath;
    editorTitle.textContent = fileName;
    editorModal.classList.add('active');

    codeEditor.value = '';
    codeEditor.classList.add('loading');
    codeEditor.readOnly = true;

    adjustEditorHeightForKeyboard();

    fetch(`/file-content?path=${encodeURIComponent(filePath)}`)
        .then(response => response.json())
        .then(data => {
            codeEditor.classList.remove('loading');
            codeEditor.readOnly = false;

            if (data.content !== null && data.content !== undefined) {
                codeEditor.value = data.content;
                originalContent = data.content;
                
                updateEditorState();
            } else {
                codeEditor.value = 'Error loading file content.';
                showNotification('Error loading file: ' + data.error, 'error');
                saveButton.disabled = true;
            }
        })
        .catch(error => {
            codeEditor.classList.remove('loading');
            codeEditor.readOnly = false;
            codeEditor.value = 'Error loading file content.';
            showNotification('Network error: ' + error.message, 'error');
            saveButton.disabled = true;
        });
}

function closeFileEditor() {
    const editorModal = document.getElementById('editorModal');
    editorModal.classList.remove('active');
}

function saveFile() {
    const codeEditor = document.getElementById('codeEditor');
    const content = codeEditor.value;

    fetch('/save-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            filePath: selectedFilePath,
            content: content
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('File saved successfully!', 'success');
            originalContent = content;
            updateEditorState();
            closeFileEditor(); 
        } else {
            showNotification('Error saving file: ' + data.error, 'error');
        }
    })
    .catch(error => {
        showNotification('Error: ' + error.message, 'error');
    });
}

function clearEditor() {
    const codeEditor = document.getElementById('codeEditor');
    codeEditor.value = '';
    updateEditorState();
    showNotification('Editor cleared!', 'info');
}

function pasteContent() {
    const codeEditor = document.getElementById('codeEditor');
    codeEditor.focus();
    try {
        const success = document.execCommand('paste');
        if (success) {
            showNotification('Pasted content from clipboard!', 'info');
            updateEditorState();
        } else {
            throw new Error('execCommand failed');
        }
    } catch (err) {
        showNotification('Failed to paste content. Please use system paste options.', 'error');
    }
}

function selectAll() {
    const codeEditor = document.getElementById('codeEditor');
    codeEditor.select();
    showNotification('All content selected!', 'info');
}

function cutContent() {
    const codeEditor = document.getElementById('codeEditor');
    
    const tempTextarea = document.createElement('textarea');
    tempTextarea.value = codeEditor.value;
    tempTextarea.setAttribute('readonly', '');
    tempTextarea.style.position = 'absolute';
    tempTextarea.style.left = '-9999px';
    document.body.appendChild(tempTextarea);

    tempTextarea.select();
    tempTextarea.setSelectionRange(0, 99999);
    
    try {
        const success = document.execCommand('cut');
        if (success) {
            codeEditor.value = '';
            showNotification('Content cut to clipboard!', 'info');
            updateEditorState();
        } else {
            throw new Error('execCommand failed');
        }
    } catch (err) {
        showNotification('Failed to cut content. Please use system cut options.', 'error');
    } finally {
        document.body.removeChild(tempTextarea);
    }
}

function copyContent() {
    const codeEditor = document.getElementById('codeEditor');
    const content = codeEditor.value;
    
    const tempTextarea = document.createElement('textarea');
    tempTextarea.value = content;
    tempTextarea.setAttribute('readonly', '');
    tempTextarea.style.position = 'absolute';
    tempTextarea.style.left = '-9999px';
    document.body.appendChild(tempTextarea);
    
    tempTextarea.select();
    tempTextarea.setSelectionRange(0, 99999);
    
    try {
        const success = document.execCommand('copy');
        if (success) {
            showNotification('Content copied to clipboard!', 'success');
        } else {
            throw new Error('execCommand failed');
        }
    } catch (err) {
        showNotification('Failed to copy content. Please use system copy options.', 'error');
    } finally {
        document.body.removeChild(tempTextarea);
    }
}

function cancelEdit() {
    openFileEditor(selectedFilePath, document.getElementById('editorTitle').textContent);
    showNotification('Changes cancelled!', 'info');
}

function getShortNotificationText(message) {
  if (message.includes('File renamed successfully!')) return 'Renamed successfully!';
  if (message.includes('created successfully!')) return 'Created successfully!';
  if (message.includes('Path copied to clipboard!')) return 'Path copied!';
  if (message.includes('Content pasted from clipboard!')) return 'Content pasted!';
  if (message.includes('Content cut to clipboard!')) return 'Content cut!';
  if (message.includes('Content copied to clipboard!')) return 'Content copied!';
  if (message.includes('Export successful!')) return 'Export successful!';
  if (message.includes('Repository files imported')) return 'Repo imported!';
  if (message.includes('Files imported successfully from ZIP!')) return 'Files imported!';
  if (message.includes('File saved successfully!')) return 'Saved!';
  return message;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const shortMessage = getShortNotificationText(message);
    notification.className = `notification ${type}`;
    notification.innerHTML = `<span>${shortMessage}</span>`;
    
    if (!document.querySelector('.notification-styles')) {
        const style = document.createElement('style');
        style.className = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                padding: 0.5rem 0.8rem;
                font-size: 0.8rem;
                border-radius: 10px;
                color: white;
                display: flex;
                align-items: center;
                gap: 0.6rem;
                z-index: 10000;
                animation: fadeIn 0.3s ease;
                background: rgba(0, 0, 0, 0.6);
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255, 255, 255, 0.2);
                box-shadow: 0 4px 30px rgba(0,0,0,0.1);
            }
            .notification.success { background: rgba(40, 167, 69, 0.8); }
            .notification.error { background: rgba(220, 53, 69, 0.8); }
            .notification.info { background: rgba(23, 162, 184, 0.8); }
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(-20px) translateX(-50%); }
                to { opacity: 1; transform: translateY(0) translateX(-50%); }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function showImportModal() {
    document.getElementById('importModal').classList.add('active');
    document.getElementById('headerActionsModal').classList.remove('active');
}

function closeImportModal() {
    document.getElementById('importModal').classList.remove('active');
    document.getElementById('repoUrlInput').value = '';
}

function importFromGit() {
    const repoUrl = document.getElementById('repoUrlInput').value.trim();
    if (!repoUrl) {
        showNotification('Please enter a valid GitHub repository URL.', 'error');
        return;
    }
    
    closeImportModal();
    showProcessingModal();
    
    const currentPath = getBasePath();
    
    fetch('/import-git', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            repoUrl: repoUrl,
            currentPath: currentPath
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification(data.message, 'success');
            setTimeout(() => window.location.reload(), 2000);
        } else {
            showNotification('Error importing from Git: ' + data.error, 'error');
        }
    })
    .catch(error => {
        hideProcessingModal();
        showNotification('Error during upload: ' + error.message, 'error');
    });
}

function showUploadModal() {
    document.getElementById('uploadModal').classList.add('active');
    document.getElementById('headerActionsModal').classList.remove('active');
}

function closeUploadModal() {
    document.getElementById('uploadModal').classList.remove('active');
    document.getElementById('zipFileInput').value = ''; 
}

function uploadZip() {
    const fileInput = document.getElementById('zipFileInput');
    if (fileInput.files.length === 0) {
        showNotification('Please select a zip file to upload.', 'error');
        return;
    }
    
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('zipFile', file);
    formData.append('currentPath', getBasePath());
    
    closeUploadModal();
    showProcessingModal();

    try {
        fetch('/import-zip', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Server returned an error: ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            hideProcessingModal();
            if (data.success) {
                showNotification(data.message, 'success');
                setTimeout(() => window.location.reload(), 2000);
            } else {
                showNotification('Error uploading zip: ' + data.error, 'error');
            }
        })
        .catch(error => {
            hideProcessingModal();
            showNotification('Error during upload: ' + error.message, 'error');
        });
    } catch (error) {
        hideProcessingModal();
        showNotification('Client-side error: ' + error.message, 'error');
    }
}

function showUploadFilesModal() {
    document.getElementById('uploadFilesModal').classList.add('active');
    document.getElementById('headerActionsModal').classList.remove('active');
}

function closeUploadFilesModal() {
    document.getElementById('uploadFilesModal').classList.remove('active');
    document.getElementById('filesInput').value = '';
}

function uploadMultipleFiles() {
    const fileInput = document.getElementById('filesInput');
    if (fileInput.files.length === 0) {
        showNotification('Please select at least one file to upload.', 'error');
        return;
    }
    
    const formData = new FormData();
    for (const file of fileInput.files) {
        formData.append('files', file);
    }
    formData.append('currentPath', getBasePath());
    
    closeUploadFilesModal();
    showProcessingModal();

    fetch('/upload-files', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        hideProcessingModal();
        if (data.success) {
            showNotification(data.message, 'success');
            setTimeout(() => window.location.reload(), 2000);
        } else {
            showNotification('Error uploading files: ' + data.error, 'error');
        }
    })
    .catch(error => {
        hideProcessingModal();
        showNotification('Error during file upload: ' + error.message, 'error');
    });
}

function exportToZip() {
    const currentPath = getBasePath();
    showProcessingModal();

    fetch('/export-zip', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ currentPath: currentPath })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Server returned an error: ' + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        hideProcessingModal();
        if (data.success) {
            showNotification(`Export successful! File size: ${data.fileSize}. Your download will begin shortly.`, 'success');
            window.location.href = `/download-zip-file?path=${encodeURIComponent(data.filePath)}`;
        } else {
            showNotification('Export failed: ' + data.error, 'error');
        }
    })
    .catch(error => {
        hideProcessingModal();
        showNotification('An error occurred during export: ' + error.message, 'error');
    });
}

function showProcessingModal() {
    document.getElementById('processingModal').classList.add('active');
}

function hideProcessingModal() {
    document.getElementById('processingModal').classList.remove('active');
}

function showHeaderActionsModal() {
    document.getElementById('headerActionsModal').classList.add('active');
    
    // REMOVED: Delete and Download buttons from here
}

function showTerminalModal() {
    document.getElementById('terminalModal').classList.add('active');
    document.getElementById('headerActionsModal').classList.remove('active');
    if (!terminalWs || terminalWs.readyState === WebSocket.CLOSED) {
        initializeTerminal();
    }
}

function closeTerminalModal() {
    document.getElementById('terminalModal').classList.remove('active');
}

function initializeTerminal() {
    const terminalOutput = document.getElementById('terminalOutput');
    const terminalInput = document.getElementById('terminalInput');
    const terminalPrompt = document.getElementById('terminalPrompt');

    terminalOutput.innerHTML = '';
    terminalWs = new WebSocket(`ws://${window.location.host}/terminal`);

    terminalWs.onopen = () => {
        terminalOutput.innerHTML += '<span class="terminal-info-text">Connected to server. Ready to execute commands.</span>\n';
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
        terminalInput.focus();
        terminalPrompt.textContent = getBasePath() + '$ ';
    };

    terminalWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const terminalOutput = document.getElementById('terminalOutput');
        
        let outputText = data.output;
        
        if (data.output.includes('npm install')) {
          outputText = '<span class="terminal-loading">npm install...</span>\n';
        } else if (data.output.includes('node server.js')) {
          outputText = '<span class="terminal-loading">Starting server...</span>\n';
        } else if (data.output.includes('nodemon server.js')) {
          outputText = '<span class="terminal-loading">Starting nodemon...</span>\n';
        }

        terminalOutput.innerHTML += outputText.replace(/\n/g, '<br>').replace(/\r/g, '');
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    };

    terminalWs.onclose = () => {
        terminalOutput.innerHTML += '\n<span class="terminal-error-text">Connection lost. Please reopen the terminal.</span>\n';
        terminalOutput.scrollTop = terminalOutput.scrollHeight;
    };

    terminalWs.onerror = (error) => {
        console.error('Terminal WebSocket error:', error);
        showNotification('Terminal connection error.', 'error');
    };
}

function adjustEditorHeightForKeyboard() {
    if (window.innerWidth <= 768) {
        const editor = document.getElementById('codeEditor');
        const headerHeight = document.querySelector('.editor-header').offsetHeight;
        const footerHeight = document.querySelector('.editor-footer').offsetHeight;
        const totalNonContentHeight = headerHeight + footerHeight;
        
        const extraSpace = 10;
        const newHeight = window.innerHeight - totalNonContentHeight - extraSpace;
        
        editor.style.height = `${newHeight}px`;
        editor.style.maxHeight = `${newHeight}px`;
    } else {
        const editor = document.getElementById('codeEditor');
        editor.style.height = ''; 
        editor.style.maxHeight = ''; 
    }
}

function adjustFileGridHeight() {
    if (window.innerWidth <= 768) {
        const mainContent = document.querySelector('.main-content');
        const header = document.querySelector('.app-header');
        const breadcrumb = document.querySelector('.breadcrumb');
        const footer = document.querySelector('.app-footer');
        
        if (mainContent && header && breadcrumb && footer) {
            const totalNonContentHeight = header.offsetHeight + breadcrumb.offsetHeight + footer.offsetHeight;
            const newHeight = window.innerHeight - totalNonContentHeight - 20;
            mainContent.style.maxHeight = `${newHeight}px`;
        }
    } else {
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            mainContent.style.maxHeight = 'none';
        }
    }
}

// UPDATED: clearSelection function now hides the action button
function clearSelection() {
    document.querySelectorAll('.file-item').forEach(el => el.classList.remove('selected'));
    selectedFilePaths = [];
    isMultiSelectMode = false;
    toggleMultiSelectButtons();
}

function updateFileSelection(item, isCtrlPressed) {
    // NEW: Check if the item is the parent directory. If so, do not select.
    if (item.classList.contains('parent-dir-item')) {
        return;
    }
    
    const filePath = item.dataset.path;
    const isSelected = item.classList.contains('selected');

    if (isMultiSelectMode || isCtrlPressed) {
        if (isSelected) {
            item.classList.remove('selected');
            selectedFilePaths = selectedFilePaths.filter(path => path !== filePath);
            
            if (selectedFilePaths.length === 0) {
                isMultiSelectMode = false;
                showNotification('Multi-select mode deactivated.', 'info');
                toggleMultiSelectButtons();
            }
        } else {
            item.classList.add('selected');
            selectedFilePaths.push(filePath);
            isMultiSelectMode = true;
            toggleMultiSelectButtons();
        }
    } else {
        clearSelection();
        item.classList.add('selected');
        selectedFilePaths.push(filePath);
        isMultiSelectMode = true;
        toggleMultiSelectButtons();
    }
}

// UPDATED: Function to show/hide the floating action button with animations
function toggleMultiSelectButtons() {
    const fabContainer = document.getElementById('multiSelectActions');
    if (isMultiSelectMode) {
        fabContainer.classList.remove('hidden');
    } else {
        fabContainer.classList.add('hidden');
        hideActionButtonMenu();
    }
}

// UPDATED: Function to toggle the action button menu with animations
function toggleActionButtonMenu() {
    const menu = document.getElementById('multiSelectMenu');
    const fabButton = document.getElementById('multiSelectFab');
    isActionButtonMenuOpen = !isActionButtonMenuOpen;

    if (isActionButtonMenuOpen) {
        menu.classList.add('active');
        fabButton.classList.add('fab-button-active');
        const menuItems = menu.querySelectorAll('.action-menu-item');
        menuItems.forEach((item, index) => {
            // Delay based on index for a staggered effect
            item.style.setProperty('--delay', `${index * 0.05}s`);
            item.classList.add('animate-in');
        });
    } else {
        menu.classList.remove('active');
        fabButton.classList.remove('fab-button-active');
        const menuItems = menu.querySelectorAll('.action-menu-item');
        menuItems.forEach(item => {
            item.classList.remove('animate-in');
        });
    }
}

// NEW: Function to hide the action button menu
function hideActionButtonMenu() {
    const menu = document.getElementById('multiSelectMenu');
    const fabButton = document.getElementById('multiSelectFab');
    isActionButtonMenuOpen = false;
    menu.classList.remove('active');
    fabButton.classList.remove('fab-button-active');
    const menuItems = menu.querySelectorAll('.action-menu-item');
    menuItems.forEach(item => {
        item.classList.remove('animate-in');
    });
}

// FIX: `selectAllFiles` function ab sirf visible files ko select karegi
function selectAllFiles() {
    hideActionButtonMenu();
    clearSelection(); // Existing selections ko clear karega
    
    const fileItems = document.querySelectorAll('.file-item');
    let visibleItemsCount = 0;
    
    fileItems.forEach(item => {
        // Parent directory ko ignore karega
        if (item.classList.contains('parent-dir-item')) {
            return;
        }

        // Sirf un items ko select karega jo `display: flex` ya `display: block` hain
        const computedStyle = window.getComputedStyle(item);
        if (computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden') {
            item.classList.add('selected');
            selectedFilePaths.push(item.dataset.path);
            visibleItemsCount++;
        }
    });

    if (visibleItemsCount > 0) {
        isMultiSelectMode = true;
        toggleMultiSelectButtons();
        showNotification(`Selected all ${visibleItemsCount} visible files!`, 'info');
    } else {
        isMultiSelectMode = false;
        toggleMultiSelectButtons();
        showNotification('No files to select.', 'info');
    }
}

// NEW: Function to set copy/move state and store paths
function setCopyMoveState(actionType) {
    hideContextMenu();
    hideActionButtonMenu();
    
    if (selectedFilePaths.length === 0) {
        showNotification('Please select at least one item to ' + actionType + '.', 'error');
        return;
    }
    
    // `localStorage` mein state store karein
    localStorage.setItem('fileManagerAction', JSON.stringify({
        type: actionType,
        paths: selectedFilePaths
    }));
    
    // Has items to paste state ko update karein aur paste buttons show karein
    hasItemsToPaste = true;
    togglePasteButtons();

    // Notification show karein lekin selection ko clear na karein
    showNotification(`${selectedFilePaths.length} items selected to ${actionType}. Navigate to destination and paste.`, 'success');
}

// NEW: Function to show paste/move modal
function showPasteModal() {
    const pasteState = JSON.parse(localStorage.getItem('fileManagerAction'));
    if (!pasteState || pasteState.paths.length === 0) {
        showNotification('No items to paste. Please select items first.', 'error');
        return;
    }
    
    const pasteModal = document.getElementById('pasteModal');
    const pasteModalTitle = document.getElementById('pasteModalTitle');
    const pasteModalStatus = document.getElementById('pasteModalStatus');
    
    if (pasteState.type === 'copy') {
        pasteModalTitle.textContent = 'Copying...';
        pasteModalStatus.textContent = `Copying ${pasteState.paths.length} items to ` + getBasePath();
    } else if (pasteState.type === 'move') {
        pasteModalTitle.textContent = 'Moving...';
        pasteModalStatus.textContent = `Moving ${pasteState.paths.length} items to ` + getBasePath();
    }
    
    pasteModal.classList.add('active');
    performPaste(pasteState);
}

// NEW: Function to perform paste operation
function performPaste(pasteState) {
    const { type, paths } = pasteState;
    const destPath = getBasePath();
    
    fetch(`/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            sourcePaths: paths,
            destPath: destPath
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            hideProcessingModal();
            showNotification(data.message, 'success');
            localStorage.removeItem('fileManagerAction');
            // FIX: Selection ko ab yahan clear kiya gaya hai, jab operation successfully complete ho jaye.
            clearSelection();
            togglePasteButtons();
            setTimeout(() => window.location.reload(), 1000);
        } else {
            hideProcessingModal();
            showNotification('Error: ' + data.error, 'error');
        }
    })
    .catch(error => {
        hideProcessingModal();
        showNotification('Error: ' + error.message, 'error');
    });
}

// NEW: Function to handle the paste operation when user clicks paste button
function handlePasteButtonClick() {
    showPasteModal();
}

// NEW: Function to check for items to paste on page load
function checkPasteStatus() {
    const pasteState = localStorage.getItem('fileManagerAction');
    if (pasteState) {
        hasItemsToPaste = true;
    } else {
        hasItemsToPaste = false;
    }
}

// NEW: Function to toggle paste buttons in the header
function togglePasteButtons() {
    const pasteButtonContainer = document.getElementById('pasteActionButtons');
    if (hasItemsToPaste) {
        pasteButtonContainer.classList.remove('hidden');
    } else {
        pasteButtonContainer.classList.add('hidden');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // NEW: Check paste status on page load and update UI
    checkPasteStatus();
    togglePasteButtons();

    document.querySelectorAll('.file-item').forEach(item => {
        // Desktop multi-select with Ctrl/Cmd key
        item.addEventListener('click', (event) => {
            // FIX: Agar context menu open hai, toh click ko ignore karo aur menu band karo
            if (activeContextMenu) {
                event.preventDefault();
                event.stopPropagation();
                hideContextMenu();
                return;
            }

            event.preventDefault();
            if (event.target.closest('.file-actions')) {
                return;
            }

            const path = item.dataset.path;
            const type = item.dataset.type;
            const isCtrlPressed = event.ctrlKey || event.metaKey;

            if (isMultiSelectMode || isCtrlPressed) {
                updateFileSelection(item, isCtrlPressed);
            } else if (type === 'folder') {
                navigateToPath(path);
            } else {
                openFileEditor(path, item.querySelector('.file-name').textContent);
            }
        });

        // Mobile long-press for multi-select
        item.addEventListener('touchstart', (event) => {
            event.stopPropagation();
            isLongPress = false; 
            isScrolling = false;
            touchStartX = event.touches[0].clientX;
            touchStartY = event.touches[0].clientY;
            
            touchTimeout = setTimeout(() => {
                // NEW: Long press par bhi parent-dir-item ko ignore karo
                if (!isMultiSelectMode && !item.classList.contains('parent-dir-item')) {
                    clearSelection();
                    item.classList.add('selected');
                    selectedFilePaths.push(item.dataset.path);
                    isMultiSelectMode = true;
                    isLongPress = true; 
                    showNotification('Multi-select mode activated!', 'info');
                    toggleMultiSelectButtons();
                }
            }, longPressThreshold);
        });

        item.addEventListener('touchmove', (event) => {
            const currentX = event.touches[0].clientX;
            const currentY = event.touches[0].clientY;
            const deltaX = Math.abs(currentX - touchStartX);
            const deltaY = Math.abs(currentY - touchStartY);
            
            if (deltaX > 10 || deltaY > 10) {
                clearTimeout(touchTimeout);
                isScrolling = true;
            }
        });

        item.addEventListener('touchend', (event) => {
            clearTimeout(touchTimeout);
            if (!isScrolling) {
                if (isLongPress) {
                    isLongPress = false;
                    event.preventDefault();
                } else if (isMultiSelectMode && !event.target.closest('.file-actions')) {
                    event.preventDefault();
                    // NEW: Yahan bhi parent-dir-item ko ignore karo
                    if (!item.classList.contains('parent-dir-item')) {
                        updateFileSelection(item, true);
                    }
                }
            }
            isScrolling = false;
            isLongPress = false;
        });

        item.addEventListener('dblclick', (event) => {
            const path = item.dataset.path;
            const type = item.dataset.type;
            if (type === 'folder') {
                navigateToPath(path);
            } else {
                openFileEditor(path, item.querySelector('.file-name').textContent);
            }
        });

        item.addEventListener('mouseenter', () => {
            item.style.transform = 'translateY(-5px) scale(1.02)';
            item.style.boxShadow = '8px 8px 16px rgba(0, 0, 0, 0.1), -8px -8px 16px rgba(255, 255, 255, 0.5)';
        });
        item.addEventListener('mouseleave', () => {
            item.style.transform = '';
            item.style.boxShadow = 'var(--neumorphism-shadow)';
        });
    });

    document.getElementById('fileGrid').addEventListener('click', (event) => {
        if (event.target.id === 'fileGrid' && isMultiSelectMode) {
            clearSelection();
            showNotification('Multi-select mode deactivated.', 'info');
        }
    });

    document.querySelectorAll('.file-actions button').forEach(button => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            const item = event.target.closest('.file-item');
            const path = item.dataset.path;
            const name = item.querySelector('.file-name').textContent;
            showContextMenu(event, path, name);
        });
    });

    // NEW: Action button and menu event listeners
    const multiSelectFab = document.getElementById('multiSelectActions');
    const multiSelectMenu = document.getElementById('multiSelectMenu');
    document.getElementById('multiSelectFab').addEventListener('click', toggleActionButtonMenu);
    
    document.getElementById('selectAllFilesButton').addEventListener('click', selectAllFiles);
    document.getElementById('downloadSelectedButton').addEventListener('click', downloadSelectedFiles);
    document.getElementById('deleteSelectedButton').addEventListener('click', deleteSelectedFiles);
    document.getElementById('cancelSelectionButton').addEventListener('click', clearSelection);
    // NEW: Copy/Move listeners for multi-select
    document.getElementById('copySelectedButton').addEventListener('click', () => setCopyMoveState('copy'));
    document.getElementById('moveSelectedButton').addEventListener('click', () => setCopyMoveState('move'));

    // NEW: Copy/Move listeners for context menu
    document.getElementById('copyMenuItem').addEventListener('click', () => setCopyMoveState('copy'));
    document.getElementById('moveMenuItem').addEventListener('click', () => setCopyMoveState('move'));
    
    // NEW: Paste button for pasting
    const pasteButton = document.getElementById('pasteButton');
    if (pasteButton) {
        pasteButton.addEventListener('click', handlePasteButtonClick);
    }

    // NEW: Cancel Paste button
    const cancelPasteButton = document.getElementById('cancelPasteButton');
    if (cancelPasteButton) {
        cancelPasteButton.addEventListener('click', () => {
            localStorage.removeItem('fileManagerAction');
            hasItemsToPaste = false;
            togglePasteButtons();
            clearSelection();
            showNotification('Paste operation cancelled.', 'info');
        });
    }
    
    document.getElementById('renameMenuItem').addEventListener('click', renameFile);
    document.getElementById('deleteMenuItem').addEventListener('click', deleteFile);
    document.getElementById('copyPathMenuItem').addEventListener('click', copyPath);
    document.getElementById('downloadMenuItem').addEventListener('click', downloadFile);

    document.getElementById('closeRenameModal').addEventListener('click', () => document.getElementById('renameModal').classList.remove('active'));
    document.getElementById('cancelRenameButton').addEventListener('click', () => document.getElementById('renameModal').classList.remove('active'));
    document.getElementById('saveRenameButton').addEventListener('click', saveRenamedFile);

    document.getElementById('closeDeleteModal').addEventListener('click', () => document.getElementById('deleteModal').classList.remove('active'));
    document.getElementById('cancelDeleteButton').addEventListener('click', () => document.getElementById('deleteModal').classList.remove('active'));
    document.getElementById('confirmDeleteButton').addEventListener('click', confirmDelete);

    document.querySelectorAll('.breadcrumb-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navigateToPath(item.dataset.path);
        });
    });

    document.querySelectorAll('.quick-link').forEach(item => {
        item.addEventListener('click', () => {
            const path = item.dataset.path;
            if (path) {
                navigateToPath(path);
            }
        });
        item.addEventListener('mouseenter', () => {
            item.style.transform = 'scale(1.05)';
        });
        item.addEventListener('mouseleave', () => {
            item.style.transform = '';
        });
    });

    document.querySelectorAll('.filter-item').forEach(item => {
        item.addEventListener('click', () => {
            filterFiles(item.dataset.filter);
        });
        item.addEventListener('mouseenter', () => {
            item.style.transform = 'translateX(6px)';
        });
        item.addEventListener('mouseleave', () => {
            item.style.transform = '';
        });
    });
    
    const sidebarToggleBtn = document.getElementById('sidebarToggle');
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', toggleSidebar);
    }
    
    const newButton = document.getElementById('newButton');
    if (newButton) {
        newButton.addEventListener('click', showCreateModal);
    }

    const showActionsBtn = document.getElementById('showActionsBtn');
    if (showActionsBtn) {
        showActionsBtn.addEventListener('click', showHeaderActionsModal);
    }

    const importGitButton = document.getElementById('importGitButton');
    if (importGitButton) {
        importGitButton.addEventListener('click', showImportModal);
    }
    
    const uploadButton = document.getElementById('uploadButton');
    if(uploadButton) {
        uploadButton.addEventListener('click', showUploadModal);
    }

    const uploadFilesBtn = document.getElementById('uploadFilesBtn');
    if(uploadFilesBtn) {
        uploadFilesBtn.addEventListener('click', showUploadFilesModal);
    }

    const exportButton = document.getElementById('exportButton');
    if(exportButton) {
        exportButton.addEventListener('click', exportToZip);
    }

    // REMOVED: Delete Selected and Download Selected button listeners from here
    
    const closeCreateModalBtn = document.getElementById('closeCreateModal');
    if (closeCreateModalBtn) {
        closeCreateModalBtn.addEventListener('click', closeCreateModal);
    }
    
    const closeImportModalBtn = document.getElementById('closeImportModal');
    if(closeImportModalBtn) {
        closeImportModalBtn.addEventListener('click', closeImportModal);
    }
    const cancelImportButton = document.getElementById('cancelImportButton');
    if(cancelImportButton) {
        cancelImportButton.addEventListener('click', closeImportModal);
    }
    const importRepoButton = document.getElementById('importRepoButton');
    if(importRepoButton) {
        importRepoButton.addEventListener('click', importFromGit);
    }

    const closeUploadModalBtn = document.getElementById('closeUploadModal');
    if(closeUploadModalBtn) {
        closeUploadModalBtn.addEventListener('click', closeUploadModal);
    }
    const cancelUploadButton = document.getElementById('cancelUploadButton');
    if(cancelUploadButton) {
        cancelUploadButton.addEventListener('click', closeUploadModal);
    }
    const uploadZipButton = document.getElementById('uploadZipButton');
    if(uploadZipButton) {
        uploadZipButton.addEventListener('click', uploadZip);
    }

    const closeUploadFilesModalBtn = document.getElementById('closeUploadFilesModal');
    if(closeUploadFilesModalBtn) {
        closeUploadFilesModalBtn.addEventListener('click', closeUploadFilesModal);
    }
    const cancelUploadFilesButton = document.getElementById('cancelUploadFilesButton');
    if(cancelUploadFilesButton) {
        cancelUploadFilesButton.addEventListener('click', closeUploadFilesModal);
    }
    const uploadFilesButton = document.getElementById('uploadFilesButton');
    if(uploadFilesButton) {
        uploadFilesButton.addEventListener('click', uploadMultipleFiles);
    }

    const saveFileButton = document.getElementById('saveFileButton');
    if (saveFileButton) {
        saveFileButton.addEventListener('click', saveFile);
    }

    const closeEditorButton = document.getElementById('closeEditorButton');
    if (closeEditorButton) {
        closeEditorButton.addEventListener('click', closeFileEditor);
    }

    const clearAllButton = document.getElementById('clearAllButton');
    if (clearAllButton) {
        clearAllButton.addEventListener('click', clearEditor);
    }

    const selectAllButton = document.getElementById('selectAllButton');
    if (selectAllButton) {
        selectAllButton.addEventListener('click', selectAll);
    }

    const copyButton = document.getElementById('copyButton');
    if (copyButton) {
        copyButton.addEventListener('click', copyContent);
    }

    const cutButton = document.getElementById('cutButton');
    if (cutButton) {
        cutButton.addEventListener('click', cutContent);
    }

    const cancelButton = document.getElementById('cancelButton');
    if (cancelButton) {
        cancelButton.addEventListener('click', closeFileEditor);
    }

    const createFileButton = document.getElementById('createFileButton');
    if (createFileButton) {
        createFileButton.addEventListener('click', () => createItem('file'));
    }

    const createFolderButton = document.getElementById('createFolderButton');
    if (createFolderButton) {
        createFolderButton.addEventListener('click', () => createItem('folder'));
    }
    const closeHeaderActionsModalBtn = document.getElementById('closeHeaderActionsModal');
    if (closeHeaderActionsModalBtn) {
        closeHeaderActionsModalBtn.addEventListener('click', () => {
            document.getElementById('headerActionsModal').classList.remove('active');
        });
    }

    const openTerminalButton = document.getElementById('openTerminalButton');
    if (openTerminalButton) {
        openTerminalButton.addEventListener('click', showTerminalModal);
    }

    const closeTerminalModalBtn = document.getElementById('closeTerminalModal');
    if (closeTerminalModalBtn) {
        closeTerminalModalBtn.addEventListener('click', closeTerminalModal);
    }

    const terminalInput = document.getElementById('terminalInput');
    const terminalOutput = document.getElementById('terminalOutput');
    const terminalPrompt = document.getElementById('terminalPrompt');

    function updateTerminalPrompt() {
        terminalPrompt.textContent = getBasePath() + '$ ';
    }
    updateTerminalPrompt();

    terminalInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const command = terminalInput.value.trim();
            if (command) {
                if (terminalWs && terminalWs.readyState === WebSocket.OPEN) {
                    terminalWs.send(JSON.stringify({
                        command: command,
                        currentPath: getBasePath(),
                        type: 'cmd'
                    }));
                } else {
                    terminalOutput.innerHTML += '\n<span class="terminal-error-text">Connection is not open. Please try again.</span>\n';
                    terminalOutput.scrollTop = terminalOutput.scrollHeight;
                }
                terminalInput.value = '';
            }
        }
    });

    const terminalCtrlCButton = document.getElementById('terminalCtrlCButton');
    if (terminalCtrlCButton) {
        terminalCtrlCButton.addEventListener('click', () => {
            showNotification('This function is not available when running multiple processes simultaneously.','error');
        });
    }

    document.addEventListener('click', function(event) {
        const sidebar = document.getElementById('sidebar');
        const sidebarToggleBtn = document.getElementById('sidebarToggle');
        
        if (!sidebar.contains(event.target) && !sidebarToggleBtn.contains(event.target) && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
        }

        // NEW: Hide the action menu if clicked outside
        const actionButtonContainer = document.getElementById('multiSelectActions');
        if (actionButtonContainer && !actionButtonContainer.contains(event.target)) {
            hideActionButtonMenu();
        }
    });

    const closeSidebarButton = document.getElementById('closeSidebarButton');
    if (closeSidebarButton) {
        closeSidebarButton.addEventListener('click', toggleSidebar);
    }
    
    const fileCount = document.querySelectorAll('.file-item').length;
    const fileCountElement = document.getElementById('fileCount');
    if (fileCountElement) {
        fileCountElement.textContent = fileCount;
    }
    
    const currentPathDisplay = document.getElementById('currentPathDisplay');
    if (currentPathDisplay) {
        currentPathDisplay.textContent = getBasePath();
    }
    
    const codeEditor = document.getElementById('codeEditor');
    if (codeEditor) {
        codeEditor.addEventListener('input', updateEditorState);
    }

    window.addEventListener('resize', () => {
        adjustEditorHeightForKeyboard();
        adjustFileGridHeight();
    });

    adjustFileGridHeight();
});