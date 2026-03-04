import React, { useState } from "react";

// ---------------------------------------------------------------------------
// Animation type definitions
// Each entry declares what extra fields the user needs to fill in.
// ---------------------------------------------------------------------------
const ANIM_TYPES = [
  { value: "fadeIn", label: "Fade In" },
  { value: "fadeOut", label: "Fade Out" },
  { value: "slideIn", label: "Slide In" },
  { value: "slideOut", label: "Slide Out" },
  { value: "zoomIn", label: "Zoom In" },
  { value: "zoomOut", label: "Zoom Out" },
  { value: "rotate", label: "Rotate" },
  { value: "show", label: "Show (instant)" },
  { value: "hide", label: "Hide (instant)" },
  { value: "colorChange", label: "Color Change" },
];

const DIRECTIONS = ["left", "right", "top", "bottom"];

// ---------------------------------------------------------------------------
// buildVars — converts form state → GSAP vars object (fromVars and toVars)
// ---------------------------------------------------------------------------
function buildVars(type, { direction, offset, degrees, bgColor, textColor }) {
  switch (type) {
    case "fadeIn":
      return { fromVars: { opacity: 0 }, toVars: { opacity: 1, display: "block" } };
    case "fadeOut":
      return { fromVars: { opacity: 1 }, toVars: { opacity: 0, display: "none" } };
    case "slideIn": {
      let x = 0,
        y = 0;
      if (direction === "left") x = -Math.abs(offset);
      if (direction === "right") x = Math.abs(offset);
      if (direction === "top") y = -Math.abs(offset);
      if (direction === "bottom") y = Math.abs(offset);
      return {
        fromVars: { x, y, opacity: 0 },
        toVars: { x: 0, y: 0, opacity: 1, display: "block" },
      };
    }
    case "slideOut": {
      let x = 0,
        y = 0;
      if (direction === "left") x = -Math.abs(offset);
      if (direction === "right") x = Math.abs(offset);
      if (direction === "top") y = -Math.abs(offset);
      if (direction === "bottom") y = Math.abs(offset);
      return {
        fromVars: { x: 0, y: 0, opacity: 1 },
        toVars: { x, y, opacity: 0, display: "none" },
      };
    }
    case "zoomIn":
      return { fromVars: { scaleX: 0, scaleY: 0, opacity: 0 }, toVars: { scaleX: 1, scaleY: 1, opacity: 1, display: "block" } };
    case "zoomOut":
      return { fromVars: { scaleX: 1, scaleY: 1, opacity: 1 }, toVars: { scaleX: 0, scaleY: 0, opacity: 0, display: "none" } };
    case "rotate":
      return { fromVars: { rotation: 0 }, toVars: { rotation: Number(degrees) } };
    case "show":
      return { toVars: { display: "block", opacity: 1 } };
    case "hide":
      return { toVars: { display: "none", opacity: 0 } };
    case "colorChange": {
      const v = {};
      if (bgColor) v.backgroundColor = bgColor;
      if (textColor) v.color = textColor;
      return { toVars: v };
    }
    default:
      return { toVars: {} };
  }
}

// ---------------------------------------------------------------------------
// AnimationPanel
// ---------------------------------------------------------------------------
/**
 * Left-side panel that lets users add a TweenLite animation to the currently
 * selected element.  On "Add Animation" it pushes to __tweenData in-memory
 * and calls rebuildTimeline() so the GSAP timeline updates immediately.
 *
 * Props:
 *   selectedElementId  string             — ID of the selected GrapesJS element
 *   iframeWindowRef    React.MutableRef   — holds .current (iframe window) + .__tweenData
 *   rebuildTimeline    () => void         — call after pushing to __tweenData
 */
