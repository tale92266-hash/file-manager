// Editor specific functions
let selectedFilePath = '';

function openFileEditor(filePath, fileName) {
    const editorModal = document.getElementById('editorModal');
    const editorTitle = document.getElementById('editorTitle');
    const codeEditor = document.getElementById('codeEditor');

    selectedFilePath = filePath;
    editorTitle.textContent = fileName;
    editorModal.classList.add('active');

    fetch(`/file-content?path=${encodeURIComponent(filePath)}`)
        .then(response => response.json())
        .then(data => {
            if (data.content) {
                codeEditor.value = data.content;
            } else {
                codeEditor.value = 'Error loading file content.';
                showNotification('Error loading file: ' + data.error, 'error');
            }
        })
        .catch(error => {
            codeEditor.value = 'Error loading file content.';
            showNotification('Network error: ' + error.message, 'error');
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
}

function pasteContent() {
    navigator.clipboard.readText().then(text => {
        const codeEditor = document.getElementById('codeEditor');
        codeEditor.value += text;
        showNotification('Pasted content from clipboard!', 'info');
    }).catch(err => {
        showNotification('Failed to read clipboard content.', 'error');
    });
}

function cancelEdit() {
    // Re-load the content from the file to revert changes
    openFileEditor(selectedFilePath, document.getElementById('editorTitle').textContent);
    showNotification('Changes cancelled!', 'info');
}

// Event listeners for editor buttons
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

const cancelButton = document.getElementById('cancelButton');
if (cancelButton) {
    cancelButton.addEventListener('click', closeFileEditor);
}
