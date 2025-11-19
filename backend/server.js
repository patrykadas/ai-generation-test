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

// --- CORS Configuration (Fix for Render Deployment) ---
const allowedOrigins = [
  'http://localhost:3000', // For local development
  'https://ai-generation-test-1.onrender.com' // YOUR LIVE FRONTEND URL
];

app.use(cors({ 
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl) or if in the allowed list
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
function fileToGenerativePart(path, mimeType)