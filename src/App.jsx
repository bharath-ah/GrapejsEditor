import React, { useState } from "react";
import BannerEditor from "./BannerEditor";

function App() {
  const [rawHtml, setRawHtml] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  if (isLoaded && rawHtml) {
    return (
      <BannerEditor
        htmlContent={rawHtml}
        onBack={() => setIsLoaded(false)}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        background: "#f9fafb",
        color: "#374151",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <h1 style={{ color: "#111827", marginBottom: "8px" }}>Load Animated Banner HTML</h1>
      <p style={{ color: "#6b7280", marginBottom: "24px" }}>Paste your Adobe Animate or custom GSAP HTML file below to edit.</p>

      <textarea
        value={rawHtml}
        onChange={(e) => setRawHtml(e.target.value)}
        placeholder="<!DOCTYPE html>&#10;<html>&#10;  <head>...</head>&#10;  <body>...</body>&#10;</html>"
        style={{
          width: "100%",
          maxWidth: "800px",
          height: "400px",
          background: "#ffffff",
          color: "#374151",
          border: "1px solid #d1d5db",
          borderRadius: "8px",
          padding: "16px",
          fontFamily: "monospace",
          fontSize: "13px",
          resize: "none",
          outline: "none",
          boxShadow: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)",
        }}
      />
      <button
        onClick={() => setIsLoaded(true)}
        disabled={!rawHtml.trim()}
        style={{
          marginTop: "24px",
          padding: "12px 32px",
          background: rawHtml.trim() ? "#4f46e5" : "#e5e7eb",
          color: rawHtml.trim() ? "#ffffff" : "#9ca3af",
          border: "none",
          borderRadius: "8px",
          fontSize: "16px",
          cursor: rawHtml.trim() ? "pointer" : "not-allowed",
          fontWeight: "bold",
          transition: "background 0.2s",
        }}
      >
        Load Editor
      </button>
    </div>
  );
}

export default App;
