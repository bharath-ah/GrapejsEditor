import React, { useState, useEffect, useRef } from "react";

// All recognisable tween property fields and their display labels / input types
const PROP_FIELDS = [
  { key: "opacity", label: "Opacity", type: "number", step: 0.1, min: 0, max: 1 },
  { key: "left", label: "Left", type: "text" },
  { key: "top", label: "Top", type: "text" },
  { key: "right", label: "Right", type: "text" },
  { key: "bottom", label: "Bottom", type: "text" },
  { key: "scaleX", label: "Scale X", type: "number", step: 0.1 },
  { key: "scaleY", label: "Scale Y", type: "number", step: 0.1 },
  { key: "rotation", label: "Rotation (deg)", type: "number", step: 1 },
  { key: "backgroundColor", label: "Background Color", type: "color" },
  { key: "color", label: "Text Color", type: "color" },
  { key: "display", label: "Display", type: "text" },
  { key: "width", label: "Width", type: "text" },
  { key: "height", label: "Height", type: "text" },
];

/**
 * AnimationSegmentModal
 *
 * Shows a floating modal when the user clicks a segment bar on the timeline.
 * Displays & lets the user edit all tween properties for that segment.
 *
 * Props:
 *   segment        { start, duration, vars, tweenIndex, elementId }
 *   anchorPos      { x, y }  — page coords near which to position the modal
 *   iframeWindowRef           — to update __tweenData[tweenIndex] on save
 *   rebuildTimeline ()=>void  — called after saving
 *   onClose        ()=>void   — called when user dismisses
 */
