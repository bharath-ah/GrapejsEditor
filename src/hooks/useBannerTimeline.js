import { useEffect, useState, useCallback, useRef } from "react";

/**
 * useBannerTimeline
 *
 * Custom hook that runs once `iframeReady` becomes true.
 *
 * GSAP mode (gsap2_window | gsap2_all | gsap3):
 *   Reads the captured tween definitions from `iframeWindowRef.__tweenData`,
 *   resolves each elementId to a live iframe DOM element, builds a GSAP
 *   timeline, and derives the track array for the Timeline UI component.
 *
 * CSS / GWD mode:
 *   Uses document.getAnimations() to collect every running CSSAnimation,
 *   then controls playback with Animation.currentTime + requestAnimationFrame.
 *   Track data is derived from each animation's EffectTiming.
 *
 * @param {{
 *   iframeReady:    boolean,
 *   iframeWindowRef: React.MutableRefObject<{ current: Window, __tweenData: any[], __animationMode: {mode:string} }>,
 *   timelineRef:    React.MutableRefObject<gsap.core.Timeline|null>,
 * }} deps
 *
 * @returns {{
 *   duration:        number,
 *   currentTime:     number,
 *   isPlaying:       boolean,
 *   tracks:          Array<{ id: string, type: string, segments: { start: number, duration: number }[] }>,
 *   setIsPlaying:    (v: boolean) => void,
 *   handlePlay:      () => void,
 *   handlePause:     () => void,
 *   handleRestart:   () => void,
 *   handleSeek:      (t: number) => void,
 *   rebuildTimeline: () => void,
 * }}
 */
