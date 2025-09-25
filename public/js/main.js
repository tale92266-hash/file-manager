let currentPath = '/';
let hideHidden = true;
let selectedFilePath = '';
let selectedFileName = '';
let originalContent = ''; // Variable to store original file content

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
    event.preventDefault();
    event.stopPropagation();
    
    selectedFilePath = filePath;
    selectedFileName = fileName;
    
    const contextMenu = document.getElementById('contextMenu');
    if (contextMenu) {
        // Check if menu would go off-screen
        const windowWidth = window.innerWidth;
        const menuWidth = contextMenu.offsetWidth;
        let leftPosition = event.pageX;

        if (leftPosition + menuWidth > windowWidth) {
            leftPosition = windowWidth - menuWidth - 20; // 20px padding from the right edge
        }
        
        contextMenu.style.left = leftPosition + 'px';
        contextMenu.style.top = event.pageY + 'px';
        contextMenu.classList.add('active');
    }
    
    // Hide menu when clicking elsewhere
    document.addEventListener('click', hideContextMenu, { once: true });
}

function hideContextMenu() {
    const contextMenu = document.getElementById('contextMenu');
    if (contextMenu) {
        contextMenu.classList.remove('active');
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
                // Editor open karein naye file ke liye
                openFileEditor(`${currentPath}/${name}`, name);
            } else {
                // Folders ke liye page reload karein
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

// Upload modal functions
function showUploadModal() {
    document.getElementById('uploadModal').classList.add('active');
}

function closeUploadModal() {
    document.getElementById('uploadModal').classList.remove('active');
}

function uploadFiles() {
    const fileInput = document.getElementById('fileInput');
    const files = fileInput.files;
    
    if (files.length === 0) {
        showNotification('Please select files to upload', 'error');
        return;
    }
    
    const currentPath = getBasePath();
    const formData = new FormData();
    
    for (let file of files) {
        formData.append('files', file);
    }
    formData.append('currentPath', currentPath);
    
    fetch('/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('Files uploaded successfully!', 'success');
            closeUploadModal();
            setTimeout(() => window.location.reload(), 1000);
        } else {
            showNotification('Error uploading files: ' + data.error, 'error');
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

    // Show loading state
    codeEditor.value = '';
    codeEditor.classList.add('loading');
    codeEditor.readOnly = true;

    // Fetch file content and populate editor
    fetch(`/file-content?path=${encodeURIComponent(filePath)}`)
        .then(response => response.json())
        .then(data => {
            // Remove loading state
            codeEditor.classList.remove('loading');
            codeEditor.readOnly = false;

            if (data.content !== null && data.content !== undefined) {
                if (data.content.trim() === '') {
                    // Empty file case
                    codeEditor.value = 'This file is empty. You can start typing to add content.';
                    originalContent = '';
                } else {
                    // File has content
                    codeEditor.value = data.content;
                    originalContent = data.content;
                }
                saveButton.disabled = true; // Initially button ko disable karein
            } else {
                codeEditor.value = 'Error loading file content.';
                showNotification('Error loading file: ' + data.error, 'error');
                saveButton.disabled = true;
            }
        })
        .catch(error => {
            // Remove loading state and show error
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
            originalContent = content; // New content ko original maan lein
            document.getElementById('saveFileButton').disabled = true; // Button ko disable karein
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

// New functions for Cut, Copy, Select All
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
    // Re-load the content from the file to revert changes
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
    
    // Add notification styles if not already present
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

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    // Event listeners for file items
    document.querySelectorAll('.file-item').forEach(item => {
        item.addEventListener('click', (event) => {
            // Stop propagation for options button
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

    // Event listeners for file action buttons (3 dots)
    document.querySelectorAll('.file-actions button').forEach(button => {
        button.addEventListener('click', (event) => {
            event.stopPropagation(); // Stop event from bubbling to parent file-item
            const item = event.target.closest('.file-item');
            const path = item.dataset.path;
            const name = item.querySelector('.file-name').textContent;
            showContextMenu(event, path, name);
        });
    });

    // Event listeners for context menu items
    document.getElementById('renameMenuItem').addEventListener('click', renameFile);
    document.getElementById('deleteMenuItem').addEventListener('click', deleteFile);
    document.getElementById('copyPathMenuItem').addEventListener('click', copyPath);

    // Event listeners for rename modal buttons
    document.getElementById('closeRenameModal').addEventListener('click', () => document.getElementById('renameModal').classList.remove('active'));
    document.getElementById('cancelRenameButton').addEventListener('click', () => document.getElementById('renameModal').classList.remove('active'));
    document.getElementById('saveRenameButton').addEventListener('click', saveRenamedFile);

    // Event listeners for delete modal buttons
    document.getElementById('closeDeleteModal').addEventListener('click', () => document.getElementById('deleteModal').classList.remove('active'));
    document.getElementById('cancelDeleteButton').addEventListener('click', () => document.getElementById('deleteModal').classList.remove('active'));
    document.getElementById('confirmDeleteButton').addEventListener('click', confirmDelete);

    // Event listeners for breadcrumb links
    document.querySelectorAll('.breadcrumb-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            navigateToPath(item.dataset.path);
        });
    });

    // Event listeners for sidebar links
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
    
    // Header button event listeners
    const sidebarToggleBtn = document.getElementById('sidebarToggle');
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', toggleSidebar);
    }
    
    const newButton = document.getElementById('newButton');
    if (newButton) {
        newButton.addEventListener('click', showCreateModal);
    }
    
    const uploadButton = document.getElementById('uploadButton');
    if (uploadButton) {
        uploadButton.addEventListener('click', showUploadModal);
    }
    
    // Modal button event listeners
    const closeCreateModalBtn = document.getElementById('closeCreateModal');
    if (closeCreateModalBtn) {
        closeCreateModalBtn.addEventListener('click', closeCreateModal);
    }
    
    const closeUploadModalBtn = document.getElementById('closeUploadModal');
    if (closeUploadModalBtn) {
        closeUploadModalBtn.addEventListener('click', closeUploadModal);
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

    // Event listeners for newly added buttons
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

    const uploadFilesButton = document.getElementById('uploadFilesButton');
    if (uploadFilesButton) {
        uploadFilesButton.addEventListener('click', uploadFiles);
    }

    // Sidebar outside click to close
    document.addEventListener('click', function(event) {
        const sidebar = document.getElementById('sidebar');
        const sidebarToggleBtn = document.getElementById('sidebarToggle');
        
        if (!sidebar.contains(event.target) && !sidebarToggleBtn.contains(event.target) && sidebar.classList.contains('active')) {
            sidebar.classList.remove('active');
        }
    });

    // Sidebar close button event listener
    const closeSidebarButton = document.getElementById('closeSidebarButton');
    if (closeSidebarButton) {
        closeSidebarButton.addEventListener('click', toggleSidebar);
    }
    
    // Update file count
    const fileCount = document.querySelectorAll('.file-item').length;
    const fileCountElement = document.getElementById('fileCount');
    if (fileCountElement) {
        fileCountElement.textContent = fileCount;
    }
    
    // Update current path display
    const currentPathDisplay = document.getElementById('currentPathDisplay');
    if (currentPathDisplay) {
        currentPathDisplay.textContent = getBasePath();
    }
    
    // Check for changes in the editor to enable/disable save button
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