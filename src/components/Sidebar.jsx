import React from "react";
import Accordion from "./Accordion";
import TextStylePanel from "./TextStylePanel";
import FillStrokePanel from "./FillStrokePanel";
import PositionsPanel from "./PositionsPanel";
import ElementsPanel from "./ElementsPanel";
// import AnimationPanel from "./AnimationPanel";

export default function Sidebar({ selectedTagName, selectedElementId, selectedStyles, handleStyleChange, editorInstanceRef, iframeWindowRef, rebuildTimeline }) {
  // For Text style accordion logic
  const isTextSelected = selectedTagName === "text" || (selectedTagName && /h[1-6]|p|span|div|a|strong|b|em|i/i.test(selectedTagName));

  return (
    <div
      style={{
        width: 320,
        minWidth: 320,
        flexShrink: 0,
        background: "#ffffff",
        borderRight: "1px solid #e0e0e0",
        borderLeft: "1px solid #e0e0e0",
        boxShadow: "-4px 0 15px rgba(0, 0, 0, 0.05)",
        overflowY: "auto",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px",
          background: "#f9fafb",
          borderBottom: "1px solid #e0e0e0",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <h2 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#111827" }}>Edit Asset</h2>
      </div>

      <div style={{ padding: "0" }}>
        {/* Accordions */}
        <Accordion
          title="Text Style"
          defaultOpen={true}
        >
          {isTextSelected ? (
            <TextStylePanel
              styles={selectedStyles}
              onChange={handleStyleChange}
            />
          ) : (
            <div style={{ fontSize: "12px", color: "#6b7280", padding: "10px 0", textAlign: "center" }}>Select a text element to edit its typography.</div>
          )}
        </Accordion>

        <Accordion
          title="Fill & Stroke"
          defaultOpen={false}
        >
          <div style={{ background: "#f9fafb", padding: "12px", borderBottom: "1px solid #e0e0e0" }}>
            {selectedElementId || selectedTagName ? (
              <FillStrokePanel
                styles={selectedStyles}
                onChange={handleStyleChange}
              />
            ) : (
              <div style={{ fontSize: "12px", color: "#6b7280", padding: "10px 0", textAlign: "center" }}>Select an element to edit its fill and stroke.</div>
            )}
          </div>
        </Accordion>

        {/* <Accordion
          title="Effects"
          defaultOpen={false}
        >
          <div style={{ fontSize: "12px", color: "#9ca3af", textAlign: "center", fontStyle: "italic", padding: "16px" }}>Effects coming soon</div>
        </Accordion> */}

        <Accordion
          title="Layout & Positions"
          defaultOpen={false}
        >
          <div style={{ background: "#f9fafb", padding: "12px", borderBottom: "1px solid #e0e0e0" }}>
            {selectedElementId || selectedTagName ? (
              <PositionsPanel
                styles={selectedStyles}
                onChange={handleStyleChange}
              />
            ) : (
              <div style={{ fontSize: "12px", color: "#6b7280", padding: "10px 0", textAlign: "center" }}>Select an element to edit its layout.</div>
            )}
          </div>
        </Accordion>

        <Accordion
          title="Elements"
          defaultOpen={true}
        >
          <ElementsPanel editorInstanceRef={editorInstanceRef} />
        </Accordion>

        {/* <Accordion
          title="Animation"
          defaultOpen={false}
        >
          <div style={{ padding: "10px", background: "#f3f4f6", borderRadius: "8px", border: "1px solid #e5e7eb" }}>
            <AnimationPanel
              selectedElementId={selectedElementId}
              iframeWindowRef={iframeWindowRef}
              rebuildTimeline={rebuildTimeline}
            />
          </div>
        </Accordion> */}
      </div>
    </div>
  );
}
