import React, { useEffect, useRef, useState } from "react";

const LABEL_W = 130;
const pxPerSec = 40;
const rowHeight = 24;
const VISIBLE_H = 100;
const HANDLE_W = 8;

const css = `
.tl-outer { font-family: sans-serif; user-select: none; }

.tl-ruler-row {
  display: flex; background: #f9fafb;
  border-bottom: 1px solid #e5e7eb; height: 22px; overflow: hidden;
}
.tl-ruler-label {
  width: ${LABEL_W}px; flex-shrink: 0;
  background: #f9fafb; border-right: 1px solid #e5e7eb;
}
.tl-ruler-ticks { flex: 1; overflow: hidden; }

.tl-body { overflow: auto; max-height: ${VISIBLE_H}px; }
.tl-body::-webkit-scrollbar { width: 6px; height: 6px; background: #f3f4f6; }
.tl-body::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }

.tl-track-row {
  display: flex; border-bottom: 1px solid #e5e7eb; background: #ffffff;
}

.tl-label-cell {
  position: sticky; left: 0; z-index: 2;
  width: ${LABEL_W}px; min-width: ${LABEL_W}px; height: ${rowHeight}px;
  display: flex; align-items: center; padding: 0 8px;
  background: #f9fafb; border-right: 1px solid #e5e7eb;
  font-size: 11px; font-weight: 600; color: #374151;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}

.tl-bar-cell { position: relative; flex: 1; height: ${rowHeight}px; }
.tl-vline    { position: absolute; top: 0; bottom: 0; width: 1px; background: #e5e7eb; }

/* Segment wrapper — flex row: [left-handle][body][right-handle] */
.tl-seg {
  position: absolute; top: 5px; height: ${rowHeight - 10}px;
  border-radius: 3px; opacity: 0.88;
  display: flex; align-items: stretch; box-sizing: border-box;
  transition: filter 0.1s;
}
.tl-seg:hover        { opacity: 1; filter: brightness(1.15); }
.tl-seg.tl-dragging  { opacity: 0.95; filter: brightness(1.3); box-shadow: 0 2px 14px rgba(0,0,0,0.6); }

/* Resize handles */
.tl-handle {
  position: absolute; top: 0; bottom: 0; width: ${HANDLE_W}px;
  cursor: ew-resize; z-index: 3; border-radius: 3px;
  background: rgba(255,255,255,0.18);
  transition: background 0.15s;
}
.tl-handle:hover        { background: rgba(255,255,255,0.5); }
.tl-handle-left         { left: 0;  border-right: 1px solid rgba(255,255,255,0.25); }
.tl-handle-right        { right: 0; border-left:  1px solid rgba(255,255,255,0.25); }

/* Middle body — drag to move */
.tl-seg-body        { flex: 1; cursor: grab; min-width: 0; }
.tl-seg-body:active { cursor: grabbing; }

.tl-scrubber {
  position: absolute; top: 0; width: 2px;
  background: #ef4444; cursor: ew-resize; z-index: 10; pointer-events: all;
}
.tl-tick {
  position: absolute; top: 0; height: 100%;
  border-left: 1px solid #e5e7eb; font-size: 10px;
  color: #6b7280; padding-left: 2px; line-height: 22px;
}
`;

if (typeof document !== "undefined") {
  if (!document.getElementById("tl-styles")) {
    const tag = document.createElement("style");
    tag.id = "tl-styles";
    tag.textContent = css;
    document.head.appendChild(tag);
  }
}

function colorForTrack(track) {
  switch (track.type) {
    case "text":
      return "#3b82f6";
    case "image":
      return "#22c55e";
    case "background":
      return "#a855f7";
  }
  let hash = 0;
  for (let i = 0; i < track.id.length; i++) {
    hash = (hash * 31 + track.id.charCodeAt(i)) | 0;
  }
  return `hsl(${((hash % 360) + 360) % 360},55%,55%)`;
}

/**
 * Timeline
 *
 * Props:
 *   tracks           — Array of { id, type, segments: [{ start, duration, vars, tweenIndex }] }
 *   duration         — total animation duration in seconds
 *   currentTime      — current playhead position
 *   onSeek           — (t) => void
 *   onSegmentClick   — (trackId, seg, { x, y }) => void   — opens the property modal
 *   onSegmentUpdate  — (trackId, segIdx, { start, duration, tweenIndex }) => void
 *                      called on drag-end to persist changes to __tweenData
 */
