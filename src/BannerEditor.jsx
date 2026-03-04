import React, { useState } from "react";

import { useBannerEditor } from "./hooks/useBannerEditor";
import { useBannerTimeline } from "./hooks/useBannerTimeline";
// import LayerPanel from "./components/LayerPanel"; // commented out for now
import TimelineControls from "./components/TimelineControls";
import Sidebar from "./components/Sidebar";
import AnimationSegmentModal from "./components/AnimationSegmentModal";
import { rebuildAndDownloadHtml } from "./utils/downloadHtml";

// ---------------------------------------------------------------------------
// Inject minimal timeline CSS once at module load.
// ---------------------------------------------------------------------------
if (typeof document !== "undefined") {
  const style = document.createElement("style");
  style.textContent = `
    .animation-timeline { font-family: sans-serif; }
    .timeline-ruler .tick { background: #333; }
    .track-label  { color: #222; }
    .track-bar    { background: #3498db; }
    .scrubber     { background: red; }

    /* Custom layout for GrapesJS Style & Block managers in the right panel */
    .gjs-block {
      width: 100% !important;
      min-height: auto !important;
      padding: 10px !important;
      text-align: left !important;
      border-bottom: 1px solid #2d2d4e !important;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      color: #cdd6f4 !important;
      font-family: sans-serif;
      font-size: 13px !important;
      background: transparent !important;
      box-shadow: none !important;
    }
    .gjs-block:hover {
      background: #313244 !important;
      color: #fff !important;
    }
    .gjs-block svg {
      display: none !important; /* Hide the big icons, text only */
    }
    .gjs-block-label {
      display: block !important;
    }
    /* Hide GrapesJS default panel wrapper styles so our custom flex works */
    .gjs-pn-panels { display: none !important; }

    /* Fix the empty black gap left by GrapesJS's default frame resizing */
    .gjs-editor { background: #ffff !important; }
    .gjs-cv-canvas {
      width: 100% !important;
      right: 0 !important;
      top: 0 !important;
    }
  `;
  document.head.appendChild(style);
}

/**
 * BannerEditor
 *
 * Root component — assembles GrapesJS canvas, animation timeline controls,
 * the floating property dialog, the left-side AnimationPanel, and the
 * AnimationSegmentModal (opened by clicking a timeline segment bar).
 */
