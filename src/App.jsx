import React, { useState } from "react";
import BannerEditor from "./BannerEditor";

function App() {
  const [rawHtml, setRawHtml] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);
  const [fileName, setFileName] = useState("");

  // Handle HTML file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Allow only HTML files
    if (!file.name.endsWith(".html")) {
      alert("Please upload only an HTML file (index.html)");
      return;
    }

    setFileName(file.name);

    const reader = new FileReader();

    reader.onload = (event) => {
      setRawHtml(event.target.result); // store HTML content
    };

    reader.readAsText(file);
  };

  if (isLoaded && rawHtml) {
    return (
      <BannerEditor htmlContent={rawHtml} onBack={() => setIsLoaded(false)} />
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
      <h1 style={{ color: "#111827", marginBottom: "8px" }}>
        Upload Animated Banner HTML
      </h1>

      <p style={{ color: "#6b7280", marginBottom: "24px" }}>
        Upload your <b>index.html</b> file to edit.
      </p>

      {/* Upload HTML file */}
      <input
        type="file"
        accept=".html"
        onChange={handleFileUpload}
        style={{
          marginBottom: "20px",
          padding: "10px",
          border: "1px solid #d1d5db",
          borderRadius: "6px",
          background: "#ffffff",
        }}
      />

      {/* Show uploaded file name */}
      {fileName && (
        <p style={{ color: "#4b5563", marginBottom: "10px" }}>
          Uploaded File: <b>{fileName}</b>
        </p>
      )}

      {/* Load Editor Button */}
      <button
        onClick={() => setIsLoaded(true)}
        disabled={!rawHtml.trim()}
        style={{
          marginTop: "20px",
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
