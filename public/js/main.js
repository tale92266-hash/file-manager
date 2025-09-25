let currentPath = '/';
let hideHidden = true;
let selectedFilePath = '';
let selectedFileName = '';
let selectedFileType = ''; // New variable to store the type (file/folder)
let originalContent = ''; // Variable to store original file content
let isProcessRunning = false; // Consolidated flag for any ongoing process (export/import)
let activeContextMenu = null; // Track the currently active context menu

// Helper function to get the base path from the URL
function getBasePath() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('path') || '/';
}

// Navigation functions
function navigateToPath(path) {
    if (isProcessRunning) {
        showNotification('An operation is running. Please wait for it to complete.', 'error');
        return;
    }
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
    if (isProcessRunning) {
        showNotification('An operation is running. Actions are disabled.', 'error');
        return;
    }
    
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
    a.download = selectedFileName; // This helps suggest the file name
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Create modal functions
function showCreateModal() {
    if (isProcessRunning) {
        showNotification('An operation is running. Actions are disabled.', 'error');
        return;
    }
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
    if (isProcessRunning) {
        showNotification('An operation is running. Actions are disabled.', 'error');
        return;
    }
    document.getElementById('uploadModal').classList.add('active');
    document.getElementById('fileInput').value = ''; // Reset file input
    document.getElementById('fileLabel').textContent = 'Choose File(s)...'; // Reset label
    document.getElementById('dropZoneUpload').classList.remove('active'); // Remove active class on open
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
    if (isProcessRunning) {
        showNotification('An operation is running. Actions are disabled.', 'error');
        return;
    }
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

// New Export Project function
function exportProject() {
    const currentPath = getBasePath();
    const exportModal = document.getElementById('exportModal');
    const exportStatusMessage = document.getElementById('exportStatusMessage');
    
    // Set exporting flag to true and show modal
    isProcessRunning = true;
    exportModal.classList.add('active');
    exportStatusMessage.textContent = 'Preparing files for export...';

    // Disable all UI elements
    const disableElements = document.querySelectorAll('.main-container button, .file-item, .quick-link, .filter-item, .sidebar-toggle');
    disableElements.forEach(el => el.style.pointerEvents = 'none');

    fetch(`/export?path=${encodeURIComponent(currentPath)}`)
        .then(response => {
            if (!response.ok) {
                return response.text().then(text => { throw new Error(text) });
            }
            // Start the download
            const disposition = response.headers.get('content-disposition');
            const fileNameMatch = disposition && disposition.match(/filename="(.+)"/);
            const fileName = fileNameMatch ? fileNameMatch[1] : 'project-export.zip';
            
            return response.blob().then(blob => {
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
            });
        })
        .then(() => {
            showNotification('Project exported successfully!', 'success');
        })
        .catch(error => {
            showNotification('Error exporting project: ' + error.message, 'error');
        })
        .finally(() => {
            // Reset exporting flag and hide modal
            isProcessRunning = false;
            exportModal.classList.remove('active');
            
            // Re-enable all UI elements
            const enableElements = document.querySelectorAll('.main-container button, .file-item, .quick-link, .filter-item, .sidebar-toggle');
            enableElements.forEach(el => el.style.pointerEvents = 'auto');
        });
}

// New Import Project functions
function showImportModal() {
    if (isProcessRunning) {
        showNotification('An operation is running. Actions are disabled.', 'error');
        return;
    }
    document.getElementById('importModal').classList.add('active');
    document.getElementById('importLoadingState').style.display = 'none';
    document.getElementById('uploadZipButton').style.display = 'block';
    document.getElementById('zipFileInput').value = '';
    document.getElementById('zipFileLabel').textContent = 'Choose File...'; // Reset label text
    document.getElementById('dropZone').classList.remove('active'); // Remove active class on open
}

function closeImportModal() {
    document.getElementById('importModal').classList.remove('active');
}

function importProject() {
    const zipFileInput = document.getElementById('zipFileInput');
    const zipFile = zipFileInput.files[0];

    if (!zipFile) {
        showNotification('Please select a zip file to import', 'error');
        return;
    }
    
    // Hide upload button and show loading state
    document.getElementById('uploadZipButton').style.display = 'none';
    document.getElementById('importLoadingState').style.display = 'flex';
    document.getElementById('importStatusMessage').textContent = 'Importing project...';

    const currentPath = getBasePath();
    const formData = new FormData();
    formData.append('zipFile', zipFile);
    formData.append('currentPath', currentPath);

    // Set process running flag
    isProcessRunning = true;
    const disableElements = document.querySelectorAll('.main-container button, .file-item, .quick-link, .filter-item, .sidebar-toggle');
    disableElements.forEach(el => el.style.pointerEvents = 'none');
    
    fetch('/import', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            showNotification('Project imported successfully! Refreshing...', 'success');
            setTimeout(() => window.location.reload(), 1500);
        } else {
            showNotification('Error importing project: ' + data.error, 'error');
            document.getElementById('importLoadingState').style.display = 'none';
            document.getElementById('uploadZipButton').style.display = 'block';
        }
    })
    .catch(error => {
        showNotification('Error: ' + error.message, 'error');
        document.getElementById('importLoadingState').style.display = 'none';
        document.getElementById('uploadZipButton').style.display = 'block';
    })
    .finally(() => {
        // Reset process running flag and re-enable UI elements
        isProcessRunning = false;
        const enableElements = document.querySelectorAll('.main-container button, .file-item, .quick-link, .filter-item, .sidebar-toggle');
        enableElements.forEach(el => el.style.pointerEvents = 'auto');
    });
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
    document.getElementById('downloadMenuItem').addEventListener('click', downloadFile);


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

    // New export button event listener
    const exportButton = document.getElementById('exportButton');
    if (exportButton) {
        exportButton.addEventListener('click', exportProject);
    }

    // Close export modal button
    const closeExportModalBtn = document.getElementById('closeExportModal');
    if (closeExportModalBtn) {
        closeExportModalBtn.addEventListener('click', () => {
            if (isProcessRunning) {
                showNotification('An operation is in progress and cannot be cancelled.', 'error');
            } else {
                document.getElementById('exportModal').classList.remove('active');
            }
        });
    }

    // New import button event listener
    const importButton = document.getElementById('importButton');
    if (importButton) {
        importButton.addEventListener('click', showImportModal);
    }
    
    const uploadZipButton = document.getElementById('uploadZipButton');
    if (uploadZipButton) {
        uploadZipButton.addEventListener('click', importProject);
    }

    const closeImportModalBtn = document.getElementById('closeImportModal');
    if (closeImportModalBtn) {
        closeImportModalBtn.addEventListener('click', () => {
            if (isProcessRunning) {
                showNotification('An operation is in progress and cannot be cancelled.', 'error');
            } else {
                document.getElementById('importModal').classList.remove('active');
            }
        });
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

    // Handle file name display for import modal
    const zipFileInput = document.getElementById('zipFileInput');
    if (zipFileInput) {
        zipFileInput.addEventListener('change', () => {
            const fileNameDisplay = document.getElementById('zipFileLabel');
            if (zipFileInput.files.length > 0) {
                fileNameDisplay.textContent = zipFileInput.files[0].name;
            } else {
                fileNameDisplay.textContent = 'Choose File...';
            }
        });
        
        const dropZone = document.getElementById('dropZone');
        
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('active');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('active');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('active');
            
            const files = e.dataTransfer.files;
            zipFileInput.files = files; // Assign the dropped files to the input element
            
            const fileNameDisplay = document.getElementById('zipFileLabel');
            if (zipFileInput.files.length > 0) {
                fileNameDisplay.textContent = zipFileInput.files[0].name;
            } else {
                fileNameDisplay.textContent = 'Choose File...';
            }
        });
    }
    
    // Handle file name display for upload modal
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', () => {
            const fileNameDisplay = document.getElementById('fileLabel');
            if (fileInput.files.length > 0) {
                fileNameDisplay.textContent = `${fileInput.files.length} file(s) selected`;
            } else {
                fileNameDisplay.textContent = 'Choose File(s)...';
            }
        });
        
        const dropZoneUpload = document.getElementById('dropZoneUpload');
        
        dropZoneUpload.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZoneUpload.classList.add('active');
        });

        dropZoneUpload.addEventListener('dragleave', () => {
            dropZoneUpload.classList.remove('active');
        });

        dropZoneUpload.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZoneUpload.classList.remove('active');
            
            const files = e.dataTransfer.files;
            fileInput.files = files;
            
            const fileNameDisplay = document.getElementById('fileLabel');
            if (fileInput.files.length > 0) {
                fileNameDisplay.textContent = `${fileInput.files.length} file(s) selected`;
            } else {
                fileNameDisplay.textContent = 'Choose File(s)...';
            }
        });
    }
});