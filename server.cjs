const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { PORT } = require('./utils/config');

// Create Express app
const app = express();

// Configure multer for handling multipart/form-data
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
const projectHtml = fs.readFileSync(path.join(__dirname, 'project.html'), 'utf-8');

// Root route - serve project.html
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(projectHtml);
});

// Simple test route
app.get('/test', (req, res) => {
  res.json({ message: 'Express server is running!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Express server running at http://localhost:${PORT}`);
  console.log(`API Key (for development): ${process.env.API_KEY || 'Not set'}`);
});