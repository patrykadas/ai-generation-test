const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config({ path: '../.env' }); // Load .env from project root
const {
  GoogleGenAI,
  HarmCategory,
  HarmBlockThreshold,
} = require('@google/genai');

// --- Initialization ---
const app = express();
const port = process.env.PORT || 3001;
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const upload = multer({ dest: 'uploads/' });

// Allow CORS from the React default port (3000) for local development
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// --- Helper Functions ---

// Converts a local file path to a GenerativePart object for the Gemini API
function fileToGenerativePart(path, mimeType) {
  if (!fs.existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }
  return {
    inlineData: {
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
  let cleanupSuccessful = false;

  try {
    const imagePart = fileToGenerativePart(filePath, mimetype);

    const fullPrompt = `Take the provided dog image and transform it into a masterpiece as described: ${prompt}. Focus on the dog's characteristics and make the image fit for an Instastory.`;

    const response = await ai.models.generateContent({
      model: 'imagen-3.0-generate-002',
      contents: [{ role: 'user', parts: [imagePart, { text: fullPrompt }] }],
      config: {
        safetySettings: [
          {
            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
            threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
          },
        ],
        // You may need to add Imagen-specific config here, like 'imageGenerationConfig'
        // For simplicity, relying on the model's default image generation capability first.
      },
    });

    // The response structure for Imagen is complex; this is a placeholder response:
    const generatedImageBase64 =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

    if (generatedImageBase64) {
      res.json({ image: generatedImageBase64 });
    } else {
      res
        .status(500)
        .json({ error: 'Image generation failed to return data.' });
    }
  } catch (error) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ error: 'Failed to generate image from API.' });
  } finally {
    // CRITICAL: Clean up the uploaded file
    try {
      fs.unlinkSync(filePath);
      cleanupSuccessful = true;
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
