let currentPath = '/';
let hideHidden = true;
let selectedFilePath = '';
let selectedFileName = '';
let selectedFileType = ''; // New variable to store the type (file/folder)
let originalContent = ''; // Variable to store original file content
let activeContextMenu = null; // Track the currently active context menu
let terminalWs; // WebSocket connection for the terminal

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
            shouldShow = fileName.match(/\.(js|html|css|json|py|java|cpp|c|php|rb|go)$/);
            if (type === 'images') {
                shouldShow = fileName.match(/\.(jpg|jpeg|png|gif|svg|bmp|webp)$/);
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
    
    // Close any existing context menu
    if (activeContextMenu) {
        hideContextMenu(activeContextMenu);
    }
    
    event.preventDefault();
    event.stopPropagation();
    
    selectedFilePath = filePath;
    selectedFileName = fileName;
    selectedFileType = event.currentTarget.closest('.file-item').dataset.type;
    
    const contextMenu = document.getElementById('contextMenu');
    if (contextMenu) {
        // Get dimensions
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const menuWidth = contextMenu.offsetWidth;
        const menuHeight = contextMenu.offsetHeight;
        let leftPosition = event.pageX;
        let topPosition = event.pageY;

        // Adjust left position
        if (leftPosition + menuWidth > windowWidth - 20) {
            leftPosition = windowWidth - menuWidth - 20;
        }
        // Adjust top position
        if (topPosition + menuHeight > windowHeight - 20) {
            topPosition = windowHeight - menuHeight - 20;
        }
        
        // Ensure menu is not off-screen to the left or top
        if (leftPosition < 20) {
            leftPosition = 20;
        }
        if (topPosition < 20) {
            topPosition = 20;
        }
        
        contextMenu.style.left = leftPosition + 'px';
        contextMenu.style.top = topPosition + 'px';
        contextMenu.classList.add('active');
        activeContextMenu = contextMenu; // Set the currently active menu
    }
    
    // Hide menu when clicking elsewhere
    document.addEventListener('click', hideContextMenu, { once: true });
}

function hideContextMenu() {
    const contextMenu = document.getElementById('contextMenu');
    if (contextMenu) {
        contextMenu.classList.remove('active');
        activeContextMenu = null; // Clear the active menu reference
    }
}

function renameFile() {
    hideContextMenu();
    const renameModal = document.getElementById('renameModal');
    const renameNewNameInput = document.getElementById('renameNewName');
    
    renameNewNameInput.value = selectedFileName;
    renameModal.classList.add('active');
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
    
    deleteItemName.textContent = selectedFileName;
    deleteModal.classList.add('active');
}

function confirmDelete() {
    fetch('/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: selectedFilePath })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('File deleted successfully!', 'success');
            document.getElementById('deleteModal').classList.remove('active');
            setTimeout(() => window.location.reload(), 1000);
        } else {
            showNotification('Error deleting file: ' + data.error, 'error');
        }
    })
    .catch(error => {
        showNotification('Error: ' + error.message, 'error');
    });
}

function copyPath() {
    hideContextMenu();
    navigator.clipboard.writeText(selectedFilePath).then(() => {
        showNotification('Path copied to clipboard!', 'success');
    });
}

