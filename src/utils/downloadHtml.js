/**
 * Generates the GSAP script string from the tween data.
 */
function buildGsapScript(tweenData) {
  let script = `
        // Frame 1 animation starts (Replaced by Editor)
        var ts = [];
        window.tweens = ts;
`;

  tweenData.forEach((tween) => {
    // If no elementId is found (e.g. stripped out element), skip
    if (!tween.elementId) return;

    const target = tween.elementId;
    const dur = tween.duration;
    const pos = tween.position;

    // Helper to stringify an object as a raw JS string
    const stringifyObj = (obj) => {
      const innerVars = Object.entries(obj)
        .map(([k, v]) => {
          let valStr;
          if (typeof v === "object" && v !== null) {
            valStr = stringifyObj(v);
          } else if (typeof v === "string") {
            valStr = `"${v}"`;
          } else {
            valStr = v;
          }
          return `${k}: ${valStr}`;
        })
        .join(", ");
      return `{ ${innerVars} }`;
    };

    // If it's a fade/slide with explicit from/to states
    if (tween.vars.fromVars && tween.vars.toVars) {
      const fromStr = stringifyObj(tween.vars.fromVars);
      const toObj = { ...tween.vars.toVars, delay: pos };
      const toStr = stringifyObj(toObj);
      script += `        ts.push(TweenLite.fromTo(${target}, ${dur}, ${fromStr}, ${toStr}));\n`;
    } else {
      // It's a standard tween
      // Remove fromVars or toVars from top-level if they somehow got orphaned
      const cleanVars = { ...tween.vars };
      delete cleanVars.fromVars;
      delete cleanVars.toVars;

      const varsObj = { ...cleanVars, delay: pos };
      const varsStr = stringifyObj(varsObj);
      script += `        ts.push(TweenLite.to(${target}, ${dur}, ${varsStr}));\n`;
    }
  });

  return script;
}

/**
 * rebuildAndDownloadHtml
 *
 * Takes the current state of the editor (iframe visually) and the __tweenData,
 * merges them into the original index.html file, and triggers a download.
 * If returnAsString is true, returns the raw HTML string instead of downloading.
 */
