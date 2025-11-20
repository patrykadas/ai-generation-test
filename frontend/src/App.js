import React, { useState } from 'react';
import './App.css';

const API_BASE_URL = 'https://ai-generation-test-2.onrender.com';

function App() {
  const [imageFiles, setImageFiles] = useState([]);
  // CRITICAL CHANGE: State now holds an array of generated image URLs
  const [generatedImages, setGeneratedImages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    setImageFiles(Array.from(e.target.files));
    setGeneratedImages([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setGeneratedImages([]);

    if (imageFiles.length === 0) {
      setError('Please select at least one image.');
      return;
    }

    setIsLoading(true);

    const formData = new FormData();
    imageFiles.forEach((file, index) => {
      // Use distinct field names for multiple files
      formData.append(`image_${index}`, file);
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/transform`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        console.error(`HTTP error! status: ${response.status}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Expecting an array of two base64 strings
      if (data.images && data.images.length === 2) {
        // Convert base64 strings to data URLs for the <img> tag
        setGeneratedImages(
          data.images.map((imgBase64) => `data:image/jpeg;base64,${imgBase64}`)
        );
      } else {
        setError('API did not return the expected two generated images.');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError(`Fetch error: ${err.message}. Please check console.`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>🐕 Dog Portrait & Magazine Cover Generator 📸</h1>
      </header>

      <div className="container">
        <form onSubmit={handleSubmit} className="form-section">
          <h2>1. Upload Dog Photos (1-3 recommended)</h2>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            required
            multiple
            capture // Enables camera selection on mobile
          />
          {imageFiles.length > 0 && (
            <p className="file-count">{imageFiles.length} file(s) selected.</p>
          )}

          <h2>2. Generate Portraits</h2>
          <p>Get **two distinct professional-grade images** of your dog:</p>
          <ul>
            <li>
              **Soft-lit Studio Portrait:** Modern fashion photography style.
            </li>
            <li>**Fashion Magazine Cover:** Dramatic editorial crop.</li>
          </ul>

          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Generating...' : 'Generate Images'}
          </button>
        </form>

        <div className="result-section">
          <h2>3. Results</h2>
          {error && <p className="error">{error}</p>}
          {isLoading && <div className="loader"></div>}

          {/* Loop to display both images */}
          {generatedImages.length > 0 && (
            <div className="image-output-grid">
              <div className="generated-image-card">
                <h3>Studio Portrait</h3>
                <img
                  src={generatedImages[0]}
                  alt="Generated Studio Dog Portrait"
                />
              </div>
              <div className="generated-image-card">
                <h3>Magazine Cover</h3>
                <img
                  src={generatedImages[1]}
                  alt="Generated Magazine Cover Dog"
                />
              </div>
              <p>Your AI masterpieces are complete!</p>
            </div>
          )}

          {!isLoading && generatedImages.length === 0 && !error && (
            <p>Upload an image to generate two unique AI transformations.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
