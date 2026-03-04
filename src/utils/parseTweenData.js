/**
 * parseTweenData
 *
 * Runs the banner's inline animation script (which normally calls
 * TweenLite.to() from inside pageLoadedHandler) in a safe sandbox so we
 * can intercept and record every tween definition without needing jQuery,
 * Enabler, or any other runtime dependency.
 *
 * Strategy
 * --------
 * 1. Parse a FRESH, uncleaned copy of htmlText so every element ID referenced
 *    by the script (including those inside the stripped #links overlay, e.g.
 *    banner_link, btn_link, piIsi) resolves to a real DOM node and won't throw
 *    a ReferenceError.
 * 2. Build a sandbox object whose keys become local variables inside a
 *    new Function(). The sandbox contains:
 *    - All element ID-globals          (frame1_text1, bg, Vemlidy_logo …)
 *    - A mock TweenLite / TweenMax     → records calls instead of animating
 *    - A chainable jQuery stub         → prevents $(doc).ready() from throwing
 *    - A mock Enabler                  → isPageLoaded() returns true immediately
 *    - Stubs for setTimeout / setInterval / clearInterval
 * 3. Execute scriptText + "\npageLoadedHandler();" inside the sandbox.
 * 4. Return the captured array of { elementId, duration, vars, position }.
 *    Caller looks up elementId against the live iframe document later,
 *    so stripped elements resolve to null and are skipped gracefully.
 *
 * @param {Element[]} bodyScripts  Script nodes from the banner's <body>
 * @param {string}    htmlText     Original (uncleaned) HTML string
 * @returns {{ elementId: string, duration: number, vars: object, position: number }[]}
 */
export function parseTweenData(bodyScripts, htmlText) {
  const captured = [];

  // ------------------------------------------------------------------
  // 1. Mock TweenLite — records { elementId, duration, vars, position }
  // ------------------------------------------------------------------
  const mockTween = {
    to(target, duration, vars) {
      const props = Object.assign({}, vars);
      const position = typeof props.delay === "number" ? props.delay : 0;
      delete props.delay;
      const elementId = target && target.id ? target.id : null;
      captured.push({ elementId, duration, vars: props, position });
      return mockTween;
    },
    from(target, duration, vars) {
      return mockTween.to(target, duration, vars);
    },
    set(target, vars) {
      return mockTween.to(target, 0, vars);
    },
  };

  // ------------------------------------------------------------------
  // 2. Build elementsById from a fresh uncleaned parse of the HTML
  //    so #links children (banner_link etc.) are available.
  //    Exclude IDs with hyphens — they aren't valid JS identifiers and
  //    would cause `new Function(...keys)` to throw.
  // ------------------------------------------------------------------
  const freshDoc = new DOMParser().parseFromString(htmlText, "text/html");
  const validIdentifier = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
  const elementsById = {};
  freshDoc.querySelectorAll("[id]").forEach((el) => {
    if (validIdentifier.test(el.id)) elementsById[el.id] = el;
  });

  // ------------------------------------------------------------------
  // 3. jQuery chainable stub — every method returns itself so chains
  //    like $(document).ready(fn) or $div.animate().hover() don't throw.
  // ------------------------------------------------------------------
  const jqObj = {
    ready: (fn) => {
      try {
        fn();
      } catch (_) {}
      return jqObj;
    },
    css: () => jqObj,
    animate: () => jqObj,
    hover: () => jqObj,
    stop: () => jqObj,
    on: () => jqObj,
    bind: () => jqObj,
    addClass: () => jqObj,
    tinyscrollbar: () => jqObj,
    tinyscrollbar_update: () => jqObj,
    height: () => 0,
    width: () => 0,
    position: () => ({ top: 0, left: 0 }),
    valueOf: () => jqObj,
  };
  const jqueryStub = () => jqObj;
  jqueryStub.fn = {};

  // ------------------------------------------------------------------
  // 4. Assemble sandbox
  // ------------------------------------------------------------------
  const enablerStub = {
    isPageLoaded: () => true,
    addEventListener: () => {},
    exit: () => {},
  };

  const sandbox = {
    // element id-globals: frame1_text1, bg, Vemlidy_logo …
    ...elementsById,

    TweenLite: mockTween,
    TweenMax: mockTween,
    Enabler: enablerStub,
    studio: { events: { StudioEvent: { PAGE_LOADED: "PAGE_LOADED" } } },

    $: jqueryStub,
    jQuery: jqueryStub,

    // banner script top-level vars
    counter: 1,
    enableHoverEffect: false,
    autoScroll: null,

    // timer stubs — we don't want real side-effects while parsing
    setTimeout: () => {},
    setInterval: () => {},
    clearInterval: () => {},

    document: freshDoc,
    window: {},
    console,
  };

  // ------------------------------------------------------------------
  // 5. Find and execute the inline script that defines pageLoadedHandler
  // ------------------------------------------------------------------
  const inlineScript = bodyScripts.find((s) => !s.src && s.textContent.includes("pageLoadedHandler"));
  const fullScriptText = inlineScript ? inlineScript.textContent : "";

  // If the script doesn't define pageLoadedHandler, we can't extract GSAP animations.
  // This happens when users upload static banners or banners with different animation setups.
  if (!fullScriptText.includes("function pageLoadedHandler(")) {
    console.warn("[parseTweenData] Could not find pageLoadedHandler script. Ignoring GSAP parsing.");
    return [];
  }

  const sandboxKeys = Object.keys(sandbox);
  try {
    // Define the isolated sandbox function.
    // We append "\npageLoadedHandler();" so it actually executes the animations.
    const sandboxFn = new Function(...sandboxKeys, fullScriptText + "\nif (typeof pageLoadedHandler === 'function') pageLoadedHandler();");
    sandboxFn(...sandboxKeys.map((k) => sandbox[k]));
  } catch (err) {
    console.error("[parseTweenData] Sandbox execution error:", err);
  }

  console.log("[parseTweenData] captured tweens:", captured.length, captured);
  return captured;
}
