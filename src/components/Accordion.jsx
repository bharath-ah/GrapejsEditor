import React, { useState } from "react";

export default function Accordion({ title, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div style={{ borderBottom: "1px solid #e0e0e0", padding: "12px 16px" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: "600",
          color: "#4a4a4a",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <span>{title}</span>
        <div
          style={{
            width: "20px",
            height: "20px",
            border: "1px solid #dcdcdc",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
            color: "#333",
            lineHeight: 1,
            background: "#fff",
          }}
        >
          {isOpen ? "−" : "+"}
        </div>
      </button>

      {isOpen && <div style={{ paddingTop: "16px" }}>{children}</div>}
    </div>
  );
}
