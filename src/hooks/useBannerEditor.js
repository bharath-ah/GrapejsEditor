import { useCallback, useEffect, useRef, useState } from "react";
import grapesjs from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import { getGrapesConfig, STYLE_SECTORS } from "../config/grapesConfig";
import { cleanBannerHtml } from "../utils/cleanBannerHtml";
import { parseTweenData } from "../utils/parseTweenData";

/**
 * useBannerEditor
 *
 * Custom hook that:
 * 1. Initialises GrapesJS in the provided container ref.
 * 2. Registers Typography / Dimension style sectors.
 * 3. Wires selection listeners (sync computed styles → style manager,
 *    pause animation on select, refresh layer manager).
 * 4. On editor "load", fetches /index.html, cleans it, loads it into
 *    the canvas, injects head styles into the iframe, and runs
 *    parseTweenData() to capture animation tween definitions.
 * 5. Sets iframeReady = true to trigger the animation useEffect.
 *
 * @param {{
 *  timelineRef: React.MutableRefObject<gsap.core.Timeline|null>,
 *  setIsPlaying: (v: boolean) => void,
 *  setIframeReady:(v: boolean) => void,
 * }} deps
 *
 * @returns {{
 *  editorRef: React.RefObject<HTMLDivElement>,
 *  layerPanelRef: React.RefObject<HTMLDivElement>,
 *  iframeWindowRef: React.MutableRefObject<Window|null>,
 *  editorInstanceRef:React.MutableRefObject<any>,
 * }}
 */
