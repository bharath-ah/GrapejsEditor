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

export default function FillStrokePanel({ styles = {}, onChange }) {
  // Fill properties
  const bgColor = styles["background-color"] || "transparent";

  // Fake opacity logic similar to TextStylePanel
  const bgOpacityVal = styles["opacity"] !== undefined ? Math.round(parseFloat(styles["opacity"]) * 100) : 100;

  // Stroke properties
  const borderWidth = styles["border-width"] || "0px";
  const borderStyle = styles["border-style"] || "none";
  const borderColor = styles["border-color"] || "#000000";
  const borderRadius = styles["border-radius"] || "0px";

  // Shadow properties
  const boxShadow = styles["box-shadow"] || "none";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", fontFamily: "Inter, sans-serif", paddingBottom: "8px" }}>
      {/* ─── FILL SECTION ─── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label style={{ fontSize: "11px", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" }}>Fill (Background)</label>

        {/* Color Box & Hex & Opacity */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <ColorPickerInput
              color={bgColor === "transparent" || bgColor === "rgba(0, 0, 0, 0)" ? "" : toHex(bgColor)}
              onChange={(newColor) => onChange("background-color", newColor)}
            />
          </div>

          {/* Opacity Slider */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "#9ca3af", width: "45px" }}>Opacity</span>
            <input
              type="range"
              min="0"
              max="100"
              value={bgOpacityVal}
              onChange={(e) => onChange("opacity", (e.target.value / 100).toString())}
              style={{ flex: 1, accentColor: "#4f46e5", margin: 0 }}
            />
            <span style={{ fontSize: "11px", color: "#374151", minWidth: "28px", textAlign: "right" }}>{bgOpacityVal}%</span>
          </div>
        </div>
      </div>

      {/* ─── STROKE SECTION ─── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label style={{ fontSize: "11px", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" }}>Stroke (Border)</label>

        {/* Stroke Style & Width */}
        <div style={{ display: "flex", gap: "10px" }}>
          <select
            style={{ ...inputStyle, flex: 1 }}
            value={borderStyle}
            onChange={(e) => onChange("border-style", e.target.value)}
          >
            <option value="none">None</option>
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
            <option value="double">Double</option>
          </select>

          <input
            style={{ ...inputStyle, flex: 1 }}
            type="text"
            value={borderWidth}
            onChange={(e) => onChange("border-width", e.target.value)}
            placeholder="0px"
          />
        </div>

        {/* Stroke Color */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
            <ColorPickerInput
              color={toHex(borderColor)}
              onChange={(newColor) => onChange("border-color", newColor)}
              disabled={borderStyle === "none"}
            />
          </div>
        </div>

        {/* Border Radius */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
          <label style={{ fontSize: "10px", color: "#6b7280" }}>Border Radius</label>
          <input
            style={inputStyle}
            type="text"
            value={borderRadius}
            onChange={(e) => onChange("border-radius", e.target.value)}
            placeholder="0px or 50%"
          />
        </div>
      </div>

      {/* ─── SHADOW SECTION ─── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label style={{ fontSize: "11px", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" }}>Effects</label>

        {/* Box Shadow */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "10px", color: "#6b7280" }}>Box Shadow</label>
          <input
            style={inputStyle}
            type="text"
            value={boxShadow}
            onChange={(e) => onChange("box-shadow", e.target.value)}
            placeholder="0px 4px 6px rgba(0,0,0,0.1)"
          />
        </div>
      </div>
    </div>
  );
}
