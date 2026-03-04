import React from "react";

/**
 * LayerPanel
 *
 * Renders the GrapesJS layer manager sidebar.
 * GrapesJS mounts its layer tree into the `ref` div automatically because
 * we passed `layerPanelRef.current` as `appendTo` in the editor config.
 *
 * @param {{ layerPanelRef: React.RefObject<HTMLDivElement> }} props
 */
export default function LayerPanel({ layerPanelRef }) {
  return (
    <div
      className="layer-panel"
      style={{
        width: 300,
        border: "1px solid #ccc",
        display: "flex",
        flexDirection: "column",
        height: 140,
      }}
    >
      <div
        className="layer-header"
        style={{
          flex: "0 0 auto",
          background: "#e0e0e0",
          padding: "4px",
          borderBottom: "1px solid #ccc",
          fontWeight: "bold",
        }}
      >
        Layers
      </div>
      {/* GrapesJS renders its layer tree into this div */}
      <div
        className="layer-list"
        style={{ flex: "1 1 auto", overflowY: "auto" }}
        ref={layerPanelRef}
      />
    </div>
  );
}
