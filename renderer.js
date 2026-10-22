const { ipcRenderer } = require('electron');

// Handle login functionality
window.openLogin = function() {
  // In a real implementation, this would open the actual Google login URL
  // For now, we'll open a simple login page
  console.log('Opening login window');
  window.electronAPI.openLogin('https://accounts.google.com');
};

// Listen for login completion
window.electronAPI.onLoginComplete((event, data) => {
  console.log('Login complete:', data);
  // Handle login completion in renderer
});

// Listen for login success from main process
window.electronAPI.onLoginSuccess((event, data) => {
  console.log('Login success:', data);
  // Handle login success in renderer
  // For example, refresh the main app or update UI
  if (data && data.success) {
    // Update UI to show logged in state
    document.getElementById('status-message').textContent = 'Logged in successfully!';
  }
});

// Initialize the app
window.onload = function() {
  console.log('Renderer initialized');
};