export function useBannerTimeline({ iframeReady, iframeWindowRef, timelineRef }) {
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tracks, setTracks] = useState([]);

  // ── CSS / GWD animation controller refs ─────────────────────────────────
  /** Live Animation objects gathered via document.getAnimations() */
  const cssAnimsRef = useRef([]);
  /** requestAnimationFrame handle (iframe's rAF so it ticks with the banner) */
  const rafIdRef = useRef(null);
  /** Playhead position in milliseconds — source of truth during CSS playback */
  const cssCurrentMsRef = useRef(0);
  /** Total CSS animation duration in milliseconds */
  const cssTotalMsRef = useRef(0);

  // ── CSS helper: cancel the running RAF loop ──────────────────────────────
  const cssCancelRaf = useCallback(() => {
    if (rafIdRef.current == null) return;
    const win = iframeWindowRef.current;
    const cancel = win?.cancelAnimationFrame?.bind(win) ?? cancelAnimationFrame;
    cancel(rafIdRef.current);
    rafIdRef.current = null;
  }, [iframeWindowRef]);

  // ── CSS helper: resume / start the RAF playback loop ────────────────────
  //
  // Calls anim.play() on every stored CSSAnimation then drives the React
  // currentTime state via a rAF loop so the scrubber updates smoothly.
  // The loop uses the *iframe's* requestAnimationFrame so it pauses
  // automatically when the iframe tab is backgrounded.
  const cssStartRaf = useCallback(() => {
    cssCancelRaf();
    const win = iframeWindowRef.current;
    if (!win) return;

    // If the playhead is already at (or past) the end, restart from 0.
    if (cssCurrentMsRef.current >= cssTotalMsRef.current) {
      cssCurrentMsRef.current = 0;
      cssAnimsRef.current.forEach((anim) => {
        try {
          anim.pause();
          anim.currentTime = 0;
        } catch (_) {}
      });
    }

    cssAnimsRef.current.forEach((anim) => {
      try { anim.play(); } catch (_) {}
    });

    let lastTs = null;
    const tick = (ts) => {
      if (lastTs === null) lastTs = ts;
      const delta = ts - lastTs;
      lastTs = ts;

      cssCurrentMsRef.current = Math.min(
        cssCurrentMsRef.current + delta,
        cssTotalMsRef.current,
      );

      setCurrentTime(cssCurrentMsRef.current / 1000);

      if (cssCurrentMsRef.current < cssTotalMsRef.current) {
        rafIdRef.current = win.requestAnimationFrame(tick);
      } else {
        rafIdRef.current = null;
        setIsPlaying(false);
      }
    };

    rafIdRef.current = win.requestAnimationFrame(tick);
  }, [iframeWindowRef, cssCancelRaf]);

  // ── Main timeline builder ────────────────────────────────────────────────
  const rebuildTimeline = useCallback(() => {
    if (!iframeReady) return;

    const animType = iframeWindowRef.__animationMode?.type ?? "none";

    // ════════════════════════════════════════════════════════════════════════
    // CSS / GWD path — document.getAnimations() controller
    // ════════════════════════════════════════════════════════════════════════
    if (animType === "css") {
      cssCancelRaf();
      cssCurrentMsRef.current = 0;

      const win = iframeWindowRef.current;
      if (!win) return;
      const iframeDoc = win.document;

      // Defensive: ensure gwd-play-animation is present on every GWD page
      // element (useBannerEditor already does this, but guard here too in
      // case rebuildTimeline is called independently later).
      const gwdSeen = new Set();
      iframeDoc.querySelectorAll("gwd-page").forEach((el) => gwdSeen.add(el));
      iframeDoc.querySelectorAll(".gwd-page-wrapper").forEach((el) => gwdSeen.add(el));
      const dp1 = iframeDoc.getElementById("page1");
      if (dp1) gwdSeen.add(dp1);
      gwdSeen.forEach((page) => {
        page.classList.remove("transparent", "gwd-inactive");
        if (!page.classList.contains("gwd-play-animation")) {
          page.classList.add("gwd-play-animation");
        }
      });

      const anims =
        typeof iframeDoc.getAnimations === "function"
          ? iframeDoc.getAnimations()
          : [];

      console.log("[useBannerTimeline] CSS mode — found", anims.length, "animations");

      if (anims.length === 0) {
        setDuration(0);
        setTracks([]);
        return;
      }

      // ── Compute total duration (ms) ───────────────────────────────────
      let maxEndMs = 0;
      anims.forEach((anim) => {
        try {
          const t = anim.effect?.getTiming?.() ?? {};
          const delay = typeof t.delay === "number" ? t.delay : 0;
          const dur   = typeof t.duration === "number" ? t.duration : 0;
          maxEndMs = Math.max(maxEndMs, delay + dur);
        } catch (_) {}
      });
      cssTotalMsRef.current = maxEndMs;
      setDuration(maxEndMs / 1000);

      // ── Build track array for the Timeline UI ─────────────────────────
      //   One track entry per target element; anonymous animations get a
      //   stable placeholder key.  start / duration are in seconds to
      //   match the GSAP track format consumed by TimelineControls.
      const byId = {};
      anims.forEach((anim, idx) => {
        try {
          const el      = anim.effect?.target;
          const t       = anim.effect?.getTiming?.() ?? {};
          const delayS  = (typeof t.delay    === "number" ? t.delay    : 0) / 1000;
          const durS    = (typeof t.duration === "number" ? t.duration : 0) / 1000;
          const id      = el?.id || `__css_${idx}`;
          const tagName = el?.tagName?.toLowerCase?.() ?? "";

          let type = "background";
          if (tagName === "img" || tagName === "gwd-image") type = "image";
          else if (/text/i.test(id) || /text/i.test(el?.className ?? "")) type = "text";

          if (!byId[id]) byId[id] = { id, type, segments: [] };
          byId[id].segments.push({ start: delayS, duration: durS });
        } catch (_) {}
      });

      const trackArray = Object.values(byId).sort((a, b) => {
        const aS = Math.min(...a.segments.map((s) => s.start));
        const bS = Math.min(...b.segments.map((s) => s.start));
        return aS - bS;
      });
      setTracks(trackArray);

      // Store reference immediately so handlePause can act even during the
      // two-frame window below.
      cssAnimsRef.current = anims;

      // ── CRITICAL: do NOT pause before the first frame is painted ─────
      //
      // GWD elements start at opacity:0 (their 0% keyframe).  Pausing
      // immediately at currentTime=0 freezes every element in that
      // invisible state → blank page.
      //
      // Wait 2 rAF cycles so the browser commits the initial visual frame,
      // then capture the real currentTime, pause, and hand off to our
      // RAF-based timeline controller.
      let framesWaited = 0;
      const takeControl = () => {
        framesWaited++;
        if (framesWaited < 2) {
          win.requestAnimationFrame(takeControl);
          return;
        }

        // Capture the actual playhead position from the first animation.
        let capturedMs = 0;
        try {
          const ct = anims[0]?.currentTime;
          capturedMs = typeof ct === "number" ? ct : 0;
        } catch (_) {}

        cssCurrentMsRef.current = capturedMs;
        setCurrentTime(capturedMs / 1000);

        // Pause all animations (preserving their current visual state).
        anims.forEach((anim) => {
          try { anim.pause(); } catch (_) {}
        });

        // Hand off to the RAF-based controller which calls anim.play() and
        // ticks the scrubber.
        cssStartRaf();
        setIsPlaying(true);
      };
      win.requestAnimationFrame(takeControl);
      return;
    }

    // ════════════════════════════════════════════════════════════════════════
    // GSAP path — existing logic, UNTOUCHED
    // ════════════════════════════════════════════════════════════════════════

    // Guard: only run when detection confirmed GSAP.  Without this a GWD
    // banner loaded after a GSAP banner (window.gsap still in iframe scope)
    // would build an empty GSAP timeline, call setIsPlaying(true) and leave
    // duration=0 — which is exactly the "0s / no tracks" symptom.
    if (animType !== "gsap") return;

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

      // Clear GSAP-managed inline styles so the new timeline starts from a
      // known state.  We use two strategies depending on element type:
      //
      //  • Text elements (have readable textContent):
      //    Preserve layout properties (top / left / position / width / height)
      //    so the element does not jump to its CSS-defined off-screen start
      //    position during the brief gap before the new timeline begins.
      //    Only the animation-controlled properties (opacity, transform, …)
      //    are cleared so GSAP can re-animate them cleanly.
      //
      //  • Non-text elements (images, containers, …):
      //    Full inline-style wipe — GSAP will set everything from scratch.
      const ANIM_ONLY_PROPS = [
        "opacity", "visibility", "display",
        "transform", "-webkit-transform",
        "filter", "clip-path",
        "will-change",
      ];

      animatedEls.forEach((el) => {
        if (!el) return;

        const hasReadableText =
          el.textContent && el.textContent.trim().length > 0;

        if (hasReadableText) {
          // Selective clear: only animation-managed properties.
          // top / left / width / height / position are intentionally kept.
          ANIM_ONLY_PROPS.forEach((p) => el.style.removeProperty(p));
        } else {
          // Full clear for non-text (images, backgrounds, containers).
          if (el.removeAttribute) el.removeAttribute("style");
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

    /**
     * Strip any vars that are incompatible with GSAP v3's CSSPlugin:
     *  - `transform` as a CSS string would conflict with GSAP's own
     *    transform tracking (x, y, rotation, scale …).
     *  - `webkitTransformOrigin` is vendor-prefixed; GSAP v3 uses
     *    `transformOrigin`.
     *  - Lifecycle callbacks from the original banner scope would throw.
     *  - Ease "NONE" / "none" maps to the no-easing constant.
     */
    function sanitizeVars(raw) {
      const v = { ...raw };
      if (typeof v.transform === "string") delete v.transform;
      delete v.webkitTransformOrigin;
      ["onComplete", "onStart", "onUpdate", "onRepeat", "onReverseComplete"].forEach(
        (k) => delete v[k],
      );
      if (typeof v.ease === "string" && v.ease.toUpperCase() === "NONE") {
        v.ease = "none";
      }
      return v;
    }

    tweenData.forEach(({ elementId, duration: dur, vars, position }) => {
      // Resolve the stored element ID to the real live iframe element.
      // Elements that were stripped by cleanBannerHtml (e.g. #links children)
      // return null here and are skipped gracefully.
      const el = elementId ? liveDoc.getElementById(elementId) : null;
      if (!el) return;

      if (vars.fromVars && vars.toVars) {
        tl.fromTo(
          el,
          sanitizeVars(vars.fromVars),
          { duration: dur, ...sanitizeVars(vars.toVars) },
          position,
        );
      } else if (vars.toVars) {
        tl.to(el, { duration: dur, ...sanitizeVars(vars.toVars) }, position);
      } else {
        tl.to(el, { duration: dur, ...sanitizeVars(vars) }, position);
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
  }, [iframeReady, iframeWindowRef, timelineRef, cssCancelRaf, cssStartRaf, setDuration, setCurrentTime, setIsPlaying, setTracks]);

  useEffect(() => {
    if (iframeReady) {
      rebuildTimeline();
    }
  }, [iframeReady, rebuildTimeline]);

  // ── Playback controls ────────────────────────────────────────────────────
  //
  // Each handler checks the animation mode first.
  // CSS mode uses the RAF-based controller; GSAP mode uses the timeline ref.
  // GSAP logic is byte-for-byte identical to the original implementation.

  const handlePlay = () => {
    const animType = iframeWindowRef.__animationMode?.type;
    if (animType === "css") {
      cssStartRaf();
      setIsPlaying(true);
      return;
    }
    // GSAP
    const tl = timelineRef.current;
    if (!tl) return;
    tl.play();
    setIsPlaying(true);
  };

  const handlePause = () => {
    const animType = iframeWindowRef.__animationMode?.type;
    if (animType === "css") {
      cssCancelRaf();
      cssAnimsRef.current.forEach((anim) => {
        try { anim.pause(); } catch (_) {}
      });
      setIsPlaying(false);
      return;
    }
    // GSAP
    const tl = timelineRef.current;
    if (!tl) return;
    tl.pause();
    setIsPlaying(false);
  };

  const handleRestart = () => {
    const animType = iframeWindowRef.__animationMode?.type;
    if (animType === "css") {
      cssCancelRaf();
      cssCurrentMsRef.current = 0;
      cssAnimsRef.current.forEach((anim) => {
        try { anim.pause(); anim.currentTime = 0; } catch (_) {}
      });
      cssStartRaf();
      setCurrentTime(0);
      setIsPlaying(true);
      return;
    }
    // GSAP
    const tl = timelineRef.current;
    if (!tl) return;
    tl.pause();
    tl.seek(0);
    setCurrentTime(0);
    setIsPlaying(false);
  };

  const handleSeek = (t) => {
    const animType = iframeWindowRef.__animationMode?.type;
    if (animType === "css") {
      cssCancelRaf();
      const ms = t * 1000;
      cssCurrentMsRef.current = ms;
      cssAnimsRef.current.forEach((anim) => {
        try { anim.pause(); anim.currentTime = ms; } catch (_) {}
      });
      setCurrentTime(t);
      setIsPlaying(false);
      return;
    }
    // GSAP
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
