const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
// Load .env from project root, assuming server.js is in 'backend/'
require('dotenv').config({ path: '../.env' }); 
const { GoogleGenAI, HarmCategory, HarmBlockThreshold } = require("@google/genai");

// --- Initialization ---
const app = express();
const port = process.env.PORT || 3001;

// Initialize GoogleGenAI client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const upload = multer({ dest: 'uploads/' });

// --- CORS Configuration (FIXED for Render Deployment) ---
// Add all allowed origins (local development and your live Render frontend URL)
const allowedOrigins = [
  'http://localhost:3000', // For local React development
  'https://ai-generation-test-1.onrender.com' // YOUR LIVE FRONTEND URL
];

app.use(cors({ 
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl) or if origin is in the allowed list
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            // Block origin not in the list
            callback(new Error(`CORS policy violation: Origin ${origin} is not allowed.`));
        }
    }
}));
app.use(express.json());

// --- Helper Functions ---

/**
 * Converts a local file path to a GenerativePart object for the Gemini API.
 * @param {string} path - The local file path.
 * @param {string} mimeType - The file's MIME type.
 * @returns {object} A GenerativePart object with inline data.
 */
function fileToGenerativePart(path, mimeType) {
  if (!fs.existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
  return {
    inlineData: {
      // Read file content, convert to base64, and pass to the API
      data: Buffer.from(fs.readFileSync(path)).toString("base64"),
      mimeType,
    },
  };
}

// --- API Endpoint ---

app.post('/api/transform', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  const { path: filePath, mimetype } = req.file;
  const { prompt } = req.body; 
  
  if (!prompt) {
      // Clean up file if prompt is missing
      fs.unlinkSync(filePath);
      return res.status(400).send('Prompt is required.');
  }
  
  let cleanupSuccessful = false;

  try {
    const imagePart = fileToGenerativePart(filePath, mimetype);