export async function rebuildAndDownloadHtml(htmlContent, iframeWindowRef, timelineRef, editorInstanceRef, returnAsString = false) {
  const win = iframeWindowRef.current;
  const tweenData = iframeWindowRef.__tweenData || [];
  const editor = editorInstanceRef ? editorInstanceRef.current : null;

  if (!win) {
    alert("Iframe is not ready yet.");
    return;
  }

  if (!htmlContent) {
    alert("No HTML content provided.");
    return;
  }

  // 1. Rewind the timeline to 0 so we capture the true baseline styles,
  // not mid-animation styles (like opacity: 0 halfway through a fade).
  if (timelineRef.current) {
    timelineRef.current.pause();
    timelineRef.current.progress(0);
  }

  // Wait a tick for GSAP to apply progress(0) styles
  await new Promise((resolve) => setTimeout(resolve, 50));

  try {
    // 2. Use the provided htmlContent string directly
    const originalHtml = htmlContent;

    // 3. Extract the clean layout from the iframe.
    // Try to find the specific wrapper GrapesJS uses or the original #wrapper.
    let liveWrapper = win.document.querySelector('div[data-gjs-type="wrapper"]') || win.document.getElementById("wrapper");

    let newWrapperHtml = "";
    if (liveWrapper) {
      // Clean up any stray GrapesJS selection classes before capturing
      const clone = liveWrapper.cloneNode(true);
      clone.querySelectorAll(".gjs-selected").forEach((el) => el.classList.remove("gjs-selected"));
      newWrapperHtml = clone.outerHTML;
    } else {
      // If there's no main wrapper div, the user's HTML just has elements directly in the body.
      // We need to grab the whole body innerHTML, but exclude GrapesJS's injected <style> and <script> tags.
      const cloneBody = win.document.body.cloneNode(true);
      cloneBody.querySelectorAll(".gjs-selected").forEach((el) => el.classList.remove("gjs-selected"));
      // Remove GrapesJS injected styles/scripts at the end of the body
      Array.from(cloneBody.children).forEach((child) => {
        if (child.tagName === "SCRIPT" || child.tagName === "STYLE") {
          // We only want to export the visible HTML elements back into the body
          child.remove();
        }
      });
      newWrapperHtml = cloneBody.innerHTML;
    }

    if (!newWrapperHtml) {
      alert("Could not find any content in the editor to download.");
      return;
    }

    // 4. Replace the old block in the original HTML with the new one.
    const parser = new DOMParser();
    const doc = parser.parseFromString(originalHtml, "text/html");

    let oldWrapper = doc.getElementById("wrapper");

    if (oldWrapper) {
      // Replace just the wrapper div
      const tempDiv = doc.createElement("div");
      tempDiv.innerHTML = newWrapperHtml;
      oldWrapper.replaceWith(tempDiv.firstElementChild || tempDiv);
    } else {
      // The original document didn't have a wrapper div.
      // We must replace the contents of the <body>, BUT we must keep the original <script> tags
      // that were at the bottom of the body (like the ISI scroll script).

      // Save the original scripts
      const originalScripts = Array.from(doc.body.querySelectorAll("script"));
      const originalStyles = Array.from(doc.body.querySelectorAll("style"));

      // Replace body content with the new visual content
      doc.body.innerHTML = newWrapperHtml;

      // Re-append the original scripts and styles that were inside the body
      originalStyles.forEach((s) => doc.body.appendChild(s));
      originalScripts.forEach((s) => doc.body.appendChild(s));
    }

    // 5. Build the new JS lines for pageLoadedHandler
    const newGsapCalls = buildGsapScript(tweenData);

    // 6. Rewrite the script block inside the document.
    // The user specifically requested that pageLoadedHandler is changed but OTHER things
    // (like hover logic, scroll function) remain.
    // We will look for all scripts and find the one containing pageLoadedHandler.
    const scripts = doc.querySelectorAll("script");
    let scriptModified = false;

    scripts.forEach((script) => {
      if (script.textContent.includes("function pageLoadedHandler()")) {
        // Regex to replace everything inside pageLoadedHandler() between window.tweens = ts;
        // and scrollTrap();
        // This is highly specific to the provided index.html structure.

        let content = script.textContent;

        // Find the start of the GSAP animation block
        const startMarkerStr = "window.tweens = ts;";
        const endMarkerStr = "scrollTrap();";

        const startIndex = content.indexOf(startMarkerStr);
        const endIndex = content.indexOf(endMarkerStr);

        if (startIndex !== -1 && endIndex !== -1) {
          const before = content.substring(0, startIndex + startMarkerStr.length);
          const after = content.substring(endIndex);

          script.textContent = before + "\n" + newGsapCalls + "\n        " + after;
          scriptModified = true;
        }
      }
    });

    if (!scriptModified && tweenData.length > 0) {
      console.warn("Could not find existing pageLoadedHandler. Injecting a new one at the bottom of the body.");
      const newScript = doc.createElement("script");
      newScript.textContent = `
        function pageLoadedHandler() {
          ${newGsapCalls}
        }
        window.addEventListener('load', pageLoadedHandler);
      `;
      doc.body.appendChild(newScript);
    }

    // 7. Inject GrapesJS CSS if available
    // GrapesJS extracts inline styles into CSS rules. We must reinject them to preserve the design.
    if (editor) {
      const css = editor.getCss();
      if (css && css.trim()) {
        const styleEl = doc.createElement("style");
        styleEl.innerHTML = css;
        doc.head.appendChild(styleEl);
      }
    }

    // Rewrite local script references to public CDNs so the downloaded file runs standalone
    const scriptTags = doc.querySelectorAll("script[src]");
    let hasTweenMax = false;
    scriptTags.forEach((s) => {
      const src = s.getAttribute("src");
      if (src.includes("TweenMax") || src.includes("gsap")) {
        s.setAttribute("src", "https://cdnjs.cloudflare.com/ajax/libs/gsap/2.1.3/TweenMax.min.js");
        hasTweenMax = true;
      } else if (src.includes("Enabler.js")) {
        s.setAttribute("src", "https://s0.2mdn.net/ads/studio/Enabler.js");
      } else if (src.includes("jquery") && !src.includes("tinyscrollbar")) {
        s.setAttribute("src", "https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js");
      }
    });

    if (!hasTweenMax) {
      const gsapScript = doc.createElement("script");
      gsapScript.src = "https://cdnjs.cloudflare.com/ajax/libs/gsap/2.1.3/TweenMax.min.js";
      doc.head.appendChild(gsapScript);
    }

    // 8. Serialize the document back to an HTML string
    // DOCTYPE is missing from basic XMLSerializer, so prepend it.
    const serializer = new XMLSerializer();
    let finalHtml = serializer.serializeToString(doc);

    // Clean up XML namespaces that XMLSerializer sometimes adds to <html>
    finalHtml = finalHtml.replace(' xmlns="http://www.w3.org/1999/xhtml"', "");
    finalHtml = "<!doctype html>\n" + finalHtml;

    // VERY IMPORTANT FIX: XMLSerializer dangerously escapes `<` to `&lt;` and `>` to `&gt;`
    // inside inline <script> tags, which completely breaks JavaScript syntax like `<=` or `->`.
    // We must unescape these entities before downloading so the JS works properly.
    finalHtml = finalHtml.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

    // 8. Trigger Download or Return String
    if (returnAsString) {
      return finalHtml;
    }

    const blob = new Blob([finalHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "index_edited.html";
    document.body.appendChild(a);
    a.click();

    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  } catch (err) {
    console.error("Error building download HTML:", err);
    alert("Failed to build HTML. See console for details.");
    if (returnAsString) return null;
  }
}
