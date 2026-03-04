import React, { useState, useRef, useEffect } from "react";
import { HexColorPicker } from "react-colorful";

/**
 * A beautiful composite color input that combines a solid color swatch
 * and a hex text input field. Clicking the swatch opens a floating
 * interactive color palette powered by react-colorful.
 */
export default function ColorPickerInput({ color, onChange, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);

  // Close the popup when clicking outside of it
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  const fallbackColor = color || "#000000";

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* Input container bridging the swatch and the hex input */}
      <div
        style={{
          display: "flex",
          width: "100%",
          border: "1px solid #e5e7eb",
          borderRadius: "6px",
          overflow: "hidden",
          background: disabled ? "#f9fafb" : "#fff",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {/* Color Swatch (Trigger) */}
        <div
          onClick={() => {
            if (!disabled) setIsOpen(!isOpen);
          }}
          style={{
            width: "32px",
            height: "32px",
            backgroundColor: fallbackColor,
            cursor: disabled ? "not-allowed" : "pointer",
            borderRight: "1px solid #e5e7eb",
          }}
        />

        {/* Text Hex Input */}
        <input
          type="text"
          value={disabled ? "" : fallbackColor.toUpperCase()}
          onChange={(e) => {
            if (!disabled) onChange(e.target.value);
          }}
          disabled={disabled}
          placeholder={disabled ? "No Color" : "#000000"}
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            padding: "0 8px",
            fontSize: "12px",
            textTransform: "uppercase",
            fontFamily: "Inter, sans-serif",
            background: "transparent",
            color: disabled ? "#9ca3af" : "#374151",
          }}
        />
      </div>

      {/* Floating interactive Color Palette Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            left: 0,
            zIndex: 9999,
            padding: "8px",
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
          }}
        >
          <HexColorPicker
            color={fallbackColor}
            onChange={(newColor) => onChange(newColor)}
          />
        </div>
      )}
    </div>
  );
}