// New Download function
function downloadFile() {
    hideContextMenu();
    if (!selectedFilePath) {
        showNotification('No item selected to download.', 'error');
        return;
    }
    
    let downloadUrl = '';
    if (selectedFileType === 'folder') {
        downloadUrl = `/download-folder?path=${encodeURIComponent(selectedFilePath)}`;
        showNotification(`Downloading folder '${selectedFileName}' as a zip file...`, 'info');
    } else {
        downloadUrl = `/download?path=${encodeURIComponent(selectedFilePath)}`;
        showNotification(`Downloading file '${selectedFileName}'...`, 'info');
    }

    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = selectedFileName; 
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

// Editor modal functions
function openFileEditor(filePath, fileName) {
    const editorModal = document.getElementById('editorModal');
    const editorTitle = document.getElementById('editorTitle');
    const codeEditor = document.getElementById('codeEditor');
    const saveButton = document.getElementById('saveFileButton');
    const editorLineCount = document.getElementById('editorLineCount');
    const unsavedChangesStar = document.getElementById('unsavedChangesStar');

    selectedFilePath = filePath;
    editorTitle.textContent = fileName;
    editorModal.classList.add('active');
    unsavedChangesStar.style.display = 'none';

    codeEditor.value = '';
    codeEditor.classList.add('loading');
    codeEditor.readOnly = true;
    editorLineCount.textContent = 'Lines: 0';

    fetch(`/file-content?path=${encodeURIComponent(filePath)}`)
        .then(response => response.json())
        .then(data => {
            codeEditor.classList.remove('loading');
            codeEditor.readOnly = false;

            if (data.content !== null && data.content !== undefined) {
                if (data.content.trim() === '') {
                    codeEditor.value = 'This file is empty. You can start typing to add content.';
                    originalContent = '';
                    editorLineCount.textContent = 'Lines: 1';
                } else {
                    codeEditor.value = data.content;
                    originalContent = data.content;
                    editorLineCount.textContent = `Lines: ${data.content.split('\n').length}`;
                }
                saveButton.disabled = true;
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
            document.getElementById('saveFileButton').disabled = true;
            document.getElementById('unsavedChangesStar').style.display = 'none';
            closeFileEditor();
        } else {
            showNotification('Error saving file: ' + data.error, 'error');
        }
    })
    .catch(error => {
        showNotification('Error: ' + error.message, 'error');
    });
}

// Editor specific functions
function clearEditor() {
    const codeEditor = document.getElementById('codeEditor');
    codeEditor.value = '';
    const saveButton = document.getElementById('saveFileButton');
    saveButton.disabled = codeEditor.value === originalContent;
    document.getElementById('unsavedChangesStar').style.display = 'none';
}

function pasteContent() {
    const codeEditor = document.getElementById('codeEditor');
    const saveButton = document.getElementById('saveFileButton');
    codeEditor.focus(); // Paste ke liye focus zaroori hai
    try {
        const success = document.execCommand('paste');
        if (success) {
            showNotification('Pasted content from clipboard!', 'info');
        } else {
            throw new Error('execCommand failed');
        }
        saveButton.disabled = codeEditor.value === originalContent;
        if (codeEditor.value !== originalContent) {
            document.getElementById('unsavedChangesStar').style.display = 'inline';
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
    const saveButton = document.getElementById('saveFileButton');
    
    // Create a temporary textarea to perform the cut operation without affecting the main editor's selection/focus
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
            // Manual cut operation on the main editor
            codeEditor.value = '';
            showNotification('Content cut to clipboard!', 'info');
            saveButton.disabled = codeEditor.value === originalContent;
            if (codeEditor.value !== originalContent) {
                document.getElementById('unsavedChangesStar').style.display = 'inline';
            }
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


// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'}"></i>
        <span>${message}</span>
    `;
    
    if (!document.querySelector('.notification-styles')) {
        const style = document.createElement('style');
        style.className = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 1rem 1.5rem;
                border-radius: 8px;
                color: white;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                z-index: 10000;
                animation: slideIn 0.3s ease;
            }
            .notification.success { background: #28a745; }
            .notification.error { background: #dc3545; }
            .notification.info { background: #17a2b8; }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Git Import functions
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
    showNotification('Importing from Git... This may take a moment.', 'info');
    
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
        showNotification('Error importing from Git: ' + error.message, 'error');
    });
}

// ZIP Upload functions
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
    showProcessingModal(); // Show processing modal during upload

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

// New Upload Multiple Files functions
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
    showProcessingModal(); // Show processing modal during upload

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

// Export to Zip function
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


// New show header actions modal
function showHeaderActionsModal() {
    document.getElementById('headerActionsModal').classList.add('active');
}

// Terminal Modal Functions
function showTerminalModal() {
    document.getElementById('terminalModal').classList.add('active');
    document.getElementById('headerActionsModal').classList.remove('active');
    // Initialize WebSocket connection
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
        
        // Handle loading text for specific commands
        if (data.output.includes('npm install')) {
          outputText = '<span class="terminal-loading">npm install...</span>\n';
        } else if (data.output.includes('node server.js')) {
          outputText = '<span class="terminal-loading">Starting server...</span>\n';
        } else if (data.output.includes('nodemon server.js')) {
          outputText = '<span class="terminal-loading">Starting nodemon...</span>\n';
        }

        // Append output to the terminal display
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


/* === New function to send kill signal for background process === */
async function killTerminalProcess() {
    console.log('Attempting to kill active terminal process...');
    
    // Agar terminal modal band hai, to use khol do
    const terminalModal = document.getElementById('terminalModal');
    if (!terminalModal.classList.contains('active')) {
        openTerminalModal();
        await new Promise(r => setTimeout(r, 500)); // Thoda wait karein
    }

    // Terminal output area ko clear karein
    const terminalOutput = document.getElementById('terminalOutput');
    terminalOutput.innerHTML = '';
    
    // Status message dikhayein
    const statusMessage = document.createElement('div');
    statusMessage.className = 'terminal-info-text';
    statusMessage.innerText = 'Sending kill signal...';
    terminalOutput.appendChild(statusMessage);

    // WebSocket se kill signal bhejein
    if (terminalWs && terminalWs.readyState === WebSocket.OPEN) {
        terminalWs.send(JSON.stringify({
            type: 'kill'
        }));
    } else {
        const errorMessage = document.createElement('div');
        errorMessage.className = 'terminal-error-text';
        errorMessage.innerText = 'WebSocket is not connected. Please refresh the page.';
        terminalOutput.appendChild(errorMessage);
    }
}
/* ========================================================== */

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.file-item').forEach(item => {
        item.addEventListener('click', (event) => {
            if (event.target.closest('.file-actions')) {
                return;
            }
            const path = item.dataset.path;
            const type = item.dataset.type;
            if (type === 'folder') {
                navigateToPath(path);
            } else {
                openFileEditor(path, item.querySelector('.file-name').textContent);
            }
        });
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
    });

    document.querySelectorAll('.filter-item').forEach(item => {
        item.addEventListener('click', () => {
            filterFiles(item.dataset.filter);
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
        importGitButton.addEventListener('click', showImportModal); // Yahan fix kiya gaya hai
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

    const pasteButton = document.getElementById('pasteButton');
    if (pasteButton) {
        pasteButton.addEventListener('click', pasteContent);
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

    // New Terminal Button logic
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
            if (terminalWs && terminalWs.readyState === WebSocket.OPEN) {
                terminalWs.send(JSON.stringify({ type: 'ctrlc' }));
            }
        });
    }

    document.addEventListener('click', function(event) {
        const sidebar = document.getElementById('sidebar');
        const sidebarToggleBtn = document.getElementById('sidebarToggle');
        
        if (!sidebar.contains(event.target) && !sidebarToggleBtn.contains(event.target) && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
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
        codeEditor.addEventListener('input', () => {
            const saveButton = document.getElementById('saveFileButton');
            if (codeEditor.value !== originalContent) {
                saveButton.disabled = false;
            } else {
                saveButton.disabled = true;
            }
            const editorLineCount = document.getElementById('editorLineCount');
            const lineCount = codeEditor.value.split('\n').length;
            editorLineCount.textContent = `Lines: ${lineCount}`;

            const unsavedChangesStar = document.getElementById('unsavedChangesStar');
            if (codeEditor.value === originalContent) {
                unsavedChangesStar.style.display = 'none';
            } else {
                unsavedChangesStar.style.display = 'inline';
            }
        });
    }
});

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
        
        // Handle loading text for specific commands
        if (data.output.includes('npm install')) {
          outputText = '<span class="terminal-loading">npm install...</span>\n';
        } else if (data.output.includes('node server.js')) {
          outputText = '<span class="terminal-loading">Starting server...</span>\n';
        } else if (data.output.includes('nodemon server.js')) {
          outputText = '<span class="terminal-loading">Starting nodemon...</span>\n';
        }

        // Append output to the terminal display
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