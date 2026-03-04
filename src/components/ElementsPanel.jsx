import React from "react";

// Mockup styling for the elements
const btnStyle = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: "6px",
  padding: "8px 10px",
  fontSize: "12px",
  color: "#374151",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  cursor: "grab",
  fontWeight: "500",
  flex: 1,
};

const rowStyle = {
  display: "flex",
  gap: "8px",
  marginBottom: "8px",
};

export default function ElementsPanel({ editorInstanceRef }) {
  // A helper to handle dragging elements directly into the GrapesJS canvas
  // if we set the basic block type structure here.
  const handleDragStart = (e, blockId, blockConfig) => {
    e.dataTransfer.setData("text/plain", "adding-component");
    const editor = editorInstanceRef?.current;
    if (editor) {
      // GrapesJS Blocks.startDrag requires an actual Block model.
      // We dynamically register a temporary block if it doesn't already exist.
      if (!editor.BlockManager.get(blockId)) {
        editor.BlockManager.add(blockId, blockConfig);
      }
      const block = editor.BlockManager.get(blockId);
      editor.Blocks.startDrag(block);
    }
  };

  const handleDragEnd = () => {
    if (editorInstanceRef?.current) {
      editorInstanceRef.current.Blocks.endDrag();
    }
  };

  return (
    <div style={{ fontFamily: "Inter, sans-serif" }}>
      <div style={rowStyle}>
        <div
          style={btnStyle}
          draggable
          onDragStart={(e) =>
            handleDragStart(e, "ui-h1", {
              label: "Heading 1",
              content: {
                tagName: "h1",
                type: "text",
                resizable: true,
                content: "Heading 1",
                style: { "font-size": "32px", "font-weight": "bold", margin: "0 0 10px 0", color: "#000" },
              },
            })
          }
          onDragEnd={handleDragEnd}
        >
          <strong>H1</strong> Heading 1
        </div>
        <div
          style={btnStyle}
          draggable
          onDragStart={(e) =>
            handleDragStart(e, "ui-h2", {
              label: "Heading 2",
              content: {
                tagName: "h2",
                type: "text",
                resizable: true,
                content: "Sub Heading 1",
                style: { "font-size": "24px", "font-weight": "bold", margin: "0 0 10px 0", color: "#000" },
              },
            })
          }
          onDragEnd={handleDragEnd}
        >
          <strong>H2</strong> Sub Heading 1
        </div>
      </div>

      <div style={rowStyle}>
        <div
          style={btnStyle}
          draggable
          onDragStart={(e) =>
            handleDragStart(e, "ui-p", {
              label: "Body Text",
              content: { tagName: "p", type: "text", resizable: true, content: "Body Text", style: { "font-size": "16px", margin: "0 0 10px 0", color: "#000" } },
            })
          }
          onDragEnd={handleDragEnd}
        >
          <span style={{ fontSize: "16px", lineHeight: 0.8 }}>≡</span> Body Text
        </div>
        <div
          style={btnStyle}
          draggable
          onDragStart={(e) =>
            handleDragStart(e, "ui-divider", {
              label: "Divider",
              content: {
                type: "default",
                tagName: "hr",
                resizable: true,
                style: { border: "none", "background-color": "#374151", margin: "10px 0", height: "5px", width: "100%", display: "block" },
              },
            })
          }
          onDragEnd={handleDragEnd}
        >
          <span style={{ fontWeight: 900 }}>—</span> Divider
        </div>
      </div>

      <div style={rowStyle}>
        <div
          style={btnStyle}
          draggable
          onDragStart={(e) =>
            handleDragStart(e, "ui-button", {
              label: "Button",
              content: {
                tagName: "button",
                type: "link",
                resizable: true,
                content: "Button",
                style: {
                  display: "inline-block",
                  padding: "10px 20px",
                  "background-color": "#3b82f6",
                  color: "#ffffff",
                  border: "none",
                  "border-radius": "6px",
                  cursor: "pointer",
                  "font-size": "14px",
                  "font-weight": "600",
                },
              },
            })
          }
          onDragEnd={handleDragEnd}
        >
          <strong>H2</strong> Button
        </div>
        <div
          style={btnStyle}
          draggable
          onDragStart={(e) =>
            handleDragStart(e, "ui-image", {
              label: "Image",
              content: {
                type: "image",
                resizable: true,
                src: "https://via.placeholder.com/150",
                style: { display: "block", width: "150px", "min-height": "100px", "background-color": "#e5e7eb", "max-width": "100%", height: "auto" },
              },
            })
          }
          onDragEnd={handleDragEnd}
        >
          <span>🖼️</span> Add Image
        </div>
      </div>

      <div style={rowStyle}>
        <div
          style={{ ...btnStyle, flex: "0 0 calc(50% - 4px)" }}
          draggable
          onDragStart={(e) =>
            handleDragStart(e, "ui-social", {
              label: "Social Media",
              content: `<div style="display:flex;gap:12px;"><a href="#" style="color:#3b82f6;text-decoration:none;">Facebook</a><a href="#" style="color:#d946ef;text-decoration:none;">Instagram</a><a href="#" style="color:#111827;text-decoration:none;">X / Twitter</a></div>`,
            })
          }
          onDragEnd={handleDragEnd}
        >
          <span>🔗</span> Social Media
        </div>
      </div>
    </div>
  );
}
