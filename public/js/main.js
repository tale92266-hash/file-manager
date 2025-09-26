let currentPath = '/';
let hideHidden = true;
let selectedFilePath = '';
let selectedFileName = '';
let selectedFileType = ''; // New variable to store the type (file/folder)
let originalContent = ''; // Variable to store original file content
let activeContextMenu = null; // Track the currently active context menu

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

    selectedFilePath = filePath;
    editorTitle.textContent = fileName;
    editorModal.classList.add('active');

    codeEditor.value = '';
    codeEditor.classList.add('loading');
    codeEditor.readOnly = true;

    fetch(`/file-content?path=${encodeURIComponent(filePath)}`)
        .then(response => response.json())
        .then(data => {
            codeEditor.classList.remove('loading');
            codeEditor.readOnly = false;

            if (data.content !== null && data.content !== undefined) {
                if (data.content.trim() === '') {
                    codeEditor.value = 'This file is empty. You can start typing to add content.';
                    originalContent = '';
                } else {
                    codeEditor.value = data.content;
                    originalContent = data.content;
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
}

function pasteContent() {
    navigator.clipboard.readText().then(text => {
        const codeEditor = document.getElementById('codeEditor');
        codeEditor.value += text;
        showNotification('Pasted content from clipboard!', 'info');
        const saveButton = document.getElementById('saveFileButton');
        saveButton.disabled = codeEditor.value === originalContent;
    }).catch(err => {
        showNotification('Failed to read clipboard content.', 'error');
    });
}

function selectAll() {
    const codeEditor = document.getElementById('codeEditor');
    codeEditor.select();
    showNotification('All content selected!', 'info');
}

function cutContent() {
    const codeEditor = document.getElementById('codeEditor');
    navigator.clipboard.writeText(codeEditor.value)
    .then(() => {
        codeEditor.value = '';
        showNotification('Content cut to clipboard!', 'info');
        const saveButton = document.getElementById('saveFileButton');
        saveButton.disabled = codeEditor.value === originalContent;
    })
    .catch(err => {
        showNotification('Failed to cut content.', 'error');
    });
}

function copyContent() {
    const codeEditor = document.getElementById('codeEditor');
    navigator.clipboard.writeText(codeEditor.value)
    .then(() => {
        showNotification('Content copied to clipboard!', 'success');
    })
    .catch(err => {
        showNotification('Failed to copy content.', 'error');
    });
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
        headers: { 'Content-Type': 'application/json' },
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
        showNotification('Error: ' + error.message, 'error');
    });
}

// New ZIP Upload functions
function showUploadModal() {
    document.getElementById('uploadModal').classList.add('active');
}

function closeUploadModal() {
    document.getElementById('uploadModal').classList.remove('active');
    document.getElementById('zipFileInput').value = ''; // File input ko reset karein
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
    showNotification('Uploading and extracting zip file...', 'info');

    try {
        fetch('/import-zip', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                // Agar response successful nahi hai, to error throw karein
                throw new Error('Server returned an error: ' + response.statusText);
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                showNotification(data.message, 'success');
                setTimeout(() => window.location.reload(), 2000);
            } else {
                showNotification('Error uploading zip: ' + data.error, 'error');
            }
        })
        .catch(error => {
            // Is block mein network aur server-side errors ko handle karein
            showNotification('Error during upload: ' + error.message, 'error');
        });
    } catch (error) {
        // Is block mein client-side errors ko handle karein
        showNotification('Client-side error: ' + error.message, 'error');
    }
}


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

    const importGitButton = document.getElementById('importGitButton');
    if (importGitButton) {
        importGitButton.addEventListener('click', showImportModal);
    }
    
    const uploadButton = document.getElementById('uploadButton');
    if(uploadButton) {
        uploadButton.addEventListener('click', showUploadModal);
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
        });
    }
});