export function useBannerEditor({ setIframeReady, htmlContent }) {
  const editorRef = useRef(null);
  const layerPanelRef = useRef(null);
  const iframeWindowRef = useRef(null);
  const editorInstanceRef = useRef(null);
  const timelineRef = useRef(null);

  const [dialogPos, setDialogPos] = useState(null);
  const [selectedStyles, setSelectedStyles] = useState({});
  const [selectedTagName, setSelectedTagName] = useState("");
  const [selectedElementId, setSelectedElementId] = useState("");

  const selectedComponentRef = useRef(null);

  // Helper: convert 'background-color' → 'backgroundColor' for el.style access
  const cssToJs = (prop) =>
    prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

  const closeDialog = useCallback(() => {
    setDialogPos(null);
    selectedComponentRef.current = null;
  }, []);

  // Handler called by PropertyDialog on every field change.
  // Writes BOTH to the iframe element's inline style (immediate visual effect)
  // AND to the GrapesJS model (so GrapesJS stays in sync).
  const handleStyleChange = useCallback(
    (prop, value) => {
      // If the component is completely gone from GrapesJS, destroy the dialog
      if (
        !selectedComponentRef.current ||
        !selectedComponentRef.current.getEl
      ) {
        closeDialog();
        return;
      }

      const cmp = selectedComponentRef.current;

      if (prop === "id") {
        const el = cmp.getEl();
        // Use the raw DOM mutation AND update the semantic component model.
        // E.g., changing ID is often tricky in GrapesJS but `.addAttributes` works.
        cmp.addAttributes({ id: value });
        if (el) el.id = value;
        setSelectedElementId(value);
        return;
      }

      // Pass styling down to GrapesJS
      cmp.addStyle({ [prop]: value });

      // Force it as an inline style to bypass any high-specificity #id rules from the original CSS
      const el = cmp.getEl && cmp.getEl();
      if (el) {
        el.style[cssToJs(prop)] = value;
      }

      // Instantly force UI update
      setSelectedStyles((prev) => ({ ...prev, [prop]: value }));
    },
    [closeDialog],
  );

  useEffect(() => {
    if (!editorRef.current) return;

    // ----------------------------------------------------------------
    // 1. Initialise GrapesJS
    // ----------------------------------------------------------------
    const editor = grapesjs.init(
      getGrapesConfig({
        container: editorRef.current,
        layerPanel: layerPanelRef.current,
        blockPanel: "#blocks-container",
      }),
    );

    editorInstanceRef.current = editor;

    editor.on("load", () => {
      const iframeDoc = editor.Canvas.getDocument();

      // (Early attempt) Make any existing table cells editable.
      // The definitive application happens AFTER setComponents (below).
      if (iframeDoc) {
        iframeDoc.querySelectorAll("td, th").forEach((cell) => {
          cell.setAttribute("contenteditable", "true");
        });
      }

      // Catch image drags onto the canvas specifically for files
      iframeDoc.addEventListener("dragover", (e) => {
        // Only prevent default if we're dragging a file (prevents overriding native GrapesJS blocks)
        if (
          e.dataTransfer &&
          e.dataTransfer.types &&
          e.dataTransfer.types.includes("Files")
        ) {
          e.preventDefault();
        }
      });

      iframeDoc.addEventListener("drop", (e) => {
        const files = e.dataTransfer && e.dataTransfer.files;
        if (!files || !files.length) {
          // If it's not a file (e.g. dragging a GrapesJS block), let GrapesJS natively handle the drop!
          return;
        }
        e.preventDefault();
        e.stopPropagation();

        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target.result;
          const hoverCmp = editor.getSelected();
          if (!hoverCmp) return;

          const el = hoverCmp.getEl ? hoverCmp.getEl() : null;

          // ✅ Case 1: real GrapesJS image component
          if (hoverCmp.is && hoverCmp.is("image")) {
            hoverCmp.set("src", dataUrl);
            return;
          }

          // ✅ Case 2: div that contains an <img> (legacy banner image)
          if (el && el.tagName && el.tagName.toLowerCase() === "div") {
            const img = el.querySelector("img");
            if (img) {
              img.src = dataUrl;
              return;
            }

            // ✅ Case 3: background-image fallback
            hoverCmp.addStyle({ "background-image": `url('${dataUrl}')` });
            el.style.backgroundImage = `url('${dataUrl}')`;
            return;
          }

          // ✅ Case 4: no selection → create new image
          editor.addComponents({
            type: "image",
            src: dataUrl,
            style: { width: "100px", height: "auto" },
          });
        };
        if (files[0]) reader.readAsDataURL(files[0]);
      });
    });

    // Wire up the asset manager's manual upload handler here because
    // it needs a reference to `editor`, which only exists after init.
    editor.AssetManager.config.uploadFile = (e) => {
      const files = e.dataTransfer ? e.dataTransfer.files : e.target.files;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = ev.target.result;
        editor.AssetManager.add({ src });

        const selected = editor.getSelected();
        if (!selected) return;

        const el = selected.getEl ? selected.getEl() : null;

        // ✅ Direct image component
        if (selected.is && selected.is("image")) {
          selected.setAttributes({ src });
          return;
        }

        // ✅ Div containing an image
        if (el) {
          const img = el.querySelector("img");
          if (img) {
            img.src = src;
            return;
          }

          // ✅ Background-image fallback
          selected.addStyle({ "background-image": `url('${src}')` });
          el.style.backgroundImage = `url('${src}')`;
        }
      };

      if (files[0]) reader.readAsDataURL(files[0]);
    };

    // ----------------------------------------------------------------
    // 2. Style sector helpers
    // ----------------------------------------------------------------
    const addSectors = () => {
      STYLE_SECTORS.forEach(({ id, name, open, properties }) => {
        editor.StyleManager.addSector(id, { name, open, properties });
      });
    };

    const updateStyleSectors = (component) => {
      let isText = false;

      if (component) {
        const type = component.get("type");
        const classes = component.get("classes") || [];
        const hasTextClass = classes.some((c) => c.get("name") === "text");

        const el = component.getEl && component.getEl();
        const hasContent = el && el.textContent && el.textContent.trim();

        isText =
          type === "text" ||
          hasTextClass ||
          (!!hasContent && /\S/.test(hasContent));
      }

      editor.StyleManager.getSectors().forEach((sector) => {
        const name = sector.get("name");
        if (name === "Typography") sector.set("visible", isText);
        else if (name === "Dimension") sector.set("visible", !!component);
        else if (name === "Background") sector.set("visible", !!component);
      });
    };

    // ----------------------------------------------------------------
    // 3. GrapesJS event listeners
    // ----------------------------------------------------------------
    editor.on("load", () => {
      addSectors();
      updateStyleSectors(editor.getSelected());
    });

    // Sync computed styles into style manager AND populate the PropertyDialog
    editor.on("component:selected", (cmp) => {
      if (!cmp) return;
      const iframeWin = iframeWindowRef.current;
      const el = cmp.getEl && cmp.getEl();
      if (!iframeWin || !el) return;

      const cs = iframeWin.getComputedStyle(el);

      // Only update the style panel selector visibility — do NOT write
      // computed values back into the GrapesJS model via setStyle/addStyle.
      updateStyleSectors(cmp);

      // ── Populate PropertyDialog ──────────────────────────────────────
      selectedComponentRef.current = cmp;
      setSelectedTagName(el.tagName.toLowerCase());
      setSelectedElementId(el.id || "");

      // Collect all relevant CSS values from computedStyle
      const ALL_PROPS = [
        "font-size",
        "font-family",
        "font-weight",
        "color",
        "text-align",
        "width",
        "height",
        "position",
        "top",
        "left",
        "right",
        "bottom",
        "background-color",
        "opacity",
        "padding",
        "padding-top",
        "padding-right",
        "padding-bottom",
        "padding-left",
        "margin",
      ];
      const styles = {};
      ALL_PROPS.forEach((p) => {
        styles[p] = cs.getPropertyValue(p) || "";
      });
      setSelectedStyles(styles);

      // Translate the element's iframe bounding rect to main-window screen coords
      const frameEl = editor.Canvas.getFrameEl();
      const frameRect = frameEl
        ? frameEl.getBoundingClientRect()
        : { left: 0, top: 0 };
      const elRect = el.getBoundingClientRect();
      setDialogPos({
        x: frameRect.left + elRect.right,
        y: frameRect.top + elRect.top,
      });
    });

    editor.on("component:update:style", (component) => {
      updateStyleSectors(component);

      // Sync GrapesJS style model to inline styles to overcome specificity conflicts
      if (component) {
        const el = component.getEl && component.getEl();
        if (el) {
          const gStyles = component.getStyle() || {};
          Object.keys(gStyles).forEach((prop) => {
            if (gStyles[prop] !== undefined) {
              el.style[cssToJs(prop)] = gStyles[prop];
            }
          });
        }
      }
    });

    editor.on("component:update:attributes", updateStyleSectors);

    // GWD banners: flattenGWDBanner extracts content into a flat structure
    // (div#page1 → content elements directly).  The wrapper components no
    // longer exist so no special non-selectable marking is needed.
    // Kept as a no-op guard in case a fallback path still emits wrappers.
    editor.on("component:add", (component) => {
      try {
        const attrs = component.getAttributes?.() ?? {};
        if (attrs["data-gwd-role"] === "wrapper") {
          component.set({ selectable: false }); // hoverable stays true
        }
      } catch (_) {}
    });

    
    // We only need tl.pause() here — setIsPlaying lives in useBannerTimeline
    // and will sync automatically when the onUpdate callback stops firing.
    const stopOnSelect = () => {
      const tl = timelineRef.current;
      if (tl) tl.pause();
    };
    editor.on("component:selected", stopOnSelect);

    // Close dialog when canvas deselects (click on empty canvas area)
    editor.on("component:deselected", closeDialog);

    // Also close when the user clicks inside the iframe but not on an element
    // (GrapesJS may not fire deselected for clicks on the iframe background)
    const attachIframeClickAway = () => {
      const frameEl = editor.Canvas.getFrameEl();
      if (!frameEl) return;
      frameEl.contentDocument.addEventListener("click", (e) => {
        // If click target has no GrapesJS-selected ancestor, close
        if (!e.target.closest && !e.target.id) closeDialog();
      });
    };
    editor.on("load", attachIframeClickAway);

    // ------------------------------------------------------------------
    // Drag-and-drop position tracking (see original comments)
    // ------------------------------------------------------------------
    editor.on("component:drag:end", ({ component }) => {
      if (!component) return;
      const el = component.getEl && component.getEl();
      if (!el) return;

      // Ensure the element is absolutely positioned so top/left take effect
      if (!el.style.position || el.style.position === "static") {
        el.style.position = "absolute";
      }

      // Read what GrapesJS computed for top / left during the drag
      const gStyle = component.getStyle() || {};
      ["top", "left", "right", "bottom", "position"].forEach((prop) => {
        const val = gStyle[prop];
        if (val && val !== "auto") {
          el.style[cssToJs(prop)] = val;
        }
      });

      // If the property dialog is open for this component, refresh its position fields
      if (selectedComponentRef.current === component) {
        const iframeWin = iframeWindowRef.current;
        if (iframeWin) {
          const cs = iframeWin.getComputedStyle(el);
          setSelectedStyles((prev) => ({
            ...prev,
            position: cs.position,
            top: cs.top,
            left: cs.left,
            right: cs.right,
            bottom: cs.bottom,
          }));

          // Also reposition the dialog to follow the element
          const frameEl = editor.Canvas.getFrameEl();
          const frameRect = frameEl
            ? frameEl.getBoundingClientRect()
            : { left: 0, top: 0 };
          const elRect = el.getBoundingClientRect();
          setDialogPos({
            x: frameRect.left + elRect.right,
            y: frameRect.top + elRect.top,
          });
        }
      }
    });

    // ----------------------------------------------------------------
    // 4. Load banner HTML on editor ready
    // ----------------------------------------------------------------
    editor.on("load", () => {
      if (!htmlContent) return;

      function flattenGWDBanner(html) {
        const doc = new DOMParser().parseFromString(html, "text/html");

        // ── Step 1: Convert GWD custom elements → standard HTML ──────────
        doc
          .querySelectorAll("gwd-metric-configuration")
          .forEach((el) => el.remove());
        doc.querySelectorAll("gwd-exit").forEach((el) => el.remove());

        doc.querySelectorAll("gwd-image").forEach((el) => {
          const img = doc.createElement("img");
          img.id = el.id;
          img.className = el.className;
          img.src = el.getAttribute("source") || "";
          el.replaceWith(img);
        });

        doc.querySelectorAll("gwd-taparea").forEach((el) => {
          const div = doc.createElement("div");
          div.id = el.id;
          div.className = el.className;
          el.replaceWith(div);
        });

        // ── Step 2: Extract content into a FLAT 2-level structure ────────

        // of #page1 still match — no animation CSS needs to change.
        const pageContent = doc.querySelector(".gwd-page-content");
        const pageEl =
          doc.querySelector("gwd-page") ||
          doc.querySelector("[id='page1']") ||
          doc.querySelector(".gwd-page-wrapper");

        if (pageContent) {
          const container = doc.createElement("div");
          container.id = pageEl?.id || "page1";
          container.className =
            pageEl?.className || "gwd-page-wrapper gwd-page-size gwd-lightbox";

          // Move all visual children out of .gwd-page-content into container
          while (pageContent.firstChild) {
            container.appendChild(pageContent.firstChild);
          }

          return container.outerHTML;
        }

        // ── Fallback: full flatten for non-standard GWD structure ────────
        //   doc.querySelectorAll("gwd-google-ad").forEach((el) => {
        //     const div = doc.createElement("div");
        //     Array.from(el.attributes).forEach((a) =>
        //       div.setAttribute(a.name, a.value),
        //     );
        //     div.setAttribute("data-gwd-role", "wrapper");
        //     div.innerHTML = el.innerHTML;
        //     el.replaceWith(div);
        //   });

        //   doc.querySelectorAll("gwd-pagedeck").forEach((el) => {
        //     const div = doc.createElement("div");
        //     div.setAttribute("data-gwd-role", "wrapper");
        //     div.innerHTML = el.innerHTML;
        //     el.replaceWith(div);
        //   });

        //   doc.querySelectorAll("gwd-page").forEach((el) => {
        //     const div = doc.createElement("div");
        //     div.id = el.id;
        //     div.className = el.className;
        //     div.innerHTML = el.innerHTML;
        //     el.replaceWith(div);
        //   });

        //   return doc.body.innerHTML;
      }

      const processHtml = (htmlText) => {
        const { headElems, bodyHtml, bodyScripts, base64Backgrounds } =
          cleanBannerHtml(htmlText);

        // Load visible markup into the GrapesJS canvas

        const normalizedHtml = bodyHtml.includes("gwd-")
          ? flattenGWDBanner(bodyHtml)
          : bodyHtml;

        editor.setComponents(normalizedHtml);

        // Wait for the canvas iframe to render before inspecting it
        setTimeout(() => {
          const frameEl = editor.Canvas.getFrameEl();
          if (!frameEl) return;

          const iframeDoc = frameEl.contentDocument;
          const iframeWin = frameEl.contentWindow;
          iframeWindowRef.current = iframeWin;

          iframeDoc
            .querySelectorAll('[class^="gwd-taparea-"], gwd-taparea')
            .forEach((el) => {
              el.style.pointerEvents = "none";
              el.style.opacity = "0";
            });

          const root =
            iframeDoc.getElementById("page1") ||
            iframeDoc.querySelector(".gwd-page-wrapper") ||
            iframeDoc.body;

          // Ensure visibility
          root.classList.remove("gwd-inactive", "transparent");
          root.style.visibility = "visible";

          // ✅ IMPORTANT: force animation restart
          root.classList.remove("gwd-play-animation");
          void root.offsetWidth; // FORCE REFLOW
          root.classList.add("gwd-play-animation");

          const editorFix = iframeDoc.createElement("style");
          editorFix.textContent = `
/* Editor-safe CSS animation support.
 * After flat extraction, content elements are direct children of #page1
 * (no .gwd-page-content intermediate layer), so the selector targets #page1. */
#page1 *, .gwd-page-wrapper * {
  animation-fill-mode: both !important;
}
`;
          iframeDoc.head.appendChild(editorFix);

          // After flat extraction, content is directly inside div#page1.
          // Ensure it has a defined size so the banner is visible.
          const pageContainer =
            iframeDoc.getElementById("page1") ||
            iframeDoc.querySelector(".gwd-page-wrapper");
          if (pageContainer && !pageContainer.style.width) {
            pageContainer.style.position = "relative";
          }

          // ✅ Inject jQuery stub for legacy banners
          const jqueryStubScript = iframeDoc.createElement("script");
          jqueryStubScript.setAttribute("data-editor-only", "true");
          jqueryStubScript.textContent = `
(function(){
  const jqObj = {
    ready: fn => { try { fn(); } catch(e){} return jqObj; },
    css: () => jqObj,
    animate: () => jqObj,
    hover: () => jqObj,
    stop: () => jqObj,
    on: () => jqObj,
    bind: () => jqObj,
    addClass: () => jqObj,
    removeAttr: () => jqObj,
    data: () => null,
    position: () => ({ top: 0, left: 0 }),
    height: () => 0,
    width: () => 0,
    tinyscrollbar: () => jqObj,
    tinyscrollbar_update: () => jqObj
  };

  window.$ = window.jQuery = function(){ return jqObj; };
  window.jQuery.fn = {};
})();
`;
          iframeDoc.head.appendChild(jqueryStubScript);

          // ✅ Inject Enabler stub for Google Web Designer banners
          const enablerStubScript = iframeDoc.createElement("script");
          enablerStubScript.setAttribute("data-editor-only", "true");
          enablerStubScript.textContent = `
(function () {
  if (window.Enabler) return;

  window.Enabler = {
    isInitialized: () => true,
    isPageLoaded: () => true,
    isVisible: () => true,
    addEventListener: (evt, fn) => {
      try { fn(); } catch(e) {}
    },
    removeEventListener: () => {},
    exit: () => {},
    exitOverride: () => {},
    counter: () => {},
    startTimer: () => {},
    stopTimer: () => {},
    reportManualClose: () => {},
    setResponsiveSize: () => {},
    requestExpand: () => {},
    requestCollapse: () => {},
    requestFullscreenExpand: () => {},
    requestFullscreenCollapse: () => {},
    finishExpand: () => {},
    finishCollapse: () => {},
    finishFullscreenExpand: () => {},
    finishFullscreenCollapse: () => {},
    loadModule: (_, cb) => cb && cb(),
    isServingInLiveEnvironment: () => false,
    queryFullscreenSupport: () => {},
  };

  window.studio = {
    events: {
      StudioEvent: {
        INIT: "INIT",
        PAGE_LOADED: "PAGE_LOADED",
        VISIBLE: "VISIBLE",
        EXPAND_START: "EXPAND_START",
        COLLAPSE_START: "COLLAPSE_START",
        FULLSCREEN_EXPAND_START: "FULLSCREEN_EXPAND_START",
        FULLSCREEN_COLLAPSE_START: "FULLSCREEN_COLLAPSE_START",
        EXPAND_FINISH: "EXPAND_FINISH",
        COLLAPSE_FINISH: "COLLAPSE_FINISH",
        FULLSCREEN_EXPAND_FINISH: "FULLSCREEN_EXPAND_FINISH",
        FULLSCREEN_COLLAPSE_FINISH: "FULLSCREEN_COLLAPSE_FINISH",
        FULLSCREEN_DIMENSIONS: "FULLSCREEN_DIMENSIONS",
      }
    }
  };
})();
`;
          iframeDoc.head.appendChild(enablerStubScript);

          // Inject <style> tags from the original <head> into the iframe.
          // Skip external <script> tags (jquery, Enabler, TweenMax).
          headElems.forEach((el) => {
            const tag = el.tagName.toLowerCase();

            if (tag === "script") return;

            const newEl = iframeDoc.createElement(tag);
            Array.from(el.attributes).forEach((a) =>
              newEl.setAttribute(a.name, a.value),
            );
            if (tag === "style" || tag === "script") {
              newEl.textContent = el.textContent;
            }
            iframeDoc.head.appendChild(newEl);
          });

          // ── GWD animation lifecycle activation ──────────────────────────────
          // MUST run AFTER all <style> / <script> tags from the original <head>
          // are injected above, so that:
          //   a) @keyframes rules exist when gwd-play-animation class is added
          //   b) GWD custom-element JS has already run and upgraded the elements
          //
         
          // We reset both immediately so the banner is visually present.
          (() => {
            // 1. Undo polite-load body hide (gwd-google-ad side-effect)
            iframeDoc.body.style.opacity = "";

            // 2. Collect all GWD page elements (deduplicated)
            const seen = new Set();
            const add = (el) => {
              if (el) seen.add(el);
            };
            iframeDoc.querySelectorAll("gwd-page").forEach(add);
            iframeDoc.querySelectorAll(".gwd-page-wrapper").forEach(add);
            add(iframeDoc.getElementById("page1"));

            seen.forEach((page) => {
              // 3. Undo visibility:hidden from gwd-page.connectedCallback
              page.style.visibility = "";
              // 4. Remove classes that hide the page before initAd fires
              page.classList.remove("transparent", "gwd-inactive");
              // 5. Trigger the CSS keyframe animations
              if (!page.classList.contains("gwd-play-animation")) {
                page.classList.add("gwd-play-animation");
              }
            });
          })();

          // ✅✅✅ NEW ADDITION — MAKE LEGACY TEXT EDITABLE ✅✅✅
          // Applies to <div id="TextX" class="textProps"> like Text2

          iframeDoc
            .querySelectorAll("div[id^='Text'], .textProps")
            .forEach((el) => {
              // Disable banner click logic
              // el.removeAttribute("onClick");
              // el.onclick = null;

              // Enable editing
              el.setAttribute("contenteditable", "true");
              el.style.pointerEvents = "auto";
              el.style.cursor = "text";
              el.style.userSelect = "text";

              // ✅ CRITICAL FIXES FOR OVERLAP
              // Preserve absolute position but allow content to grow
              el.style.height = "auto"; // <-- THIS FIXES PUSH-DOWN
              el.style.minHeight = "1em"; // safety
              el.style.whiteSpace = "normal"; // allow wrapping
              el.style.overflow = "visible"; // prevent clipping

              // Keep original animation positioning
              if (!el.style.position || el.style.position === "static") {
                el.style.position = "absolute";
              }
            });
          //image url
          iframeDoc.querySelectorAll('[id^="Image"]').forEach((div) => {
            const cs = iframeWin.getComputedStyle(div);
            const bg = div.style.backgroundImage || cs.backgroundImage;
            if (!bg || bg === "none") return;

            const match = bg.match(/url\(["']?(.*?)["']?\)/);
            if (!match) return;

            const imgSrc = match[1];
            const id = div.id;

            // 🔑 Replace DOM element with a GrapesJS image component
            const wrapper = editor.DomComponents.getWrapper();
            const comps = wrapper.find(`#${id}`);
            if (!comps || !comps.length) return;

            const cmp = comps[0];

            cmp.replaceWith({
              type: "image",
              attributes: {
                id,
                src: imgSrc,
              },
              style: {
                width: div.style.width || cs.width,
                height: div.style.height || cs.height,
                position: "absolute",
                top: cs.top,
                left: cs.left,
                opacity: cs.opacity,
              },
            });
          });
          

          // Inject editor-only CSS overrides to make custom scrollbar areas natively scrollable
          const editorScrollStyle = iframeDoc.createElement("style");
          editorScrollStyle.setAttribute("data-editor-only", "true");
          editorScrollStyle.textContent = `
#scrollbar1, .scrollbar1 {
  height: 100% !important;
}
#viewport, .viewport {
  overflow-y: auto !important;
  height: 100% !important;
  width: 100% !important;
  pointer-events: auto !important;
}
#overview, .overview {
  position: static !important;
  height: auto !important;
}
/* Enable table editing */
table {
  pointer-events: auto !important;
}
table td, table th {
  pointer-events: auto !important;
  user-select: text !important;
  cursor: text !important;
}
table td[contenteditable="true"],
table th[contenteditable="true"] {
  cursor: text !important;
}

/* ── Editor-only: text visibility ──────────────────────────────────────────
   Force all text elements to remain in the render tree (display:block) so
   they are always selectable/editable in the GrapesJS canvas.

   WHY !important beats GSAP:
     GSAP sets inline styles WITHOUT !important.  A CSS rule with !important
     wins the cascade over a normal inline style.  So "display: block" here
     prevents any tween's "display:none" from hiding the element.

   WHY opacity is NOT forced here:
     We intentionally omit an opacity override so GSAP can fade elements in
     and out normally — the fade animations still work exactly as authored.
   ─────────────────────────────────────────────────────────────────────── */
#canvas-page > [id^="Text"],
#canvas-page > .textProps,
#canvas-page [id^="Text"],
#canvas-page .textProps {
  display: block !important;
}

/* ── Editor-only: z-index safety ───────────────────────────────────────────
   Elevate direct-child text elements above chart / image background layers
   so they are always clickable and visible in the editor stacking order.
   This selector is scoped to direct children of #canvas-page to avoid
   interfering with text inside the scrollbar ISI section.
   ─────────────────────────────────────────────────────────────────────── */
#canvas-page > [id^="Text"],
#canvas-page > .textProps {
  z-index: 9999 !important;
}

/* ── Editor-only: overflow fix ─────────────────────────────────────────────
   Remove the hard clip on the banner root so any element that starts
   off-screen (e.g. Text1 at left:-300px before its slide-in animation)
   is not invisible-and-unclickable in the editor.  The iframe boundary
   already prevents content from spilling outside the editor panel.

   Image/chart wrapper divs also get overflow:visible so their backgrounds
   don't create unexpected clipping boxes.
   ─────────────────────────────────────────────────────────────────────── */
#canvas-page {
  overflow: visible !important;
}
#canvas-page > [id^="Image"],
#canvas-page canvas,
#canvas-page svg {
  overflow: visible !important;
}
`;
          iframeDoc.head.appendChild(editorScrollStyle);

          // === ✅ Make table cells editable AFTER the HTML is present ===
          iframeDoc.querySelectorAll("td, th").forEach((cell) => {
            cell.setAttribute("contenteditable", "true");
          });

          // === ✅ Keep future table cells editable as content changes ===
          try {
            const cellObserver = new iframeWin.MutationObserver((mutations) => {
              for (const m of mutations) {
                if (!m.addedNodes) continue;
                m.addedNodes.forEach((n) => {
                  if (n.nodeType !== 1) return; // elements only
                  if (n.matches?.("td, th")) {
                    n.setAttribute("contenteditable", "true");
                  } else {
                    n.querySelectorAll?.("td, th").forEach((cell) => {
                      cell.setAttribute("contenteditable", "true");
                    });
                  }
                });
              }
            });
            cellObserver.observe(iframeDoc.body, {
              subtree: true,
              childList: true,
            });
          } catch {
            // MutationObserver not available: ignore gracefully.
          }

          // ----------------------------------------------------------
          // 4a. Restore base64 inline background images
          // ----------------------------------------------------------
          if (base64Backgrounds && Object.keys(base64Backgrounds).length > 0) {
            const wrapper = editor.DomComponents.getWrapper();
            Object.keys(base64Backgrounds).forEach((id) => {
              const comps = wrapper.find(`#${id}`);
              if (comps && comps.length > 0) {
                // Push directly to GrapesJS model overriding parser bug
                comps[0].addStyle({
                  "background-image": base64Backgrounds[id],
                });
                // Instantly apply to live iframe element as well
                const el = comps[0].getEl();
                if (el) el.style.backgroundImage = base64Backgrounds[id];
              }
            });
          }

          // Clear the undo history so the user can't "undo" the initial banner load
          // and accidentally delete the entire HTML structure.
          editor.UndoManager.clear();

          // ----------------------------------------------------------
          // Custom drag-and-drop (transform approach)
          // ----------------------------------------------------------
          (function attachCustomDrag() {
            const root = iframeDoc.getElementById("wrapper") || iframeDoc.body;

            let pending = null; // element mousedown'd on (pre-threshold)
            let dragged = null; // element actually being dragged (post-threshold)
            let startMX = 0,
              startMY = 0;
            let curDX = 0,
              curDY = 0; // latest mouse delta
            const THRESHOLD = 5; // px — smaller = click, larger = drag

            iframeDoc.addEventListener(
              "mousedown",
              (e) => {
                const target = e.target.closest
                  ? e.target.closest("[id]")
                  : e.target.id
                    ? e.target
                    : null;

                if (!target || target === iframeDoc.body || target === root)
                  return;
                if (e.detail > 1) return; // ignore multi-clicks

                // Ignore clicks on scrollbars so user can scroll natively
                if (target.clientWidth > 0 && e.offsetX >= target.clientWidth)
                  return;
                if (target.clientHeight > 0 && e.offsetY >= target.clientHeight)
                  return;

                // Only record — do NOT touch any element styles here
                pending = target;
                startMX = e.clientX;
                startMY = e.clientY;
                curDX = curDY = 0;
                dragged = null;
              },
              true,
            );

            iframeDoc.addEventListener(
              "mousemove",
              (e) => {
                if (!pending) return;

                curDX = e.clientX - startMX;
                curDY = e.clientY - startMY;

                if (!dragged) {
                  // Below threshold → still a click, not a drag
                  if (
                    Math.abs(curDX) < THRESHOLD &&
                    Math.abs(curDY) < THRESHOLD
                  )
                    return;

                  // Threshold crossed → start dragging
                  e.preventDefault();
                  dragged = pending;
                  dragged.style.zIndex = "9999";
                  dragged.style.cursor = "grabbing";
                  dragged.style.userSelect = "none";
                }

                // Move purely via CSS transform — zero DOM/parent change
                dragged.style.transform = `translate(${curDX}px,${curDY}px)`;
              },
              true,
            );

            iframeDoc.addEventListener(
              "mouseup",
              () => {
                pending = null;
                if (!dragged) return; // was just a click — restore nothing

                // -- Compute the final position relative to its current containing block --
                const cs = iframeWin.getComputedStyle(dragged);
                const currentTop = dragged.offsetTop;
                const currentLeft = dragged.offsetLeft;
                const mt = parseFloat(cs.marginTop) || 0;
                const ml = parseFloat(cs.marginLeft) || 0;

                const finalTop = currentTop + curDY - mt;
                const finalLeft = currentLeft + curDX - ml;

                // -- Remove the transform, apply new top/left --
                // We DO NOT reparent the element, keeping its CSS inheritance intact.
                dragged.style.transform = "";
                // If static, we make it relative to allow top/left to offset it from its original flow location
                let newPos = cs.position;
                if (cs.position === "static") {
                  dragged.style.position = "relative";
                  newPos = "relative";
                }
                dragged.style.top = finalTop + "px";
                dragged.style.left = finalLeft + "px";
                dragged.style.right = "";
                dragged.style.bottom = "";

                // Remove the drag-state styles
                dragged.style.zIndex = "";
                dragged.style.cursor = "";
                dragged.style.userSelect = "";

                // -- Sync the final styles back to the GrapesJS model so UndoManager tracks it --
                if (dragged.id) {
                  const comps = editor.DomComponents.getWrapper().find(
                    `#${dragged.id}`,
                  );
                  if (comps && comps.length > 0) {
                    comps[0].addStyle({
                      position: newPos,
                      top: finalTop + "px",
                      left: finalLeft + "px",
                      right: "",
                      bottom: "",
                    });
                  }
                }

                // -- Sync property dialog if open for this element --
                if (
                  selectedComponentRef.current &&
                  selectedComponentRef.current.getEl &&
                  selectedComponentRef.current.getEl() === dragged
                ) {
                  setSelectedStyles((prev) => ({
                    ...prev,
                    position: newPos,
                    top: finalTop + "px",
                    left: finalLeft + "px",
                    right: "",
                    bottom: "",
                  }));

                  const fEl = editor.Canvas.getFrameEl();
                  const fRect = fEl
                    ? fEl.getBoundingClientRect()
                    : { left: 0, top: 0 };
                  const eRect = dragged.getBoundingClientRect();
                  setDialogPos({
                    x: fRect.left + eRect.right,
                    y: fRect.top + eRect.top,
                  });
                }

                dragged = null;
              },
              true,
            );
          })();

          // ------------------------------------------------------------------
          // Enable image replacement in the editor.
          
      
          // Runs once on banner load. Idempotent — no-ops when an <img>
          // already exists inside the div (safe on timeline rebuilds).
          // ------------------------------------------------------------------
          iframeDoc.querySelectorAll('[id^="Image"]').forEach((div) => {
            // Guard: skip if a child <img> was already inserted.
            if (div.querySelector("img")) return;

            // Read the background-image from the element's inline style first;
            // fall back to the computed value (covers stylesheet-only rules).
            const cs = iframeWin.getComputedStyle(div);
            const bgRaw = div.style.backgroundImage || cs.backgroundImage || "";

            // Extract the URL from  url("…")  or  url(…).
            const urlMatch = bgRaw.match(/url\(["']?([^"')]+)["']?\)/);
            if (!urlMatch) return; // div carries no image — nothing to convert

            const imgUrl = urlMatch[1];

            // Build the replacement <img>.
            const img = iframeDoc.createElement("img");
            img.src = imgUrl;
            img.alt = "";
            // Fill the parent div completely; object-fit:contain keeps
            // the original aspect ratio without cropping.
            img.style.width = "100%";
            img.style.height = "100%";
            img.style.objectFit = "contain";
            img.style.display = "block";
            img.style.pointerEvents = "auto";

            // Remove the CSS background so the <img> is the sole visual.
            div.style.backgroundImage = "none";
            div.style.backgroundSize = "";
            div.style.backgroundRepeat = "";

            // Keep pointer-events on the wrapper so the injected <img>
            // inherits click-ability from its parent container.
            div.style.pointerEvents = "auto";

            div.appendChild(img);
          });

          // ------------------------------------------------------------------
          // Animation-system detection (runs once on banner load)
          //
          // Priority order mirrors the Playwright DETECT_JS detector:
          //   1. GSAP 2 — window.tweens already populated by banner script
          //   2. GSAP 2 — TweenMax.getAllTweens()
          //   3. GSAP 3 — gsap.globalTimeline.getChildren()
          //   4. CSS    — document.getAnimations()
          //   5. none
          
          const tweenData = parseTweenData(bodyScripts, htmlText);
          iframeWindowRef.__tweenData = tweenData;

          // ── Animation-type detection ──────────────────────────────────────
          // Priority:
          //   1. parseTweenData found GSAP tweens in the script source → gsap
          //      (most reliable — does not depend on runtime GSAP state)
          //   2. window.tweens populated by banner script at runtime      → gsap
          //   3. TweenMax.getAllTweens()                                   → gsap
          //   4. gsap.globalTimeline.getChildren()                         → gsap
          //   5. document.getAnimations() — CSS / GWD banner               → css
          //      ↑ intentionally NOT in an else block: runs even when
          //        window.gsap is in scope (leftover from a prior banner)
          //        but the current banner has zero GSAP tweens.
          //   6. fallback                                                   → none
          try {
            let detectedType = "none";

            // ── GSAP (static — most reliable) ────────────────────────────
            if (tweenData && tweenData.length > 0) {
              detectedType = "gsap";
            }
            // ── GSAP (runtime fallbacks) ──────────────────────────────────
            else if (iframeWin.tweens && iframeWin.tweens.length > 0) {
              detectedType = "gsap";
            } else if (
              typeof iframeWin.TweenMax !== "undefined" &&
              typeof iframeWin.TweenMax.getAllTweens === "function"
            ) {
              const all = iframeWin.TweenMax.getAllTweens(true);
              if (all && all.length > 0) {
                iframeWin.tweens = all;
                detectedType = "gsap";
              }
            } else if (
              typeof iframeWin.gsap !== "undefined" &&
              iframeWin.gsap.globalTimeline
            ) {
              const children = iframeWin.gsap.globalTimeline.getChildren(
                true,
                true,
                true,
              );
              if (children && children.length > 0) {
                iframeWin.tweens = children;
                detectedType = "gsap";
              }
            }

            // ── CSS / GWD fallback ────────────────────────────────────────
            if (detectedType === "none") {
              const cssAnims =
                typeof iframeDoc.getAnimations === "function"
                  ? iframeDoc.getAnimations()
                  : [];
              if (cssAnims.length > 0) {
                detectedType = "css";
              }
            }

            iframeWindowRef.__animationMode = { type: detectedType };
          } catch (_detectionErr) {
            iframeWindowRef.__animationMode = { type: "none" };
          }
          // -----------------------------------------------------------------

         
          

          // Signal the animation hook to build the GSAP timeline
          setIframeReady(true);
        }, 100);
      };

      processHtml(htmlContent);
    });

    // ----------------------------------------------------------------
    // 5. Cleanup
    // ----------------------------------------------------------------
    return () => {
      editor.off("component:selected", stopOnSelect);
      if (
        timelineRef.current &&
        typeof timelineRef.current.kill === "function"
      ) {
        timelineRef.current.kill();
      }
      editor.destroy();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    editorRef,
    layerPanelRef,
    iframeWindowRef,
    editorInstanceRef,
    timelineRef,
    // Property dialog
    dialogPos,
    selectedStyles,
    selectedTagName,
    selectedElementId,
    handleStyleChange,
    closeDialog,
  };
}