export default function Timeline({ tracks, duration, currentTime, onSeek = () => {}, onSegmentClick = () => {}, onSegmentUpdate = () => {}, onSegmentDelete = () => {} }) {
  const bodyRef = useRef(null);
  const rulerRef = useRef(null);

  // ── drag state ─────────────────────────────────────────────────────────────
  // null while idle; populated during any segment drag
  const [drag, setDrag] = useState(null);

  // Keep ruler X scroll in sync with body X scroll
  useEffect(() => {
    const body = bodyRef.current;
    const ruler = rulerRef.current;
    if (!body || !ruler) return;
    const sync = () => {
      ruler.scrollLeft = body.scrollLeft;
    };
    body.addEventListener("scroll", sync);
    return () => body.removeEventListener("scroll", sync);
  }, []);

  // ── Scrubber drag ──────────────────────────────────────────────────────────
  function startScrubDrag(e) {
    e.preventDefault();
    const body = bodyRef.current;
    if (!body) return;
    const move = (ev) => {
      const rect = body.getBoundingClientRect();
      let x = ev.clientX - rect.left - LABEL_W + body.scrollLeft;
      x = Math.max(0, Math.min(x, duration * pxPerSec));
      onSeek(x / pxPerSec);
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  }

  // ── Segment drag/resize ────────────────────────────────────────────────────
  // type: "move" | "resize-left" | "resize-right"
  function startSegDrag(e, track, seg, segIdx, type) {
    e.preventDefault();
    e.stopPropagation();

    const origStart = seg.start;
    const origDuration = seg.duration;
    const startX = e.clientX;

    setDrag({
      trackId: track.id,
      segIdx,
      tweenIndex: seg.tweenIndex,
      type,
      origStart,
      origDuration,
      startX,
      curStart: origStart,
      curDuration: origDuration,
    });

    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / pxPerSec;
      setDrag((prev) => {
        if (!prev) return null;
        let ns = prev.origStart;
        let nd = prev.origDuration;

        if (type === "move") {
          ns = Math.max(0, prev.origStart + dx);
        } else if (type === "resize-right") {
          nd = Math.max(0.05, prev.origDuration + dx);
        } else if (type === "resize-left") {
          // clamp so duration never drops below 0.05s
          const clampedDx = Math.min(dx, prev.origDuration - 0.05);
          ns = Math.max(0, prev.origStart + clampedDx);
          nd = Math.max(0.05, prev.origDuration - clampedDx);
        }
        return { ...prev, curStart: ns, curDuration: nd };
      });
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      setDrag((prev) => {
        if (prev) {
          onSegmentUpdate(prev.trackId, prev.segIdx, {
            start: prev.curStart,
            duration: prev.curDuration,
            tweenIndex: prev.tweenIndex,
          });
        }
        return null;
      });
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const totalW = Math.max(duration * pxPerSec, 400);
  const gridLines = Array.from({ length: Math.ceil(duration) + 1 }, (_, i) => i);

  return (
    <div className="tl-outer">
      {/* ── Ruler ── */}
      <div className="tl-ruler-row">
        <div className="tl-ruler-label" />
        <div
          className="tl-ruler-ticks"
          ref={rulerRef}
          style={{ overflowX: "hidden" }}
        >
          <div style={{ position: "relative", width: totalW, height: "100%" }}>
            {gridLines.map((i) => (
              <div
                key={i}
                className="tl-tick"
                style={{ left: i * pxPerSec }}
              >
                {i}s
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div
        className="tl-body"
        ref={bodyRef}
      >
        {tracks.map((track, tIdx) => {
          const color = colorForTrack(track);
          const sorted = [...(track.segments || [])].sort((a, b) => a.start - b.start);

          return (
            <div
              key={track.id + tIdx}
              className="tl-track-row"
            >
              {/* Sticky ID label */}
              <div
                className="tl-label-cell"
                title={track.id}
              >
                {track.id}
              </div>

              {/* Bar canvas */}
              <div
                className="tl-bar-cell"
                style={{ width: totalW }}
              >
                {/* Vertical grid lines */}
                {gridLines.map((i) => (
                  <div
                    key={i}
                    className="tl-vline"
                    style={{ left: i * pxPerSec }}
                  />
                ))}

                {/* Segment bars */}
                {sorted.map((seg, sIdx) => {
                  const isDragging = drag && drag.trackId === track.id && drag.segIdx === sIdx;

                  const dispStart = isDragging ? drag.curStart : seg.start;
                  const dispDur = isDragging ? drag.curDuration : seg.duration;
                  const left = dispStart * pxPerSec;
                  const width = Math.max(dispDur * pxPerSec, HANDLE_W * 2 + 4);

                  return (
                    <div
                      key={sIdx}
                      className={`tl-seg${isDragging ? " tl-dragging" : ""}`}
                      style={{ left, width, background: color }}
                    >
                      {/* ← Left resize handle */}
                      <div
                        className="tl-handle tl-handle-left"
                        onMouseDown={(e) => startSegDrag(e, track, seg, sIdx, "resize-left")}
                        title="Drag ← → to shift start time"
                      />

                      {/* Bar body — drag to move the whole segment */}
                      <div
                        className="tl-seg-body"
                        onMouseDown={(e) => startSegDrag(e, track, seg, sIdx, "move")}
                        onClick={(e) => {
                          e.stopPropagation();
                          // only fire click if no drag happened (movement < 3px)
                          if (!drag && Math.abs(e.clientX - (drag?.startX ?? e.clientX)) < 3) {
                            onSegmentClick(track.id, { ...seg, elementId: track.id }, { x: e.clientX, y: e.clientY });
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (onSegmentDelete) {
                            onSegmentDelete(track.id, sIdx, { tweenIndex: seg.tweenIndex });
                          }
                        }}
                        title={`${track.id}  ${dispStart.toFixed(2)}s → ${(dispStart + dispDur).toFixed(2)}s  (drag to move, right-click to delete)`}
                      />

                      {/* → Right resize handle */}
                      <div
                        className="tl-handle tl-handle-right"
                        onMouseDown={(e) => startSegDrag(e, track, seg, sIdx, "resize-right")}
                        title="Drag → to change duration"
                      />
                    </div>
                  );
                })}

                {/* Scrubber — only on the first track row, spans full height */}
                {tIdx === 0 && (
                  <div
                    className="tl-scrubber"
                    style={{
                      left: currentTime * pxPerSec,
                      height: tracks.length * rowHeight,
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      startScrubDrag(e);
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
