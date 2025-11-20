const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
require('dotenv').config({ path: '../.env' });
const {
  GoogleGenAI,
  HarmCategory,
  HarmBlockThreshold,
} = require('@google/genai');

// --- Initialization ---
const app = express();
const port = process.env.PORT || 3001;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
// CRITICAL CHANGE: Use upload.any() to accept multiple files
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
 * Converts a local file path to a GenerativePart object.
 */
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

app.post('/api/transform', upload.any(), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).send('No files uploaded.');
  }

  // 🚨 FIXED PROMPT 1
  const PROMPT_STUDIO_PORTRAIT =
    'Create a soft-lit studio portrait of this dog, in the style of modern fashion photography. Flat backdrop, minimal styling, neutral tones. Maintain the dog’s exact facial features. Editorial lighting, 85mm lens, shallow depth of field.';
  // 🚨 FIXED PROMPT 2
  const PROMPT_MAGAZINE_COVER =
    'Generate a fashion magazine cover crop using this dog. Show only part of the face or collarbone area in a dramatic, editorial composition. Muted fashion palette, serif masthead placeholder, clean minimal layout. Make it feel like Vogue or Self Service magazine.';

  let filePaths = [];
  let cleanupSuccessful = false;
  let allGeneratedImagesBase64 = [];

  try {
    const imageParts = req.files.map((file) => {
      filePaths.push(file.path);
      return fileToGenerativePart(file.path, file.mimetype);
    });

    // Helper function to call the API for a given prompt
    const generateImageWithPrompt = async (promptText) => {
      const fullPrompt = `Based on the provided dog image(s): ${promptText}. Focus on the dog's characteristics, pose, and face from the input photo(s). The output image must be perfectly optimized for an **Instagram Story (Reel) ratio**, meaning a vertical 9:16 aspect ratio.`;

      const contents = [...imageParts, { text: fullPrompt }];

      console.log(`Generating with prompt: ${promptText}`);

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: contents,
        config: {
          safetySettings: [
            {
              category: HarmCategory.HARM_CATEGORY_HARASSMENT,
              threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
            },
          ],
          imageGenerationConfig: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: '9:16',
          },
        },
      });

      // Correctly extract base64 data
      let generatedImageBase64 = null;
      if (response.candidates && response.candidates.length > 0) {
        const parts = response.candidates[0].content.parts;
        for (const part of parts) {
          if (
            part.inlineData &&
            part.inlineData.mimeType &&
            part.inlineData.mimeType.startsWith('image/')
          ) {
            generatedImageBase64 = part.inlineData.data;
            break;
          }
          if (part.text) {
            console.log(
              'Model returned text instead of image (for prompt):',
              promptText,
              part.text
            );
          }
        }
      }
      return generatedImageBase64;
    };

    // 🚨 CRITICAL CHANGE: Make two separate, sequential API calls
    const studioPortrait = await generateImageWithPrompt(
      PROMPT_STUDIO_PORTRAIT
    );
    const magazineCover = await generateImageWithPrompt(PROMPT_MAGAZINE_COVER);

    if (studioPortrait && magazineCover) {
      allGeneratedImagesBase64.push(studioPortrait);
      allGeneratedImagesBase64.push(magazineCover);
      res.json({ images: allGeneratedImagesBase64 }); // Return array under key 'images'
    } else {
      console.error('API Response missing one or both image data.');
      res
        .status(500)
        .json({
          error:
            'Image generation failed for one or both outputs. Check backend logs for specific failure.',
        });
    }
  } catch (error) {
    console.error('Gemini API Error:', error);
    res.status(500).json({ error: 'Failed to generate image from API.' });
  } finally {
    // CRITICAL: Clean up ALL uploaded files
    try {
      if (filePaths.length > 0) {
        filePaths.forEach((filePath) => {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        });
        cleanupSuccessful = true;
      }
    } catch (e) {
      console.error('Cleanup failed for files:', e);
      cleanupSuccessful = false;
    }
  }
});

// --- Server Start ---
app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
});