export default function BannerEditor({ htmlContent, onBack }) {
  const [iframeReady, setIframeReady] = useState(false);

  // Segment modal state: null = closed, else { segment, anchorPos }
  const [modalData, setModalData] = useState(null);

  // Timeline visibility state
  const [isTimelineOpen, setIsTimelineOpen] = useState(true);

  // ── Hook 1: editor + HTML loading ───────────────────────────────────────
  const {
    editorRef,
    layerPanelRef, // kept in hook so GrapesJS still has a ref; not rendered
    iframeWindowRef,
    editorInstanceRef,
    timelineRef,
    dialogPos,
    selectedStyles,
    selectedTagName,
    selectedElementId,
    handleStyleChange,
    closeDialog,
  } = useBannerEditor({ setIframeReady, htmlContent });

  // ── Hook 2: GSAP timeline ────────────────────────────────────────────────
  const {
    duration,
    currentTime,
    isPlaying,
    tracks,
    handlePlay,
    handlePause,
    handleRestart,
    handleSeek,
    rebuildTimeline,
  } = useBannerTimeline({
    iframeReady,
    iframeWindowRef,
    timelineRef,
  });

  // ── Segment bar click → open modal ───────────────────────────────────────
  function handleSegmentClick(trackId, segment, anchorPos) {
    setModalData({ segment, anchorPos });
  }

  // ── Segment bar drag/stretch update ──────────────────────────────────────
  function handleSegmentUpdate(
    trackId,
    segIdx,
    { start, duration, tweenIndex },
  ) {
    // The __tweenData is actually stored on the ref itself in useBannerEditor.js,
    // not on the window object reference (current).
    const td = iframeWindowRef.__tweenData;

    if (!td || tweenIndex < 0 || tweenIndex >= td.length) {
      return;
    }

    td[tweenIndex].position = Number(start);
    td[tweenIndex].duration = Number(duration);

    rebuildTimeline();
  }

  // ── Segment bar delete ───────────────────────────────────────
  function handleSegmentDelete(trackId, segIdx, { tweenIndex }) {
    const td = iframeWindowRef.__tweenData;

    if (!td || tweenIndex < 0 || tweenIndex >= td.length) {
      return;
    }

    td.splice(tweenIndex, 1);
    rebuildTimeline();
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* Top Header */}
      <div
        style={{
          padding: "8px 16px",
          background: "#ffffff",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "16px",
            color: "#111827",
            fontFamily: "sans-serif",
          }}
        >
          Animated Banner Editor
        </h1>
        <div style={{ display: "flex", gap: "10px" }}>
          {/* {onBack && (
            <button
              onClick={onBack}
              style={{
                background: "#fef2f2",
                color: "#ef4444",
                border: "1px solid #fca5a5",
                padding: "6px 12px",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                fontFamily: "sans-serif",
                fontSize: "12px",
                marginRight: "10px",
              }}
              title="Close Editor"
            >
              ← Close Editor
            </button>
          )} */}
          <div
            style={{
              display: "flex",
              background: "#f3f4f6",
              borderRadius: "4px",
              overflow: "hidden",
              marginRight: "10px",
            }}
          >
            <button
              onClick={() => editorInstanceRef.current?.setDevice("desktop")}
              style={{
                background: "transparent",
                color: "#4b5563",
                border: "1px solid #d1d5db",
                padding: "6px 12px",
                cursor: "pointer",
                fontFamily: "sans-serif",
              }}
              title="Desktop View"
            >
              💻
            </button>
            <button
              onClick={() => editorInstanceRef.current?.setDevice("tablet")}
              style={{
                background: "transparent",
                color: "#4b5563",
                border: "1px solid #d1d5db",
                borderLeft: "none",
                padding: "6px 12px",
                cursor: "pointer",
                fontFamily: "sans-serif",
              }}
              title="Tablet View"
            >
              💊
            </button>
            <button
              onClick={() => editorInstanceRef.current?.setDevice("mobile")}
              style={{
                background: "transparent",
                color: "#4b5563",
                border: "1px solid #d1d5db",
                borderLeft: "none",
                padding: "6px 12px",
                cursor: "pointer",
                fontFamily: "sans-serif",
              }}
              title="Mobile View"
            >
              📱
            </button>
          </div>
          <button
            onClick={() =>
              rebuildAndDownloadHtml(
                htmlContent,
                iframeWindowRef,
                timelineRef,
                editorInstanceRef,
              )
            }
            style={{
              background: "#4f46e5",
              color: "white",
              border: "none",
              padding: "6px 16px",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
              fontFamily: "sans-serif",
            }}
          >
            Download HTML
          </button>
        </div>
      </div>

      {/* Main area: Sidebar (left) + GrapesJS canvas (right) */}
      <div
        style={{
          display: "flex",
          flexDirection: "row-reverse",
          flex: 1,
          overflow: "hidden",
         
        }}
      >
        {/* Left Sidebar ("Edit Assets") */}
        <Sidebar
          selectedTagName={selectedTagName}
          selectedElementId={selectedElementId}
          selectedStyles={selectedStyles}
          handleStyleChange={handleStyleChange}
          editorInstanceRef={editorInstanceRef}
          iframeWindowRef={iframeWindowRef}
          rebuildTimeline={rebuildTimeline}
        />

        {/* GrapesJS canvas — takes remaining width */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "white",
          }}
        >
          <div ref={editorRef} style={{ flex: 1 , paddingLeft: "200px"}} />

          {/* Bottom bar: timeline or open button */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              background: "#ffffff",
              width: "100%",
              overflow: "hidden",
            }}
          >
            {isTimelineOpen ? (
              <TimelineControls
                isPlaying={isPlaying}
                duration={duration}
                currentTime={currentTime}
                tracks={tracks}
                onPlay={handlePlay}
                onPause={handlePause}
                onRestart={handleRestart}
                onSeek={handleSeek}
                onSegmentClick={handleSegmentClick}
                onSegmentUpdate={handleSegmentUpdate}
                onSegmentDelete={handleSegmentDelete}
                onClose={() => setIsTimelineOpen(false)}
              />
            ) : (
              <div
                style={{
                  padding: "8px 12px",
                  width: "100%",
                  borderTop: "1px solid #e5e7eb",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  boxSizing: "border-box",
                }}
              >
                {/* Play / Pause / Restart buttons */}
                <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => {
                    if (isPlaying) {
                      handlePause();
                    } else {
                      handlePlay();
                    }
                  }}
                  title={isPlaying ? "Pause" : "Play"}
                  style={{
                    background: "lightgray",
                    color: "#11111b",
                    border: "none",
                    padding: "6px 10px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontFamily: "sans-serif",
                    fontSize: "16px",
                    transition: "all 0.2s ease",
                  }}
                >
                  {isPlaying ? "⏸" : "▶"}
                </button>

                  <button
                    onClick={handleRestart}
                    title="Restart"
                    style={{
                      background: "lightgray",
                      color: "#11111b",
                      border: "none",
                      padding: "6px 10px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontFamily: "sans-serif",
                      fontSize: "16px",
                    }}
                  >
                   ⟳
                  </button>
                </div>

                {/* Open Timeline button */}
                <button
                  onClick={() => setIsTimelineOpen(true)}
                  style={{
                    background: "#4f46e5",
                    color: "white",
                    border: "none",
                    padding: "6px 16px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    fontFamily: "sans-serif",
                    fontSize: "12px",
                  }}
                >
                  ↑ Open Timeline
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Segment property modal — opened by clicking a timeline bar */}
      {modalData && (
        <AnimationSegmentModal
          segment={modalData.segment}
          anchorPos={modalData.anchorPos}
          iframeWindowRef={iframeWindowRef}
          rebuildTimeline={rebuildTimeline}
          onClose={() => setModalData(null)}
          onDelete={() => {
            handleSegmentDelete(modalData.segment.elementId, null, {
              tweenIndex: modalData.segment.tweenIndex,
            });
            setModalData(null);
          }}
        />
      )}

      {/* Global Bottom Footer */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          background: "#ffffff",
          width: "100%", // ~1358px on full screen
          height: "64px",
          padding: "16px 32px",
          gap: "13px",
          borderTop: "2px solid #e5e7eb",
          borderBottomRightRadius: "20px",
          borderBottomLeftRadius: "20px",
          boxSizing: "border-box",
          zIndex: 50,
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: "transparent",
            color: "#6b7280",
            border: "1px solid #d1d5db",
            padding: "8px 24px",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "bold",
            fontFamily: "Inter, sans-serif",
            fontSize: "14px",
          }}
        >
          Cancel
        </button>
        <button
          onClick={async () => {
            // For now, print HTML to console with same functionality as download
            const extractedHtml = await rebuildAndDownloadHtml(
              htmlContent,
              iframeWindowRef,
              timelineRef,
              editorInstanceRef,
              true,
            );
            console.log("Saved HTML:", extractedHtml);
          }}
          style={{
            background: "#4f46e5",
            color: "#ffffff",
            border: "none",
            padding: "8px 24px",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "bold",
            fontFamily: "Inter, sans-serif",
            fontSize: "14px",
          }}
        >
          Save
        </button>
      </div>
    </div>
  );
}
