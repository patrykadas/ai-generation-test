import React, { useState } from 'react';
import './App.css';

// CRITICAL: This is the final correct address of the backend Web Service
const API_BASE_URL = 'https://ai-generation-test-2.onrender.com';

function App() {
  const [imageFile, setImageFile] = useState(null);
  // Removed prompt state
  const [generatedImage, setGeneratedImage] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    setImageFile(e.target.files[0]);
    setGeneratedImage(null); // Clear previous image on new file selection
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setGeneratedImage(null);

    if (!imageFile) {
      // Simplified validation
      setError('Please select an image.');
      return;
    }

    setIsLoading(true);

    const formData = new FormData();
    formData.append('image', imageFile);
    // Removed prompt from formData

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

      if (data.image) {
        setGeneratedImage(`data:image/jpeg;base64,${data.image}`);
      } else {
        setError('API did not return a generated image.');
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
        <h1>🐕 Dog Portrait Masterpiece Generator 👑</h1>
      </header>

      <div className="container">
        <form onSubmit={handleSubmit} className="form-section">
          <h2>1. Upload Dog Photo</h2>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            required
          />

          <h2>2. Transformation: Aristocratic Portrait</h2>
          <p>
            Your dog will be automatically transformed into an **18th-century
            aristocratic oil painting**.
          </p>

          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Generating...' : 'Generate Portrait'}
          </button>
        </form>

        <div className="result-section">
          <h2>3. Result</h2>
          {error && <p className="error">{error}</p>}
          {isLoading && <div className="loader"></div>}

          {generatedImage && (
            <div className="image-output">
              <img src={generatedImage} alt="Generated Dog Portrait" />
              <p>Your AI masterpiece is complete!</p>
            </div>
          )}

          {!isLoading && !generatedImage && !error && (
            <p>Upload an image to start your AI transformation.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
