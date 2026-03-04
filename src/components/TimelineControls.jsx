import React from "react";
import Timeline from "../Timeline";

/**
 * TimelineControls
 *
 * Renders the play/pause + restart buttons and the Timeline scrubber.
 * All state lives in the parent (via useBannerTimeline); this component
 * is purely presentational.
 *
 * @param {{
 *   isPlaying:   boolean,
 *   duration:    number,
 *   currentTime: number,
 *   tracks:      Array,
 *   onPlay:      () => void,
 *   onPause:     () => void,
 *   onRestart:   () => void,
 *   onSeek:           (t: number) => void,
 *   onSegmentClick:   (trackId, seg, pos) => void,
 *   onSegmentUpdate:  (trackId, segIdx, { start, duration, tweenIndex }) => void,
 * }} props
 */
export default function TimelineControls({
  isPlaying,
  duration,
  currentTime,
  tracks,
  onPlay,
  onPause,
  onRestart,
  onSeek,
  onSegmentClick,
  onSegmentUpdate,
  onSegmentDelete,
  onClose,
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      {/* Playback & Window controls */}
      <div
        style={{
          padding: "4px 8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          borderBottom: "1px solid #e5e7eb",
          background: "#f9fafb",
        }}
      >
        {/* Left: Play/Pause/Restart */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={isPlaying ? onPause : onPlay}
            disabled={duration === 0}
            style={{
              background: isPlaying ? "lightgray" : "lightgray",
              color: "#11111b",
              border: "none",
              borderRadius: "4px",
              padding: "4px 10px",
              fontWeight: "bold",
              cursor: duration === 0 ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "40px",
              fontSize: "12px",
            }}
          >
            {isPlaying ? "⏸ " : "▶ "}
          </button>
          <button
            onClick={onRestart}
            disabled={duration === 0}
            style={{
              background: "lightgray",
              color: "#11111b",
              border: "none",
              borderRadius: "4px",
              padding: "4px 10px",
              fontWeight: "bold",
              cursor: duration === 0 ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "16px",
            }}
          >
            ⟳
          </button>
        </div>

        {/* Right: Close Timeline Button */}
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              color: "#9ca3af",
              border: "none",
              borderRadius: "4px",
              padding: "2px 8px",
              fontWeight: "bold",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
            }}
            title="Close Timeline"
          >
            ✕
          </button>
        )}
      </div>

      {/* Timeline scrubber */}
      <Timeline
        tracks={tracks}
        duration={duration}
        currentTime={currentTime}
        onSeek={onSeek}
        onSegmentClick={onSegmentClick}
        onSegmentUpdate={onSegmentUpdate}
      />
    </div>
  );
}