export default function AnimationSegmentModal({ segment, anchorPos, iframeWindowRef, rebuildTimeline, onClose, onDelete }) {
  const [startTime, setStartTime] = useState(segment.start);
  const [duration, setDuration] = useState(segment.duration);
  const [vars, setVars] = useState({ ...segment.vars });
  const [saved, setSaved] = useState(false);
  const overlayRef = useRef(null);

  // Collect only the fields that exist in this tween's vars (+ always show timing)
  const presentFields = PROP_FIELDS.filter((f) => f.key in vars);
  // Always include any vars keys not covered by PROP_FIELDS
  const knownKeys = new Set(PROP_FIELDS.map((f) => f.key));
  const extraKeys = Object.keys(vars).filter((k) => !knownKeys.has(k));

  // ── opacity → display auto-rule ─────────────────────────────────────────
  function handleVarChange(key, rawVal) {
    setVars((prev) => {
      const next = { ...prev, [key]: rawVal };
      if (key === "opacity") {
        const num = parseFloat(rawVal);
        if (!isNaN(num)) {
          next.display = num <= 0 ? "none" : "block";
        }
      }
      return next;
    });
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  function handleSave() {
    const td = iframeWindowRef.__tweenData;
    if (!td || segment.tweenIndex < 0 || segment.tweenIndex >= td.length) return;

    td[segment.tweenIndex] = {
      ...td[segment.tweenIndex],
      duration: Number(duration),
      position: Number(startTime),
      vars,
    };
    rebuildTimeline();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // ── Delete ───────────────────────────────────────────────────────────────
  function handleDelete() {
    if (onDelete) {
      onDelete();
      onClose(); // close modal after deletion
    }
  }

  // ── Close on overlay click ────────────────────────────────────────────────
  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose();
  }

  // ── Position modal near the bar ──────────────────────────────────────────
  const MODAL_W = 280;
  const MODAL_H = 360; // approximate
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = anchorPos.x + 10;
  let top = anchorPos.y - 40;
  if (left + MODAL_W > vw) left = anchorPos.x - MODAL_W - 10;
  if (top + MODAL_H > vh) top = vh - MODAL_H - 10;
  if (top < 8) top = 8;

  // ── Styles ───────────────────────────────────────────────────────────────
  const s = {
    overlay: {
      position: "fixed",
      inset: 0,
      zIndex: 99999,
      background: "transparent",
    },
    modal: {
      position: "fixed",
      left,
      top,
      width: MODAL_W,
      maxHeight: "80vh",
      overflowY: "auto",
      background: "#ffffff",
      border: "1px solid #e5e7eb",
      borderRadius: 8,
      boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
      fontFamily: "Inter, sans-serif",
      fontSize: 12,
      color: "#374151",
      zIndex: 100000,
    },
    header: {
      background: "#f9fafb",
      padding: "10px 12px",
      borderBottom: "1px solid #e5e7eb",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: "8px 8px 0 0",
    },
    title: { fontWeight: 700, fontSize: 13, color: "#111827" },
    actionBtns: {
      display: "flex",
      gap: "8px",
      alignItems: "center",
    },
    closeBtn: {
      background: "none",
      border: "none",
      color: "#9ca3af",
      fontSize: 18,
      cursor: "pointer",
      lineHeight: 1,
      padding: 0,
    },
    deleteBtn: {
      background: "rgba(248, 113, 113, 0.15)",
      border: "1px solid rgba(248, 113, 113, 0.3)",
      color: "#f87171",
      fontSize: 14,
      cursor: "pointer",
      lineHeight: 1,
      padding: "3px 6px",
      borderRadius: "4px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginRight: "4px",
    },
    body: { padding: "10px 12px" },
    section: { fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, marginTop: 10, fontWeight: 600 },
    row: { marginBottom: 8 },
    label: { display: "block", color: "#6b7280", fontSize: 11, marginBottom: 3 },
    input: {
      width: "100%",
      padding: "6px 8px",
      background: "#ffffff",
      border: "1px solid #d1d5db",
      borderRadius: 4,
      color: "#374151",
      fontSize: 12,
      boxSizing: "border-box",
      outline: "none",
    },
    colorInput: {
      width: "100%",
      height: 30,
      padding: 2,
      background: "#ffffff",
      border: "1px solid #d1d5db",
      borderRadius: 4,
      cursor: "pointer",
      boxSizing: "border-box",
    },
    divider: { borderTop: "1px solid #e5e7eb", margin: "8px 0" },
    saveBtn: {
      width: "100%",
      padding: "8px 0",
      marginTop: 10,
      background: "#4f46e5",
      color: "#fff",
      border: "none",
      borderRadius: 6,
      fontWeight: 700,
      fontSize: 12,
      cursor: "pointer",
    },
    savedMsg: {
      textAlign: "center",
      color: "#10b981",
      fontSize: 11,
      marginTop: 6,
    },
    chip: {
      display: "inline-block",
      background: "#f3f4f6",
      color: "#4f46e5",
      borderRadius: 4,
      padding: "2px 6px",
      fontSize: 11,
      fontWeight: 700,
      marginRight: 4,
      border: "1px solid #e5e7eb",
    },
  };

  return (
    <div
      ref={overlayRef}
      style={s.overlay}
      onMouseDown={handleOverlayClick}
    >
      <div
        style={s.modal}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={s.header}>
          <span style={s.title}>✏️ Animation Properties</span>
          <div style={s.actionBtns}>
            <button
              style={s.deleteBtn}
              onClick={handleDelete}
              title="Delete Animation"
            >
              🗑️
            </button>
            <button
              style={s.closeBtn}
              onClick={onClose}
              title="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div style={s.body}>
          {/* Element info */}
          <div style={{ marginBottom: 8 }}>
            <span style={s.chip}>#{segment.elementId}</span>
            <span style={{ fontSize: 11, color: "#666" }}>tween #{segment.tweenIndex}</span>
          </div>

          {/* Timing */}
          <div style={s.section}>Timing</div>
          <div style={s.row}>
            <label style={s.label}>Start Time (s)</label>
            <input
              type="number"
              min={0}
              step={0.1}
              style={s.input}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div style={s.row}>
            <label style={s.label}>Duration (s)</label>
            <input
              type="number"
              min={0}
              step={0.1}
              style={s.input}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>

          <div style={s.divider} />

          {/* Known property fields present in vars */}
          {presentFields.length > 0 && (
            <>
              <div style={s.section}>Properties</div>
              {presentFields.map((field) => (
                <div
                  key={field.key}
                  style={s.row}
                >
                  <label style={s.label}>{field.label}</label>
                  <input
                    type={field.type === "color" ? "color" : "text"}
                    step={field.step}
                    style={field.type === "color" ? s.colorInput : s.input}
                    value={vars[field.key] ?? ""}
                    onChange={(e) => handleVarChange(field.key, e.target.value)}
                  />
                </div>
              ))}
            </>
          )}

          {/* Extra / unknown vars (e.g. display, onComplete etc.) */}
          {extraKeys.length > 0 && (
            <>
              <div style={s.section}>Other</div>
              {extraKeys.map((key) => {
                const isObj = typeof vars[key] === "object" && vars[key] !== null;
                const displayVal = isObj ? JSON.stringify(vars[key]) : String(vars[key] ?? "");
                return (
                  <div
                    key={key}
                    style={s.row}
                  >
                    <label style={s.label}>
                      {key} {isObj && "(read-only)"}
                    </label>
                    <input
                      type="text"
                      style={s.input}
                      value={displayVal}
                      readOnly={isObj}
                      onChange={(e) => {
                        if (!isObj) handleVarChange(key, e.target.value);
                      }}
                    />
                  </div>
                );
              })}
            </>
          )}

          <button
            style={s.saveBtn}
            onClick={handleSave}
          >
            💾 Save &amp; Rebuild Timeline
          </button>
          {saved && <div style={s.savedMsg}>✓ Saved!</div>}
        </div>
      </div>
    </div>
  );
}
