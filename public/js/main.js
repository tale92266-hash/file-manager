let currentPath = '/';
let hideHidden = true; // State variable to manage hidden files
let selectedFilePath = '';
let selectedFileName = '';

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

// Close sidebar on any sidebar link click (for mobile)
document.querySelectorAll('.sidebar a').forEach(item => {
    item.onclick = () => {
        document.getElementById('sidebar').classList.remove('active');
    };
});

// Toggle hidden files
function toggleHidden() {
    hideHidden = !hideHidden;
    const hiddenFiles = document.querySelectorAll('.hidden-file');
    const toggleBtn = document.getElementById('hideToggle');
    
    hiddenFiles.forEach(file => {
        if (hideHidden) {
            file.classList.add('hide');
        } else {
            file.classList.remove('hide');
        }
    });

    if (toggleBtn) {
        toggleBtn.innerHTML = hideHidden ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
    }
}

// File filtering
function filterFiles(type) {
    const fileItems = document.querySelectorAll('.file-item');
    
    fileItems.forEach(item => {
        const fileName = item.querySelector('.file-name').textContent.toLowerCase();
        const isHidden = item.classList.contains('hidden-file');
        let shouldShow = true;
        
        switch(type) {
            case 'code':
                shouldShow = fileName.match(/\.(js|html|css|json|py|java|cpp|c|php|rb|go)$/);
                break;
            case 'images':
                shouldShow = fileName.match(/\.(jpg|jpeg|png|gif|svg|bmp|webp)$/);
                break;
            case 'all':
            default:
                shouldShow = true;
                break;
        }
        
        // Agar file hidden hai aur hidden files ko hide karna hai, to show mat karo
        if (isHidden && hideHidden) {
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
    contextMenu.style.left = event.pageX + 'px';
    contextMenu.style.top = event.pageY + 'px';
    contextMenu.classList.add('active');
    
    // Hide menu when clicking elsewhere
    document.addEventListener('click', hideContextMenu, { once: true });
}

function hideContextMenu() {
    document.getElementById('contextMenu').classList.remove('active');
}

function renameFile() {
    hideContextMenu();
    const newName = prompt('Enter new name:', selectedFileName);
    if (newName && newName !== selectedFileName) {
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
                setTimeout(() => window.location.reload(), 1000);
            } else {
                showNotification('Error renaming file: ' + data.error, 'error');
            }
        })
        .catch(error => {
            showNotification('Error: ' + error.message, 'error');
        });
    }
}

function deleteFile() {
    hideContextMenu();
    if (confirm(`Are you sure you want to delete "${selectedFileName}"?`)) {
        fetch('/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: selectedFilePath })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showNotification('File deleted successfully!', 'success');
                setTimeout(() => window.location.reload(), 1000);
            } else {
                showNotification('Error deleting file: ' + data.error, 'error');
            }
        })
        .catch(error => {
            showNotification('Error: ' + error.message, 'error');
        });
    }
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
    
    const currentPath = new URLSearchParams(window.location.search).get('path') || '/';
    
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
            setTimeout(() => window.location.reload(), 1000);
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
    
    const currentPath = new URLSearchParams(window.location.search).get('path') || '/';
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
    // Update file count
    const fileCount = document.querySelectorAll('.file-item').length;
    const fileCountElement = document.getElementById('fileCount');
    if (fileCountElement) {
        fileCountElement.textContent = fileCount;
    }
    
    // Update current path display
    const currentPath = new URLSearchParams(window.location.search).get('path') || '/';
    const currentPathDisplay = document.getElementById('currentPathDisplay');
    if (currentPathDisplay) {
        currentPathDisplay.textContent = currentPath;
    }
    
    // Initialize hidden files toggle
    toggleHidden();

    // Event listeners for file filters
    document.getElementById('filterAll').addEventListener('click', () => filterFiles('all'));
    document.getElementById('filterCode').addEventListener('click', () => filterFiles('code'));
    document.getElementById('filterImages').addEventListener('click', () => filterFiles('images'));
    document.getElementById('hideToggle').addEventListener('click', toggleHidden);
});
