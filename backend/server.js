const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
// Load .env from project root, assuming server.js is in 'backend/'
require('dotenv').config({ path: '../.env' });
const {
  GoogleGenAI,
  HarmCategory,
  HarmBlockThreshold,
} = require('@google/genai');

// --- Initialization ---
const app = express();
const port = process.env.PORT || 3001;

// Initialize GoogleGenAI client
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const upload = multer({ dest: 'uploads/' });

// --- CORS Configuration (FIXED) ---
const allowedOrigins = [
  'http://localhost:3000',
  'https://ai-generation-test-1.onrender.com',
  'https://ai-generation-test-2.onrender.com',
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(
          new Error(`CORS policy violation: Origin ${origin} is not allowed.`)
        );
      }
    },
  })
);
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
      data: Buffer.from(fs.readFileSync(path)).toString('base64'),
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

    // Prompt focuses on dog transformation and fitting an Instastory ratio
    const fullPrompt = `Take the provided dog image and transform it into a masterpiece as described: ${prompt}. Focus on the dog's characteristics. The output image must be perfectly optimized for an **Instagram Story (Reel) ratio**, meaning a vertical 9:16 aspect ratio.`;

    console.log(`Generating image with prompt: ${fullPrompt}`);

    // Call the correct image generation model
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', // Final Model ID
      contents: [{ role: 'user', parts: [imagePart, { text: fullPrompt }] }],
      config: {
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
        ],
        // The aspect_ratio is the key configuration for the Instastory/Reel look
        imageGenerationConfig: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: '9:16', // Setting the vertical aspect ratio
        },
      },
    });

    // 🚨 FINAL CRITICAL FIX: Robustly check candidates and iterate through parts to find the image data
    let generatedImageBase64 = null;

    if (response.candidates && response.candidates.length > 0) {
      const parts = response.candidates[0].content.parts;

      for (const part of parts) {
        // Check if the part contains inline data and if that data is an image
        if (
          part.inlineData &&
          part.inlineData.mimeType &&
          part.inlineData.mimeType.startsWith('image/')
        ) {
          generatedImageBase64 = part.inlineData.data;
          break; // Found the image, exit the loop
        }
        // Optional: Log text if no image is found (useful for debugging)
        if (part.text) {
          console.log('Model returned text instead of image:', part.text);
        }
      }
    }

    if (generatedImageBase64) {
      res.json({ image: generatedImageBase64 });
    } else {
      console.error(
        'API Response missing image data (no inline image part found):',
        response
      );
      res
        .status(500)
        .json({
          error:
            'Image generation failed. Model may have returned a text description or encountered a safety policy.',
        });
    }
  } catch (error) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ error: 'Failed to generate image from API.' });
  } finally {
    // CRITICAL: Clean up the uploaded file, regardless of success/failure
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        cleanupSuccessful = true;
      }
    } catch (e) {
      console.error('Cleanup failed for file:', filePath, e);
      cleanupSuccessful = false;
    }
  }
});

// --- Server Start ---
app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
});
