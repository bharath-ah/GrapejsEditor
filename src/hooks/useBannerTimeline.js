import { useEffect, useState, useCallback } from "react";

/**
 * useBannerTimeline
 *
 * Custom hook that runs once `iframeReady` becomes true.
 * Reads the captured tween definitions from `iframeWindowRef.__tweenData`,
 * resolves each elementId to a live iframe DOM element, builds a GSAP
 * timeline, and derives the track array for the Timeline UI component.
 *
 * @param {{
 *   iframeReady:    boolean,
 *   iframeWindowRef: React.MutableRefObject<{ current: Window, __tweenData: any[] }>,
 *   timelineRef:    React.MutableRefObject<gsap.core.Timeline|null>,
 * }} deps
 *
 * @returns {{
 *   timelineRef:   React.MutableRefObject<gsap.core.Timeline|null>,
 *   duration:      number,
 *   currentTime:   number,
 *   isPlaying:     boolean,
 *   tracks:        Array<{ id: string, type: string, segments: { start: number, duration: number }[] }>,
 *   setIsPlaying:  (v: boolean) => void,
 *   handlePlay:    () => void,
 *   handlePause:   () => void,
 *   handleRestart: () => void,
 *   handleSeek:    (t: number) => void,
 *   rebuildTimeline: () => void,
 * }}
 */
export function useBannerTimeline({ iframeReady, iframeWindowRef, timelineRef }) {
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tracks, setTracks] = useState([]);

  const rebuildTimeline = useCallback(() => {
    if (!iframeReady) return;

    const win = iframeWindowRef.current;
    if (!win || !win.gsap) return;

    // Clear any existing timeline before building a new one
    if (timelineRef.current) {
      // Collect all elements previously animated by this timeline
      const kids = timelineRef.current.getChildren(false, true, false);
      const animatedEls = new Set();
      kids.forEach((child) => {
        const t = typeof child.targets === "function" ? child.targets() : child.targets;
        if (Array.isArray(t)) t.forEach((el) => animatedEls.add(el));
        else if (t) animatedEls.add(t);
      });

      timelineRef.current.pause();
      timelineRef.current.kill();
      timelineRef.current = null;

      // Wiping the inline style attribute strips away all GSAP modifications,
      // resetting the elements completely back to their original GrapesJS CSS rules
      // without leaving a 'stuck' progress(0) attribute.
      animatedEls.forEach((el) => {
        if (el && el.removeAttribute) {
          el.removeAttribute("style");
        }
      });
    }

    // ------------------------------------------------------------------
    // Build GSAP timeline from tween definitions captured by parseTweenData
    // ------------------------------------------------------------------
    const tl = win.gsap.timeline({ paused: true });

    const tweenData = iframeWindowRef.__tweenData || [];
    console.log("[useBannerTimeline] building timeline from", tweenData.length, "tweens");

    const liveDoc = win.document;
    tweenData.forEach(({ elementId, duration: dur, vars, position }) => {
      // Resolve the stored element ID to the real live iframe element.
      // Elements that were stripped by cleanBannerHtml (e.g. #links children)
      // return null here and are skipped gracefully.
      const el = elementId ? liveDoc.getElementById(elementId) : null;
      if (!el) return;

      if (vars.fromVars && vars.toVars) {
        tl.fromTo(el, vars.fromVars, { duration: dur, ...vars.toVars }, position);
      } else if (vars.toVars) {
        tl.to(el, { duration: dur, ...vars.toVars }, position);
      } else {
        tl.to(el, { duration: dur, ...vars }, position);
      }
    });

    // Keep currentTime state in sync for the scrubber
    tl.eventCallback("onUpdate", () => setCurrentTime(tl.time()));

    timelineRef.current = tl;
    setDuration(tl.duration());
    setCurrentTime(0);
    tl.play();
    setIsPlaying(true);

    // ------------------------------------------------------------------
    // Build track array for the Timeline UI
    // One track per element ID; anonymous tweens get a unique placeholder key.
    // ------------------------------------------------------------------
    const kids = tl.getChildren(false, true, false);
    const byId = {};

    kids.forEach((child, idx) => {
      const start = child.startTime();
      const dur = child.duration();
      const targets = typeof child.targets === "function" ? child.targets() : [];

      let id = "";
      let type = "background";

      if (targets && targets.length) {
        const t0 = targets[0];
        if (t0 instanceof HTMLElement) {
          id = t0.id || "";
          const tag = t0.tagName.toLowerCase();
          if (tag === "img") type = "image";
          else if (/\btext\b/i.test(id) || /text/i.test(t0.className || "")) type = "text";
        }
      }

      if (!id) id = `__anon_${idx}`;
      if (!byId[id]) byId[id] = { id, type, segments: [] };

      // Also store vars and the index into __tweenData so the segment
      // modal can display and edit the tween's properties.
      const tweenIndex = tweenData.findIndex((td) => (td.elementId === id || (!td.elementId && id.startsWith("__anon_"))) && td.position === start && td.duration === dur);
      const vars = tweenData[tweenIndex]?.vars || {};
      byId[id].segments.push({ start, duration: dur, vars, tweenIndex });
    });

    // Sort by earliest segment so tracks appear in playback order
    const trackArray = Object.values(byId).sort((a, b) => {
      const aStart = Math.min(...a.segments.map((s) => s.start));
      const bStart = Math.min(...b.segments.map((s) => s.start));
      return aStart - bStart;
    });

    setTracks(trackArray);
  }, [iframeReady, iframeWindowRef, timelineRef, setDuration, setCurrentTime, setIsPlaying, setTracks]);

  useEffect(() => {
    if (iframeReady) {
      rebuildTimeline();
    }
  }, [iframeReady, rebuildTimeline]);

  // ------------------------------------------------------------------
  // Playback controls
  // ------------------------------------------------------------------
  const handlePlay = () => {
    const tl = timelineRef.current;
    if (!tl) return;
    tl.play();
    setIsPlaying(true);
  };

  const handlePause = () => {
    const tl = timelineRef.current;
    if (!tl) return;
    tl.pause();
    setIsPlaying(false);
  };

  const handleRestart = () => {
    const tl = timelineRef.current;
    if (!tl) return;
    tl.pause();
    tl.seek(0);
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handleSeek = (t) => {
    const tl = timelineRef.current;
    if (tl) {
      tl.pause();
      tl.seek(t);
    }
    setCurrentTime(t);
    setIsPlaying(false);
  };

  const handleSegmentDelete = (trackId, segIdx, { tweenIndex }) => {
    const tweenData = iframeWindowRef.current?.__tweenData;
    if (!tweenData) return;

    if (tweenIndex >= 0 && tweenIndex < tweenData.length) {
      tweenData.splice(tweenIndex, 1);
      rebuildTimeline();
    }
  };

  return {
    duration,
    currentTime,
    isPlaying,
    setIsPlaying,
    tracks,
    handlePlay,
    handlePause,
    handleRestart,
    handleSeek,
    handleSegmentDelete,
    rebuildTimeline,
  };
}
