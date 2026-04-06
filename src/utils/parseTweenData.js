/**
 * parseTweenData
 *
 * Runs the banner's inline animation script in a safe sandbox so we
 * can intercept and record tween definitions.
 *
 * Supports:
 *  - TweenMax.to / from / set  (GSAP v1 3-arg syntax)
 *  - TimelineMax().to()        (GSAP v1 3-arg syntax)
 *  - gsap.to / gsap.timeline().to()  (GSAP v3 2-arg syntax)
 *  - animationRepeat(arrObject) pattern used by legacy banners
 */
export function parseTweenData(bodyScripts, htmlText) {
  const captured = [];

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  /**
   * Normalise GSAP vars so they are safe to forward to a GSAP v3 timeline.
   *
   * Problems we fix here:
   *  - `transform: "translate3d(...)"` is a raw CSS string that GSAP v3
   *    cannot consume (it manages transforms internally).
   *  - `webkitTransformOrigin` is a vendor-prefixed alias; drop it (GSAP
   *    v3 uses `transformOrigin`).
   *  - `ease: "NONE"` → `ease: "none"` (GSAP v3 is case-sensitive).
   *  - Callback functions (`onComplete`, `onUpdate`, `onStart`, …) must be
   *    removed so they don't fire against stub globals later.
   */
  function normalizeVars(rawVars) {
    const v = { ...rawVars };

    // Drop CSS transform string — GSAP v3 handles transforms via its own
    // properties (x, y, rotation, scale, …).
    if (typeof v.transform === "string") delete v.transform;

    // Drop webkit-prefixed transform origin.
    delete v.webkitTransformOrigin;

    // Normalise ease value.
    if (typeof v.ease === "string" && v.ease.toUpperCase() === "NONE") {
      v.ease = "none";
    }

    // Strip lifecycle callbacks — they reference functions from the original
    // banner scope that would throw in our sandbox / editor environment.
    ["onComplete", "onStart", "onUpdate", "onRepeat", "onReverseComplete"].forEach(
      (k) => delete v[k],
    );

    return v;
  }

  /**
   * Resolve a mixed targets argument (element, array of elements, nested
   * arrays like [[el]], CSS selector string) to a flat array of DOM elements.
   */
  function resolveTargets(targets) {
    const flat = [];
    const visit = (item) => {
      if (!item) return;
      if (Array.isArray(item)) { item.forEach(visit); return; }
      if (typeof item === "string") {
        // CSS selector — try the freshDoc
        try { freshDoc.querySelectorAll(item).forEach((el) => flat.push(el)); } catch {}
        return;
      }
      if (item.nodeType === 1) { flat.push(item); return; }
    };
    visit(targets);
    return flat;
  }

  /**
   * Record a single tween from any call signature.
   *
   * Handles both:
   *   v1:  (targets, duration, vars)
   *   v3:  (targets, vars)          ← duration inside vars.duration
   */
  function captureTween(targets, durationOrVars, maybeVars) {
    let dur, rawVars;

    if (typeof durationOrVars === "number") {
      // GSAP v1 three-argument form
      dur = durationOrVars;
      rawVars = maybeVars || {};
    } else {
      // GSAP v3 two-argument form
      rawVars = durationOrVars || {};
      dur = typeof rawVars.duration === "number" ? rawVars.duration : 0;
    }

    const v = normalizeVars(rawVars);
    const position = typeof v.delay === "number" ? v.delay : 0;
    delete v.delay;

    resolveTargets(targets).forEach((el) => {
      if (el && el.id) {
        captured.push({ elementId: el.id, duration: dur, vars: v, position });
      }
    });
  }

  // ------------------------------------------------------------------
  // 1. Capturing mock for TweenLite / TweenMax (GSAP v1 direct calls)
  // ------------------------------------------------------------------
  const mockTween = {
    to(target, durationOrVars, vars) {
      captureTween(target, durationOrVars, vars);
      return mockTween;
    },
    from(target, durationOrVars, vars) {
      captureTween(target, durationOrVars, vars);
      return mockTween;
    },
    set(target, vars) {
      captureTween(target, 0, vars);
      return mockTween;
    },
  };

  // ------------------------------------------------------------------
  // 2. Fresh DOM so element IDs resolve inside the sandbox
  // ------------------------------------------------------------------
  const freshDoc = new DOMParser().parseFromString(htmlText, "text/html");
  const validIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
  const elementsById = {};

  freshDoc.querySelectorAll("[id]").forEach((el) => {
    if (validIdentifier.test(el.id)) elementsById[el.id] = el;
  });

  // ------------------------------------------------------------------
  // 3. jQuery stub — enough surface area to prevent crashes
  // ------------------------------------------------------------------
  const jqObj = {
    ready: (fn) => { try { fn(); } catch {} return jqObj; },
    css: () => jqObj,
    animate: () => jqObj,
    hover: () => jqObj,
    stop: () => jqObj,
    on: () => jqObj,
    bind: () => jqObj,
    addClass: () => jqObj,
    removeClass: () => jqObj,
    removeAttr: () => jqObj,
    toggleClass: () => jqObj,
    trigger: () => jqObj,
    find: () => jqObj,
    each: () => jqObj,
    tinyscrollbar: () => jqObj,
    tinyscrollbar_update: () => jqObj,
    data: () => ({ plugin_tinyscrollbar: { update: () => {} } }),
    position: () => ({ top: 0, left: 0 }),
    height: () => 0,
    width: () => 0,
    offset: () => ({ top: 0, left: 0 }),
  };

  const jqueryStub = (sel) => {
    if (typeof sel === "function") { try { sel(); } catch {} }
    return jqObj;
  };
  jqueryStub.fn = {};
  jqueryStub.event = { fix: (e) => e };

  // ------------------------------------------------------------------
  // 4. Capturing timeline factory
  //
  //    Returns a timeline-like object whose .to() / .from() / .set()
  //    methods record tweens regardless of whether they are called with
  //    the GSAP v1 three-argument form (targets, duration, vars) or the
  //    GSAP v3 two-argument form (targets, vars).
  // ------------------------------------------------------------------
  function makeCapturingTimeline() {
    const tl = {
      to(targets, durationOrVars, vars) {
        captureTween(targets, durationOrVars, vars);
        return tl;
      },
      from(targets, durationOrVars, vars) {
        captureTween(targets, durationOrVars, vars);
        return tl;
      },
      fromTo(targets, fromVars, toVars) {
        captureTween(targets, toVars);
        return tl;
      },
      set(targets, vars) {
        captureTween(targets, 0, vars);
        return tl;
      },
      add() { return tl; },
      call() { return tl; },
      pause() { return tl; },
      play() { return tl; },
      kill() {},
      totalDuration() { return 0; },
      duration() { return 0; },
      getChildren() { return []; },
      eventCallback() { return tl; },
    };
    return tl;
  }

  // ------------------------------------------------------------------
  // 5. GSAP v3 stub — delegates to the capturing helpers above
  // ------------------------------------------------------------------
  const gsapStub = {
    to(targets, durationOrVars, vars) {
      captureTween(targets, durationOrVars, vars);
      return { kill: () => {}, pause: () => {} };
    },
    from(targets, durationOrVars, vars) {
      captureTween(targets, durationOrVars, vars);
      return { kill: () => {}, pause: () => {} };
    },
    fromTo(targets, fromVars, toVars) {
      captureTween(targets, toVars);
      return { kill: () => {}, pause: () => {} };
    },
    set(targets, vars) {
      captureTween(targets, 0, vars);
      return { kill: () => {}, pause: () => {} };
    },
    // gsap.timeline() — the main entry point used by animationRepeat()
    timeline: makeCapturingTimeline,
    ticker: { fps: () => {}, add: () => {}, remove: () => {} },
    registerPlugin: () => {},
    utils: { toArray: (x) => (Array.isArray(x) ? x : [x]) },
  };

  // ------------------------------------------------------------------
  // 6. TimelineMax / TweenMax stubs (GSAP v1)
  //    Both delegate to the same capturing infrastructure.
  // ------------------------------------------------------------------
  const TimelineMaxStub = function (vars) {   // eslint-disable-line no-unused-vars
    return makeCapturingTimeline();
  };
  TimelineMaxStub.prototype = {};

  const TweenMaxStub = {
    ...mockTween,
    // Static class methods used by some banners
    killAll: () => {},
    killTweensOf: () => {},
    set(targets, vars) { captureTween(targets, 0, vars); return mockTween; },
  };

  // ------------------------------------------------------------------
  // 7. Sandbox — everything a legacy banner script might reference
  // ------------------------------------------------------------------
  const sandbox = {
    // Element IDs as direct variables (some banners use them bare)
    ...elementsById,

    // GSAP v1
    TweenLite: mockTween,
    TweenMax: TweenMaxStub,
    TimelineMax: TimelineMaxStub,
    TimelineLite: TimelineMaxStub,

    // GSAP v3
    gsap: gsapStub,

    // Platform / SDK stubs
    Enabler: {
      isPageLoaded: () => true,
      isInitialized: () => true,
      addEventListener: (evt, fn) => { try { fn(); } catch {} },
      removeEventListener: () => {},
      exit: () => {},
      exitOverride: () => {},
    },
    studio: { events: { StudioEvent: { PAGE_LOADED: "PAGE_LOADED" } } },

    // jQuery
    $: jqueryStub,
    jQuery: jqueryStub,

    // Timer stubs — prevent real async execution during parsing
    setTimeout: () => 0,
    setInterval: () => 0,
    clearTimeout: () => {},
    clearInterval: () => {},
    requestAnimationFrame: () => 0,

    // DOM
    document: freshDoc,
    window: {
      addEventListener: () => {},
      removeEventListener: () => {},
      onload: null,
    },
    console,
  };

  // ------------------------------------------------------------------
  // 8. Find and execute the banner's animation script
  //
  //    Priority order:
  //      a) Script containing pageLoadedHandler  (most banners)
  //      b) Script containing animationRepeat    (arrObject-style banners)
  //      c) First non-empty inline script        (fallback)
  // ------------------------------------------------------------------
  let inlineScript =
    bodyScripts.find((s) => !s.src && s.textContent.includes("pageLoadedHandler")) ||
    bodyScripts.find((s) => !s.src && s.textContent.includes("animationRepeat")) ||
    bodyScripts.find((s) => !s.src && s.textContent.trim().length > 0);

  if (!inlineScript) return [];

  try {
    const keys = Object.keys(sandbox);

    // Append the trigger at the end: call pageLoadedHandler if defined,
    // otherwise call animationRepeat(arrObject) directly if both exist.
    const trigger = `
if (typeof pageLoadedHandler === 'function') {
  pageLoadedHandler();
} else if (typeof animationRepeat === 'function' && typeof arrObject !== 'undefined') {
  animationRepeat(arrObject);
}
`;

    const fn = new Function(...keys, inlineScript.textContent + trigger);
    fn(...keys.map((k) => sandbox[k]));
  } catch (e) {
    console.error("[parseTweenData] Sandbox execution error:", e);
  }

  console.log("[parseTweenData] captured", captured.length, "tweens");
  return captured;
}
