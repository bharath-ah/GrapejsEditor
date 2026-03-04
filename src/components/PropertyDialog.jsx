import React, { useEffect, useRef } from "react";

// ─── Property group definitions ────────────────────────────────────────────
const GROUPS = [
  {
    label: "Typography",
    fields: [
      { prop: "font-size", label: "Font Size", type: "text" },
      { prop: "font-family", label: "Font Family", type: "text" },
      { prop: "font-weight", label: "Font Weight", type: "text" },
      { prop: "color", label: "Color", type: "color" },
      {
        prop: "text-align",
        label: "Align",
        type: "select",
        options: ["left", "center", "right", "justify"],
      },
    ],
  },
  {
    label: "Size",
    fields: [
      { prop: "width", label: "Width", type: "text" },
      { prop: "height", label: "Height", type: "text" },
    ],
  },
  {
    label: "Position",
    fields: [
      {
        prop: "position",
        label: "Position",
        type: "select",
        options: ["static", "relative", "absolute", "fixed", "sticky"],
      },
      { prop: "top", label: "Top", type: "text" },
      { prop: "left", label: "Left", type: "text" },
      { prop: "right", label: "Right", type: "text" },
      { prop: "bottom", label: "Bottom", type: "text" },
    ],
  },
  {
    label: "Background",
    fields: [
      { prop: "background-color", label: "Background", type: "color" },
      { prop: "opacity", label: "Opacity", type: "text" },
    ],
  },
  {
    label: "Spacing",
    fields: [
      { prop: "padding", label: "Padding", type: "text" },
      { prop: "padding-top", label: "Padding Top", type: "text" },
      { prop: "padding-right", label: "Padding Right", type: "text" },
      { prop: "padding-bottom", label: "Padding Bottom", type: "text" },
      { prop: "padding-left", label: "Padding Left", type: "text" },
      { prop: "margin", label: "Margin", type: "text" },
    ],
  },
];

// ─── Styles ────────────────────────────────────────────────────────────────
const S = {
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 9998,
    pointerEvents: "none", // clicks pass through to the canvas
  },
  dialog: {
    width: "100%",
    height: "100%",
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    fontSize: 12,
    color: "#cdd6f4",
    pointerEvents: "all",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px 8px",
    borderBottom: "1px solid #44446a",
    fontWeight: 600,
    fontSize: 13,
    color: "#cba6f7",
    background: "#181825",
    borderRadius: "8px 8px 0 0",
    gap: 8,
  },
  tagBadge: {
    background: "#313244",
    borderRadius: 4,
    padding: "1px 6px",
    fontSize: 11,
    color: "#89b4fa",
    fontFamily: "monospace",
  },
  closeBtn: {
    background: "transparent",
    border: "none",
    color: "#6c7086",
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
    padding: 2,
    borderRadius: 4,
  },
  groupHeader: {
    padding: "6px 12px 3px",
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "#6c7086",
    borderTop: "1px solid #313244",
    marginTop: 4,
  },
  row: {
    display: "flex",
    alignItems: "center",
    padding: "3px 12px",
    gap: 6,
  },
  label: {
    flex: "0 0 96px",
    color: "#a6adc8",
    fontSize: 11,
    whiteSpace: "nowrap",
  },
  input: {
    flex: 1,
    background: "#313244",
    border: "1px solid #45475a",
    borderRadius: 4,
    color: "#cdd6f4",
    fontSize: 11,
    padding: "3px 6px",
    outline: "none",
    width: "100%",
    minWidth: 0,
  },
  colorInput: {
    flex: "0 0 32px",
    height: 24,
    padding: 1,
    border: "1px solid #45475a",
    borderRadius: 4,
    background: "transparent",
    cursor: "pointer",
  },
  colorText: {
    flex: 1,
    background: "#313244",
    border: "1px solid #45475a",
    borderRadius: 4,
    color: "#cdd6f4",
    fontSize: 11,
    padding: "3px 6px",
    outline: "none",
  },
  select: {
    flex: 1,
    background: "#313244",
    border: "1px solid #45475a",
    borderRadius: 4,
    color: "#cdd6f4",
    fontSize: 11,
    padding: "3px 4px",
    outline: "none",
  },
  footer: {
    padding: "8px 12px",
    borderTop: "1px solid #313244",
    fontSize: 10,
    color: "#585b70",
    display: "flex",
    alignItems: "center",
    gap: 4,
  },
};

// ─── Helper: parse color to hex (for color inputs) ─────────────────────────
function toHex(cssColor) {
  if (!cssColor || cssColor === "transparent" || cssColor === "rgba(0, 0, 0, 0)") return "#000000";
  if (/^#[0-9a-f]{3,8}$/i.test(cssColor)) return cssColor;
  // Let the browser parse it
  const tmp = document.createElement("div");
  tmp.style.color = cssColor;
  document.body.appendChild(tmp);
  const computed = getComputedStyle(tmp).color;
  document.body.removeChild(tmp);
  const [r, g, b] = computed.match(/\d+/g) || [0, 0, 0];
  return `#${[r, g, b].map((x) => Number(x).toString(16).padStart(2, "0")).join("")}`;
}

// ─── PropertyDialog ─────────────────────────────────────────────────────────
export default function PropertyDialog({ styles, tagName, elementId, onChange, onClose }) {
  // Close on Escape isn't as critical when locked to sidebar, but kept for convenience
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!tagName && !elementId) return null;

  return (
    <div style={S.dialog}>
      {/* Header */}
      <div style={S.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={S.tagBadge}>&lt;{tagName}&gt;</span>
          {elementId && <span style={{ color: "#89dceb", fontSize: 10 }}>#{elementId}</span>}
        </div>
        <button
          style={S.closeBtn}
          onClick={onClose}
          title="Close (Esc)"
        >
          ✕
        </button>
      </div>

      {/* Property Groups */}
      {GROUPS.map((group) => (
        <div key={group.label}>
          <div style={S.groupHeader}>{group.label}</div>
          {group.fields.map(({ prop, label, type, options }) => {
            const raw = styles[prop] ?? "";

            return (
              <div
                key={prop}
                style={S.row}
              >
                <span style={S.label}>{label}</span>

                {type === "color" ? (
                  <>
                    <input
                      type="color"
                      style={S.colorInput}
                      value={toHex(raw)}
                      onChange={(e) => onChange(prop, e.target.value)}
                      title={prop}
                    />
                    <input
                      type="text"
                      style={S.colorText}
                      value={raw}
                      onChange={(e) => onChange(prop, e.target.value)}
                      placeholder="e.g. #fff"
                    />
                  </>
                ) : type === "select" ? (
                  <select
                    style={S.select}
                    value={raw}
                    onChange={(e) => onChange(prop, e.target.value)}
                  >
                    <option value="">—</option>
                    {options.map((o) => (
                      <option
                        key={o}
                        value={o}
                      >
                        {o}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    style={S.input}
                    value={raw}
                    onChange={(e) => onChange(prop, e.target.value)}
                    placeholder="—"
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Footer hint */}
      <div style={S.footer}>
        <span>✎</span> Changes apply instantly
      </div>
    </div>
  );
}
