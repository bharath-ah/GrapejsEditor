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
 *  1. Initialises GrapesJS in the provided container ref.
 *  2. Registers Typography / Dimension style sectors.
 *  3. Wires selection listeners (sync computed styles → style manager,
 *     pause animation on select, refresh layer manager).
 *  4. On editor "load", fetches /index.html, cleans it, loads it into
 *     the canvas, injects head styles into the iframe, and runs
 *     parseTweenData() to capture animation tween definitions.
 *  5. Sets iframeReady = true to trigger the animation useEffect.
 *
 * @param {{
 *   timelineRef:   React.MutableRefObject<gsap.core.Timeline|null>,
 *   setIsPlaying:  (v: boolean) => void,
 *   setIframeReady:(v: boolean) => void,
 * }} deps
 *
 * @returns {{
 *   editorRef:        React.RefObject<HTMLDivElement>,
 *   layerPanelRef:    React.RefObject<HTMLDivElement>,
 *   iframeWindowRef:  React.MutableRefObject<Window|null>,
 *   editorInstanceRef:React.MutableRefObject<any>,
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
  const cssToJs = (prop) => prop.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

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
      if (!selectedComponentRef.current || !selectedComponentRef.current.getEl) {
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

      // Catch image drags onto the canvas specifically for files
      iframeDoc.addEventListener("dragover", (e) => {
        // Only prevent default if we're dragging a file (prevents overriding native GrapesJS blocks)
        if (e.dataTransfer && e.dataTransfer.types && e.dataTransfer.types.includes("Files")) {
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
          // Find if we dropped onto an existing image or created a new one
          const hoverCmp = editor.getSelected();
          if (hoverCmp && hoverCmp.get("type") === "image") {
            hoverCmp.set("src", dataUrl);
          } else {
            editor.addComponents({
              type: "image",
              src: dataUrl,
              style: { width: "100px", height: "auto" },
            });
          }
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
        if (selected && selected.is("image")) selected.setAttributes({ src });
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

        isText = type === "text" || hasTextClass || (!!hasContent && /\S/.test(hasContent));
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
      // Doing so would permanently lock in animated values (e.g. opacity:0,
      // display:none) every time the user clicks, corrupting the element.
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
      const frameRect = frameEl ? frameEl.getBoundingClientRect() : { left: 0, top: 0 };
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

    // Pause animation when an element is selected so it stays visible for editing.
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
    // Drag-and-drop position tracking
    //
    // GrapesJS (dragMode:"absolute") computes new top+left from the mouse
    // drag delta and stores them in the component style model.  However,
    // the banner's original CSS uses ID-selectors (#frame1_text1 {...})
    // which have higher specificity than GrapesJS's class-based rules, so
    // the visual position never actually changes.
    //
    // Fix: on drag end, read the values GrapesJS wrote into the model and
    // also write them as INLINE styles on the real iframe element.  Inline
    // styles always win over any stylesheet rule regardless of specificity.
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

      // If the property dialog is open for this component, refresh its
      // position fields so they reflect the new coordinates
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
          const frameRect = frameEl ? frameEl.getBoundingClientRect() : { left: 0, top: 0 };
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

      const processHtml = (htmlText) => {
        const { headElems, bodyHtml, bodyScripts, base64Backgrounds } = cleanBannerHtml(htmlText);

        // Load visible markup into the GrapesJS canvas
        editor.setComponents(bodyHtml);

        // Wait for the canvas iframe to render before inspecting it
        setTimeout(() => {
          const frameEl = editor.Canvas.getFrameEl();
          if (!frameEl) return;

          const iframeDoc = frameEl.contentDocument;
          const iframeWin = frameEl.contentWindow;
          iframeWindowRef.current = iframeWin;

          // Inject <style> tags from the original <head> into the iframe.
          // Skip external <script> tags (jquery, Enabler, TweenMax) — we
          // don't need them and they'd cause unnecessary network requests.
          headElems.forEach((el) => {
            const tag = el.tagName.toLowerCase();
            if (tag === "script" && el.getAttribute("src")) return;
            const newEl = iframeDoc.createElement(tag);
            Array.from(el.attributes).forEach((a) => newEl.setAttribute(a.name, a.value));
            if (tag === "style" || tag === "script") {
              newEl.textContent = el.textContent;
            }
            iframeDoc.head.appendChild(newEl);
          });

          // Inject editor-only CSS overrides to make custom scrollbar areas natively scrollable
          const editorScrollStyle = iframeDoc.createElement("style");
          editorScrollStyle.setAttribute("data-editor-only", "true");
          editorScrollStyle.textContent = `
            #scrollbar1, .scrollbar1 { height: 100% !important; }
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
          `;
          iframeDoc.head.appendChild(editorScrollStyle);

          // ----------------------------------------------------------
          // 4a. Restore base64 inline background images
          // ----------------------------------------------------------
          if (base64Backgrounds && Object.keys(base64Backgrounds).length > 0) {
            const wrapper = editor.DomComponents.getWrapper();
            Object.keys(base64Backgrounds).forEach((id) => {
              const comps = wrapper.find(`#${id}`);
              if (comps && comps.length > 0) {
                // Push directly to GrapesJS model overriding parser bug
                comps[0].addStyle({ "background-image": base64Backgrounds[id] });

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
          // Custom drag-and-drop  (transform approach)
          //
          // WHY transform instead of top/left during drag:
          // Moving an element via top/left requires position:absolute and
          // potentially reparenting it. Reparenting breaks CSS inheritance
          // (the element loses colors/fonts from its parent chain).
          //
          // Instead we:
          //  1. mousedown  → record intent; touch NOTHING.
          //  2. mousemove ≥5px → set `transform:translate(dx,dy)` only.
          //     Element stays in its original DOM container → no visual
          //     change other than its X/Y position.
          //  3. mouseup → compute final screen rect, bake ALL computed
          //     styles as inline styles (so they survive reparenting),
          //     remove the transform, reparent to #wrapper, set final
          //     absolute top/left.
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
                const target = e.target.closest ? e.target.closest("[id]") : e.target.id ? e.target : null;
                if (!target || target === iframeDoc.body || target === root) return;
                if (e.detail > 1) return; // ignore multi-clicks

                // Ignore clicks on scrollbars so user can scroll natively
                if (target.clientWidth > 0 && e.offsetX >= target.clientWidth) return;
                if (target.clientHeight > 0 && e.offsetY >= target.clientHeight) return;

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
                  if (Math.abs(curDX) < THRESHOLD && Math.abs(curDY) < THRESHOLD) return;
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
                // The element has moved visually by exact pixels: curDX and curDY.
                // We read its current offset properties and add the delta.
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
                  const comps = editor.DomComponents.getWrapper().find(`#${dragged.id}`);
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
                if (selectedComponentRef.current && selectedComponentRef.current.getEl && selectedComponentRef.current.getEl() === dragged) {
                  setSelectedStyles((prev) => ({
                    ...prev,
                    position: newPos,
                    top: finalTop + "px",
                    left: finalLeft + "px",
                    right: "",
                    bottom: "",
                  }));
                  const fEl = editor.Canvas.getFrameEl();
                  const fRect = fEl ? fEl.getBoundingClientRect() : { left: 0, top: 0 };
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

          // Parse animation definitions from the banner script in a sandbox

          const tweenData = parseTweenData(bodyScripts, htmlText);
          // Store on the ref (not iframe window) so it survives GSAP resets
          iframeWindowRef.__tweenData = tweenData;

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
      if (timelineRef.current && typeof timelineRef.current.kill === "function") {
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
