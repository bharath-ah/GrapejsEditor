import React from "react";
import ColorPickerInput from "./ColorPickerInput";

// Helper: parse color to hex
function toHex(cssColor) {
  if (!cssColor || cssColor === "transparent" || cssColor === "rgba(0, 0, 0, 0)") return "#000000";
  if (/^#[0-9a-f]{3,8}$/i.test(cssColor)) return cssColor;

  const tmp = document.createElement("div");
  tmp.style.color = cssColor;
  document.body.appendChild(tmp);
  const computed = getComputedStyle(tmp).color;
  document.body.removeChild(tmp);
  const [r, g, b] = computed.match(/\d+/g) || [0, 0, 0];
  return `#${[r, g, b].map((x) => Number(x).toString(16).padStart(2, "0")).join("")}`;
}

const inputStyle = {
  width: "100%",
  padding: "8px 12px",
  border: "1px solid #e5e7eb",
  borderRadius: "6px",
  fontSize: "12px",
  color: "#374151",
  background: "#fff",
  outline: "none",
  fontFamily: "Inter, sans-serif",
  boxSizing: "border-box",
};

const iconBtnStyle = {
  flex: 1,
  padding: "8px 0",
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "6px",
  cursor: "pointer",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  color: "#374151",
  fontSize: "14px",
};

export default function TextStylePanel({ styles = {}, onChange }) {
  // Extract specific properties we care about
  const fontFamily = styles["font-family"] || "Arial";
  const fontWeight = styles["font-weight"] || "normal";
  const fontSize = styles["font-size"] || "14px";
  const color = styles["color"] || "#000000";
  const textAlign = styles["text-align"] || "left";

  // Fake opacity extraction for mockup accuracy, since true opacity might be inherited or mixed
  const opacityVal = styles["opacity"] !== undefined ? Math.round(parseFloat(styles["opacity"]) * 100) : 100;

  const textDecoration = styles["text-decoration"] || "none";
  const fontStyle = styles["font-style"] || "normal";
  const textTransform = styles["text-transform"] || "none";

  const handleAlign = (align) => onChange("text-align", align);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontFamily: "Inter, sans-serif" }}>
      {/* Font Family */}
      <div>
        <select
          style={inputStyle}
          value={fontFamily.replace(/['"]/g, "").split(",")[0]} // simplify complex fonts for dropdown
          onChange={(e) => onChange("font-family", e.target.value)}
        >
          <option value="Arial">Arial</option>
          <option value="Helvetica">Helvetica</option>
          <option value="Times New Roman">Times New Roman</option>
          <option value="Courier New">Courier New</option>
          <option value="Verdana">Verdana</option>
          <option value="Georgia">Georgia</option>
          <option value="Palatino">Palatino</option>
          <option value="Garamond">Garamond</option>
          <option value="Bookman">Bookman</option>
          <option value="Comic Sans MS">Comic Sans MS</option>
          <option value="Trebuchet MS">Trebuchet MS</option>
          <option value="Arial Black">Arial Black</option>
          <option value="Impact">Impact</option>
        </select>
      </div>

      {/* Weight & Size */}
      <div style={{ display: "flex", gap: "10px" }}>
        <select
          style={{ ...inputStyle, flex: 1 }}
          value={fontWeight}
          onChange={(e) => onChange("font-weight", e.target.value)}
        >
          <option value="normal">Regular</option>
          <option value="bold">Bold</option>
          <option value="bolder">Bolder</option>
          <option value="lighter">Lighter</option>
          <option value="100">100</option>
          <option value="200">200</option>
          <option value="300">300</option>
          <option value="400">400 (Regular)</option>
          <option value="500">500 (Medium)</option>
          <option value="600">600 (Semi-Bold)</option>
          <option value="700">700 (Bold)</option>
          <option value="800">800</option>
          <option value="900">900 (Black)</option>
        </select>

        <input
          style={{ ...inputStyle, flex: 1 }}
          type="text"
          value={fontSize}
          onChange={(e) => onChange("font-size", e.target.value)}
          placeholder="14px"
        />
      </div>

      {/* Color Box & Hex & Opacity */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <ColorPickerInput
            color={toHex(color)}
            onChange={(newColor) => onChange("color", newColor)}
          />
        </div>

        {/* Opacity Slider */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "#9ca3af", width: "45px" }}>Opacity</span>
          <input
            type="range"
            min="0"
            max="100"
            value={opacityVal}
            onChange={(e) => onChange("opacity", (e.target.value / 100).toString())}
            style={{ flex: 1, accentColor: "#4f46e5", margin: 0 }}
          />
          <span style={{ fontSize: "11px", color: "#374151", minWidth: "28px", textAlign: "right" }}>{opacityVal}%</span>
        </div>
      </div>

      {/* Alignment (4 buttons) */}
      <div style={{ display: "flex", gap: "6px" }}>
        <button
          style={{ ...iconBtnStyle, background: textAlign === "left" ? "#f3f4f6" : "#fff" }}
          onClick={() => handleAlign("left")}
          title="Align Left"
        >
          <span style={{ fontWeight: 900, fontSize: "16px", marginTop: "-4px" }}>≡</span>
        </button>
        <button
          style={{ ...iconBtnStyle, background: textAlign === "center" ? "#f3f4f6" : "#fff" }}
          onClick={() => handleAlign("center")}
          title="Align Center"
        >
          <span style={{ fontWeight: 900, fontSize: "16px", marginTop: "-4px" }}>≡</span>
        </button>
        <button
          style={{ ...iconBtnStyle, background: textAlign === "right" ? "#f3f4f6" : "#fff" }}
          onClick={() => handleAlign("right")}
          title="Align Right"
        >
          <span style={{ fontWeight: 900, fontSize: "16px", marginTop: "-4px" }}>≡</span>
        </button>
        <button
          style={{ ...iconBtnStyle, background: textAlign === "justify" ? "#f3f4f6" : "#fff" }}
          onClick={() => handleAlign("justify")}
          title="Justify"
        >
          <span style={{ fontWeight: 900, fontSize: "16px", marginTop: "-4px" }}>≡</span>
        </button>
      </div>

      {/* Text Decoration / Style (Bold, Italic, Uppercase, Underline, Strikethrough) */}
      <div style={{ display: "flex", gap: "6px" }}>
        <button
          style={{ ...iconBtnStyle, fontWeight: "bold", background: fontWeight === "bold" || fontWeight > 400 ? "#f3f4f6" : "#fff" }}
          onClick={() => onChange("font-weight", fontWeight === "bold" ? "normal" : "bold")}
        >
          B
        </button>
        <button
          style={{ ...iconBtnStyle, fontStyle: "italic", background: fontStyle === "italic" ? "#f3f4f6" : "#fff" }}
          onClick={() => onChange("font-style", fontStyle === "italic" ? "normal" : "italic")}
        >
          I
        </button>
        <button
          style={{ ...iconBtnStyle, background: textTransform === "uppercase" ? "#f3f4f6" : "#fff" }}
          onClick={() => onChange("text-transform", textTransform === "uppercase" ? "none" : "uppercase")}
        >
          AA
        </button>
        <button
          style={{ ...iconBtnStyle, textDecoration: "underline", background: textDecoration === "underline" ? "#f3f4f6" : "#fff" }}
          onClick={() => onChange("text-decoration", textDecoration === "underline" ? "none" : "underline")}
        >
          U
        </button>
        <button
          style={{ ...iconBtnStyle, textDecoration: "line-through", background: textDecoration === "line-through" ? "#f3f4f6" : "#fff" }}
          onClick={() => onChange("text-decoration", textDecoration === "line-through" ? "none" : "line-through")}
        >
          S
        </button>
      </div>
    </div>
  );
}