export default function AnimationPanel({ selectedElementId, iframeWindowRef, rebuildTimeline }) {
  const [animType, setAnimType] = useState("fadeIn");
  const [startTime, setStartTime] = useState(0);
  const [duration, setDuration] = useState(1);
  const [direction, setDirection] = useState("left");
  const [offset, setOffset] = useState(-300);
  const [degrees, setDegrees] = useState(360);
  const [bgColor, setBgColor] = useState("#ffffff");
  const [textColor, setTextColor] = useState("#000000");
  const [feedback, setFeedback] = useState(null); // { ok, msg }

  const hasElement = !!selectedElementId;

  function handleAdd() {
    if (!hasElement) return;

    const vars = buildVars(animType, { direction, offset, degrees, bgColor, textColor });
    const dur = animType === "show" || animType === "hide" ? 0 : Number(duration);

    const tween = {
      elementId: selectedElementId,
      duration: dur,
      vars,
      position: Number(startTime),
    };

    // Push into the shared tween array
    if (!iframeWindowRef.__tweenData) iframeWindowRef.__tweenData = [];
    iframeWindowRef.__tweenData.push(tween);

    // Rebuild GSAP timeline so the new bar appears immediately
    rebuildTimeline();

    setFeedback({ ok: true, msg: `Added "${ANIM_TYPES.find((a) => a.value === animType)?.label}" to #${selectedElementId}` });
    setTimeout(() => setFeedback(null), 3000);
  }

  // ── Contextual extra fields ──────────────────────────────────────────────
  const showDirection = animType === "slideIn" || animType === "slideOut";
  const showOffset = animType === "slideOut";
  const showDegrees = animType === "rotate";
  const showColors = animType === "colorChange";
  const showDuration = animType !== "show" && animType !== "hide";

  // ── Styles ───────────────────────────────────────────────────────────────
  const panel = {
    background: "#ffffff",
    display: "flex",
    flexDirection: "column",
    fontFamily: "Inter, sans-serif",
    fontSize: "12px",
    color: "#374151",
    overflowY: "auto",
    flexShrink: 0,
  };
  const header = {
    padding: "0 0 10px 0",
    fontWeight: 600,
    fontSize: "13px",
    color: "#111827",
    display: "flex",
    alignItems: "center",
    gap: 8,
  };
  const statusBox = {
    margin: "0",
    padding: "8px 10px",
    borderRadius: 6,
    background: hasElement ? "#eff6ff" : "#f9fafb",
    color: hasElement ? "#1d4ed8" : "#6b7280",
    fontSize: "11px",
    lineHeight: 1.4,
    border: `1px solid ${hasElement ? "#bfdbfe" : "#e5e7eb"}`,
  };
  const label = {
    display: "block",
    marginBottom: 4,
    color: "#6b7280",
    fontSize: "11px",
    fontWeight: 500,
  };
  const input = {
    width: "100%",
    padding: "6px 8px",
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 4,
    color: "#374151",
    fontSize: "12px",
    boxSizing: "border-box",
    outline: "none",
  };
  const select = { ...input, cursor: "pointer", padding: "6px 4px" };
  const fieldWrap = { marginBottom: 12 };
  const btn = {
    margin: "14px 0 0 0",
    padding: "8px 0",
    width: "100%",
    background: hasElement ? "#3b82f6" : "#f3f4f6",
    color: hasElement ? "#ffffff" : "#9ca3af",
    border: "none",
    borderRadius: 6,
    fontWeight: 600,
    fontSize: "13px",
    cursor: hasElement ? "pointer" : "not-allowed",
    transition: "background 0.2s",
  };
  const feedbackBox = {
    margin: "10px 0 0 0",
    padding: "8px 10px",
    borderRadius: 5,
    background: feedback?.ok ? "#ecfdf5" : "#fef2f2",
    color: feedback?.ok ? "#059669" : "#dc2626",
    fontSize: "11px",
    border: `1px solid ${feedback?.ok ? "#a7f3d0" : "#fecaca"}`,
  };
  const form = { padding: "12px 0 0 0" };
  const divider = { borderTop: "1px solid #e5e7eb", margin: "12px 0 12px" };

  return (
    <div style={panel}>
      {/* Header */}
      <div style={header}>
        <span>🎬</span> Animations
      </div>

      {/* Selected element status */}
      <div style={statusBox}>
        {hasElement ? (
          <>
            <strong style={{ color: "#fff" }}>#{selectedElementId}</strong>
            <br />
            Configure animation below
          </>
        ) : (
          "Click an element in the canvas to select it"
        )}
      </div>

      {/* Form */}
      <div style={form}>
        <div style={divider} />

        {/* Animation Type */}
        <div style={fieldWrap}>
          <label style={label}>Animation Type</label>
          <select
            style={select}
            value={animType}
            disabled={!hasElement}
            onChange={(e) => setAnimType(e.target.value)}
          >
            {ANIM_TYPES.map((t) => (
              <option
                key={t.value}
                value={t.value}
              >
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Start Time */}
        <div style={fieldWrap}>
          <label style={label}>Start Time (s)</label>
          <input
            type="number"
            min={0}
            step={0.1}
            style={input}
            value={startTime}
            disabled={!hasElement}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>

        {/* Duration — hidden for Show/Hide */}
        {showDuration && (
          <div style={fieldWrap}>
            <label style={label}>Duration (s)</label>
            <input
              type="number"
              min={0}
              step={0.1}
              style={input}
              value={duration}
              disabled={!hasElement}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
        )}

        {/* Direction — Slide only */}
        {showDirection && (
          <div style={fieldWrap}>
            <label style={label}>Direction</label>
            <select
              style={select}
              value={direction}
              disabled={!hasElement}
              onChange={(e) => setDirection(e.target.value)}
            >
              {DIRECTIONS.map((d) => (
                <option
                  key={d}
                  value={d}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Offset — Slide Out only */}
        {showOffset && (
          <div style={fieldWrap}>
            <label style={label}>Offset (px) — negative = off-screen</label>
            <input
              type="number"
              step={10}
              style={input}
              value={offset}
              disabled={!hasElement}
              onChange={(e) => setOffset(e.target.value)}
            />
          </div>
        )}

        {/* Degrees — Rotate only */}
        {showDegrees && (
          <div style={fieldWrap}>
            <label style={label}>Degrees</label>
            <input
              type="number"
              step={45}
              style={input}
              value={degrees}
              disabled={!hasElement}
              onChange={(e) => setDegrees(e.target.value)}
            />
          </div>
        )}

        {/* Colors — Color Change only */}
        {showColors && (
          <>
            <div style={fieldWrap}>
              <label style={label}>Background Color</label>
              <input
                type="color"
                style={{ ...input, padding: 2, height: 32, cursor: "pointer" }}
                value={bgColor}
                disabled={!hasElement}
                onChange={(e) => setBgColor(e.target.value)}
              />
            </div>
            <div style={fieldWrap}>
              <label style={label}>Text Color</label>
              <input
                type="color"
                style={{ ...input, padding: 2, height: 32, cursor: "pointer" }}
                value={textColor}
                disabled={!hasElement}
                onChange={(e) => setTextColor(e.target.value)}
              />
            </div>
          </>
        )}
      </div>

      {/* Add button */}
      <button
        style={btn}
        disabled={!hasElement}
        onClick={handleAdd}
      >
        + Add Animation
      </button>

      {/* Feedback toast */}
      {feedback && <div style={feedbackBox}>{feedback.msg}</div>}
    </div>
  );
}
