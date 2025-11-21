import React, { useState, useCallback } from "react";
import { RefreshCcw, Film } from "lucide-react";

// Use the API key from .env
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Gemini Configuration Constants
const API_CONFIG = {
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
      if (attempt === maxRetries - 1) throw error;
      const delay = Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 1000);
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

    if (!API_KEY) {
      setErrorMessage(
        "API Key is missing. Please add your key to the .env file."
      );
      return;
    }

    setLoading(true);
    setErrorMessage("");
    setAiResponse(null);
    setSources([]);

    const apiUrlWithKey = `${API_CONFIG.baseApiUrl}?key=${API_KEY}`;
    const payload = {
      contents: [{ parts: [{ text: userPrompt }] }],
      tools: [{ google_search: {} }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
    };

    try {
      const response = await fetchWithBackoff(apiUrlWithKey, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      const candidate = result.candidates?.[0];

      if (candidate && candidate.content?.parts?.[0]?.text) {
        setAiResponse(candidate.content.parts[0].text);

        // Extract grounding sources
        const newSources = candidate.groundingMetadata?.groundingAttributions
          ?.map((a) => ({ uri: a.web?.uri, title: a.web?.title }))
          ?.filter((s) => s.uri && s.title) || [];

        setSources(newSources);
      } else {
        setErrorMessage("The AI model returned an empty response.");
      }
    } catch (error) {
      console.error("Gemini API Error:", error);
      setErrorMessage(`Failed to fetch recommendation: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [userPrompt, systemPrompt]);

  const RecommendationDisplay = () => {
    if (!aiResponse) return null;
    return (
      <div className="result-area">
        <h3 className="result-title flex items-center">
          <Film style={{ width: "1.5rem", height: "1.5rem", marginRight: "0.5rem" }} />
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
            <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>
              Sources Referenced:
            </p>
            <ul>
              {sources.map((source, i) => (
                <li key={i} style={{ listStyleType: "disc", marginLeft: "1.25rem", marginTop: "0.25rem" }}>
                  <a href={source.uri} target="_blank" rel="noopener noreferrer" className="source-link">
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
        <p className="subtitle">Connects user prompts to the Gemini API for smart, grounded movie suggestions.</p>
      </header>

      <main>
        <div className="input-group">
          <label htmlFor="prompt" className="label">
            What kind of movie or show are you looking for?
          </label>
          <textarea
            id="prompt"
            rows={3}
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)}
            placeholder="e.g., A gritty sci-fi movie with moral ambiguity, or, I need a feel-good comedy from the 2000s."
            className="textarea-input"
            disabled={loading}
          />

          <div className="action-row">
            <button
              onClick={handleRecommendation}
              disabled={loading}
              className="button-base submit-button"
            >
              {loading ? (
                <>
                  <div className="loading-spinner"></div>
                  Generating Suggestion...
                </>
              ) : (
                "Get My Recommendation"
              )}
            </button>

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

        {errorMessage && <div className="message-box message-box-error">Error: {errorMessage}</div>}

        <RecommendationDisplay />
      </main>
    </div>
  );
};

export default App;
