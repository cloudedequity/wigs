// server.js
// Main file for the Node.js Express application.

const express = require('express');
const path = require('path');

// Initialize the Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Set EJS as the templating engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files (CSS, client-side JS) from the "/static" path
// This prevents path conflicts.
app.use('/static', express.static(path.join(__dirname, 'public')));

// --- IMPORTANT: Firebase Configuration ---
// This configuration is passed to the client-side script.
// It's the same config from your previous HTML file.
const firebaseConfig = {
  apiKey: "AIzaSyD5wdF3znn_AiYEPXM15Utoc9__vXQYA6s",
  authDomain: "wigs-2ec89.firebaseapp.com",
  projectId: "wigs-2ec89",
  storageBucket: "wigs-2ec89.appspot.com",
  messagingSenderId: "345878293131",
  appId: "1:345878293131:web:3d1b1fb7993ff969d1c28e",
  measurementId: "G-ZP0HW7K6D2"
};

// --- Routes ---
// Main route to render the WIG tracker application
app.get('/', (req, res) => {
  // Render the index.ejs template and pass the Firebase config to it
  res.render('index', {
    firebaseConfig: JSON.stringify(firebaseConfig) // Stringify to safely embed in a script tag
  });
});

// --- Server Startup ---
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
