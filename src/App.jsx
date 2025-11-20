import React, { useState, useCallback } from "react";
import { RefreshCcw, Film } from "lucide-react";

const API_KEY = "AIzaSyBYqvZQ-6bMq1wH3_mliN2jD-cVIyOIndQ";

// Gemini Configuration Constants
const API_CONFIG = {
  apiKey: "",
  baseApiUrl:
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent",
};

// Utility function for exponential backoff during API calls
const fetchWithBackoff = async (url, options, maxRetries = 5) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) {
          throw new Error(`Server error: ${response.status}`);
        }
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(
          `API error: ${response.status} - ${
            errorBody.error?.message || "Unknown error"
          }`
        );
      }
      return response;
    } catch (error) {
      if (attempt === maxRetries - 1) {
        console.error("Fetch failed after multiple retries:", error);
        throw error;
      }
      // Calculate delay: 2^attempt * 1000ms
      const delay =
        Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 1000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

const App = () => {
  const [userPrompt, setUserPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [sources, setSources] = useState([]);

  // System instruction to guide the model's response structure and persona
  const systemPrompt = `You are a world-class Movie and TV Show recommender. Your task is to analyze the user's request and provide one highly relevant recommendation with a short, compelling pitch and the year of release. Since you are initially searching the web, format your final response strictly as:
  **Recommendation:** [Movie Title] ([Year])
  **Pitch:** [2-3 sentence summary/pitch based on the user's prompt]
  `;

  const handleRecommendation = useCallback(async () => {
    if (!userPrompt.trim()) {
      setErrorMessage(
        "Please enter a genre, theme, or specific request for a recommendation."
      );
      return;
    }

    // Check if the API key is available before proceeding (now it checks your manually entered key)
    if (API_KEY === "YOUR_GEMINI_API_KEY_HERE" || !API_KEY.trim()) {
      setErrorMessage(
        "API Key is missing. Please insert your key into src/App.jsx to proceed."
      );
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setAiResponse(null);
    setSources([]);

    // Construct the final API URL with the key appended as a query parameter
    const apiUrlWithKey = `${API_CONFIG.baseApiUrl}?key=${API_KEY}`;

    const payload = {
      contents: [{ parts: [{ text: userPrompt }] }],
      // Enable Google Search grounding to give the model access to real-time movie data
      tools: [{ google_search: {} }],
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
    };

    try {
      const response = await fetchWithBackoff(apiUrlWithKey, {
        method: "POST",
        // Do not include the key in the headers when using it in the URL
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      const candidate = result.candidates?.[0];

      if (candidate && candidate.content?.parts?.[0]?.text) {
        const text = candidate.content.parts[0].text;
        setAiResponse(text);

        // Extract grounding sources
        let newSources = [];
        const groundingMetadata = candidate.groundingMetadata;
        if (groundingMetadata && groundingMetadata.groundingAttributions) {
          newSources = groundingMetadata.groundingAttributions
            .map((attribution) => ({
              uri: attribution.web?.uri,
              title: attribution.web?.title,
            }))
            .filter((source) => source.uri && source.title);
        }
        setSources(newSources);
      } else {
        setErrorMessage(
          "The AI model returned an empty response. Please try a different query."
        );
      }
    } catch (error) {
      console.error("Gemini API Error:", error);
      setErrorMessage(`Failed to fetch recommendation: ${error.message}.`);
    } finally {
      setLoading(false);
    }
  }, [userPrompt, systemPrompt]);

  // Helper component to render the response and sources
  const RecommendationDisplay = () => {
    if (!aiResponse) return null;

    return (
      // Using generic class names that are defined in index.css
      <div className="result-area">
        <h3 className="result-title flex items-center">
          <Film
            style={{ width: "1.5rem", height: "1.5rem", marginRight: "0.5rem" }}
          />
          Your Recommendation
        </h3>
        <div
          className="result-content"
          dangerouslySetInnerHTML={{
            __html: aiResponse
              .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
              .replace(/\n/g, "<br/>"),
          }}
        />

        {sources.length > 0 && (
          <div className="sources-container">
            <p style={{ fontWeight: "600", marginBottom: "0.5rem" }}>
              Sources Referenced:
            </p>
            <ul>
              {sources.map((source, index) => (
                <li
                  key={index}
                  style={{
                    listStyleType: "disc",
                    marginLeft: "1.25rem",
                    marginTop: "0.25rem",
                  }}
                >
                  <a
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="source-link"
                  >
                    {source.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1 className="title">AI Movie Recommender</h1>
        <p className="subtitle">
          Connects user prompts to the Gemini API for smart, grounded movie
          suggestions.
        </p>
      </header>

      <main>
        <div className="input-group">
          <label htmlFor="prompt" className="label">
            What kind of movie or show are you looking for?
          </label>
          <textarea
            id="prompt"
            rows="3"
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="e.g., A gritty sci-fi movie with moral ambiguity, or, I need a feel-good comedy from the 2000s."
            className="textarea-input"
            disabled={loading}
          ></textarea>

          <div className="action-row">
            <button
              onClick={handleRecommendation}
              disabled={loading}
              className={`button-base submit-button`}
            >
              {loading ? (
                // Using CSS classes for the loading spinner
                <>
                  <div className="loading-spinner"></div>
                  Generating Suggestion...
                </>
              ) : (
                "Get My Recommendation"
              )}
            </button>

            {/* Keeping the refresh button structure but simplifying the class */}
            <button
              onClick={() => {
                setUserPrompt("");
                setAiResponse(null);
                setErrorMessage("");
                setSources([]);
              }}
              className="button-base refresh-button"
              disabled={loading}
              aria-label="Clear Prompt and Results"
            >
              <RefreshCcw style={{ width: "1.25rem", height: "1.25rem" }} />
            </button>
          </div>
        </div>

        {errorMessage && (
          <div className="message-box message-box-error">
            Error: {errorMessage}
          </div>
        )}

        {/* Display the AI Recommendation and Sources */}
        <RecommendationDisplay />
      </main>
    </div>
  );
};

export default App;
