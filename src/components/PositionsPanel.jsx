import React from "react";

const inputStyle = {
  width: "100%",
  padding: "6px 8px",
  border: "1px solid #e5e7eb",
  borderRadius: "4px",
  fontSize: "12px",
  color: "#374151",
  background: "#fff",
  outline: "none",
  fontFamily: "Inter, sans-serif",
  boxSizing: "border-box",
  textAlign: "center",
};

const labelStyle = {
  fontSize: "10px",
  color: "#6b7280",
  textTransform: "uppercase",
  display: "block",
  marginBottom: "4px",
  textAlign: "center",
  fontWeight: 600,
};

export default function PositionsPanel({ styles = {}, onChange }) {
  // Parsing sizes
  const width = styles["width"] || "auto";
  const height = styles["height"] || "auto";

  // Parsing margins
  const marginTop = styles["margin-top"] || "0px";
  const marginRight = styles["margin-right"] || "0px";
  const marginBottom = styles["margin-bottom"] || "0px";
  const marginLeft = styles["margin-left"] || "0px";

  // Parsing padding
  const paddingTop = styles["padding-top"] || "0px";
  const paddingRight = styles["padding-right"] || "0px";
  const paddingBottom = styles["padding-bottom"] || "0px";
  const paddingLeft = styles["padding-left"] || "0px";

  // Parsing basic layout
  const display = styles["display"] || "block";
  const zIndex = styles["z-index"] || "auto";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", fontFamily: "Inter, sans-serif" }}>
      {/* ─── SIZE & DISPLAY ─── */}
      <div style={{ display: "flex", gap: "10px" }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Width</label>
          <input
            style={inputStyle}
            value={width}
            onChange={(e) => onChange("width", e.target.value)}
            placeholder="auto"
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Height</label>
          <input
            style={inputStyle}
            value={height}
            onChange={(e) => onChange("height", e.target.value)}
            placeholder="auto"
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Display</label>
          <select
            style={{ ...inputStyle, padding: "6px 4px" }}
            value={display}
            onChange={(e) => onChange("display", e.target.value)}
          >
            <option value="block">Block</option>
            <option value="inline-block">In-Block</option>
            <option value="flex">Flex</option>
            <option value="none">None</option>
            <option value="inline">Inline</option>
            <option value="absolute">Absolute</option>
            <option value="relative">Relative</option>
          </select>
        </div>
        <div style={{ flex: 0.8 }}>
          <label style={labelStyle}>Z-Index</label>
          <input
            style={inputStyle}
            type="number"
            value={zIndex === "auto" ? "" : zIndex}
            onChange={(e) => {
              const val = e.target.value;
              onChange("z-index", val === "" ? "auto" : val);
            }}
            placeholder="auto"
          />
        </div>
      </div>

      {/* ─── PADDING ─── */}
      <div>
        <div style={{ fontSize: "11px", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", marginBottom: "8px" }}>Padding</div>
        <div style={{ display: "flex", gap: "8px" }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Top</label>
            <input
              style={inputStyle}
              value={paddingTop}
              onChange={(e) => onChange("padding-top", e.target.value)}
              placeholder="0px"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Right</label>
            <input
              style={inputStyle}
              value={paddingRight}
              onChange={(e) => onChange("padding-right", e.target.value)}
              placeholder="0px"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Bottom</label>
            <input
              style={inputStyle}
              value={paddingBottom}
              onChange={(e) => onChange("padding-bottom", e.target.value)}
              placeholder="0px"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Left</label>
            <input
              style={inputStyle}
              value={paddingLeft}
              onChange={(e) => onChange("padding-left", e.target.value)}
              placeholder="0px"
            />
          </div>
        </div>
      </div>

      {/* ─── MARGIN ─── */}
      <div>
        <div style={{ fontSize: "11px", fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", marginBottom: "8px" }}>Margin</div>
        <div style={{ display: "flex", gap: "8px" }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Top</label>
            <input
              style={inputStyle}
              value={marginTop}
              onChange={(e) => onChange("margin-top", e.target.value)}
              placeholder="0px"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Right</label>
            <input
              style={inputStyle}
              value={marginRight}
              onChange={(e) => onChange("margin-right", e.target.value)}
              placeholder="0px"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Bottom</label>
            <input
              style={inputStyle}
              value={marginBottom}
              onChange={(e) => onChange("margin-bottom", e.target.value)}
              placeholder="0px"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Left</label>
            <input
              style={inputStyle}
              value={marginLeft}
              onChange={(e) => onChange("margin-left", e.target.value)}
              placeholder="0px"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
