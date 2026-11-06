const { ipcRenderer } = require('electron');

// Create the textarea element
const textarea = document.createElement('textarea');
textarea.id = 'input-textarea';
textarea.placeholder = 'Type your message here...';
textarea.rows = 3;
textarea.cols = 50;
textarea.style.width = '100%';
textarea.style.resize = 'none';
textarea.style.fontFamily = 'Segoe UI, Ubuntu, Tahoma, Geneva, Verdana, sans-serif';
textarea.style.fontSize = '16px';
textarea.style.padding = '10px';
textarea.style.border = '1px solid #ccc';
textarea.style.borderRadius = '4px';
textarea.style.boxSizing = 'border-box';
textarea.style.outline = 'none';
textarea.style.marginBottom = '10px';

// Add event listener for input events to handle IME properly
textarea.addEventListener('input', function() {
  // Update the text content immediately
  const text = this.value;
  
  // Preserve cursor position
  const cursorPosition = this.selectionStart;
  
  // Send updated text to main process
  ipcRenderer.send('input-text', text);
  
  // Restore cursor position after update
  setTimeout(() => {
    this.setSelectionRange(cursorPosition, cursorPosition);
  }, 0);
});

// Add event listener for keydown events to handle Enter key
textarea.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const text = this.value;
    ipcRenderer.send('send-message', text);
    this.value = '';
  }
});

// Add event listener for paste events
textarea.addEventListener('paste', function(e) {
  e.preventDefault();
  const text = e.clipboardData.getData('text/plain');
  const start = this.selectionStart;
  const end = this.selectionEnd;
  const currentValue = this.value;
  this.value = currentValue.substring(0, start) + text + currentValue.substring(end);
  
  // Set cursor position after pasted text
  const newPosition = start + text.length;
  setTimeout(() => {
    this.setSelectionRange(newPosition, newPosition);
  }, 0);
});

// Add the textarea to the document
const container = document.getElementById('input-container');
container.appendChild(textarea);

// Listen for messages from the main process
ipcRenderer.on('message-response', (event, response) => {
  const responseElement = document.getElementById('response');
  responseElement.innerHTML = response;
});

// Listen for app metadata
ipcRenderer.on('app-version', (event, version) => {
  document.getElementById('app-version').innerText = version;
});

// Listen for app title
ipcRenderer.on('app-title', (event, title) => {
  document.getElementById('app-title').innerText = title;
});

// Listen for app author
ipcRenderer.on('app-author', (event, author) => {
  document.getElementById('app-author').innerText = author;
});

// Listen for app bugs URL
ipcRenderer.on('app-bugs-url', (event, url) => {
  document.querySelectorAll(`a[href="@@BUGURL@@"]`).forEach(anchor => {
    anchor.href = url;
  });
});

// Request app metadata
window.onload = () => {
  ipcRenderer.send('get-app-metadata');
};
