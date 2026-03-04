/**
 * cleanBannerHtml
 *
 * Parses a raw HTML string (from public/index.html), removes elements that
 * would interfere with the GrapesJS editor (noscript fallback images, the
 * #links click-through overlay), then splits the document into three pieces
 * that the editor setup code can use independently.
 *
 * @param {string} htmlText  Raw HTML string fetched from /index.html
 * @returns {{
 *   headElems:    Element[],  // All <head> children (styles, meta, inline scripts)
 *   bodyHtml:     string,     // Body innerHTML WITHOUT <script> tags (editable markup)
 *   bodyScripts:  Element[],  // <script> nodes from <body> (animation code)
 * }}
 */
export function cleanBannerHtml(htmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, "text/html");

  // Remove noscript fallback and the #links click-through overlay so they
  // don't block clicks inside the GrapesJS canvas.
  doc.querySelectorAll("noscript").forEach((n) => n.remove());
  const overlay = doc.getElementById("links");
  if (overlay) overlay.remove();

  // Remove all HTML comments from the body so GrapesJS doesn't parse them as visible text nodes
  const iterator = doc.createNodeIterator(doc.body, NodeFilter.SHOW_COMMENT, null, false);
  const comments = [];
  let curNode;
  while ((curNode = iterator.nextNode())) {
    comments.push(curNode);
  }
  comments.forEach((c) => c.remove());

  const headElems = Array.from(doc.head.children);
  const bodyChildren = Array.from(doc.body.childNodes);

  // Separate scripts from visible markup so we can handle them differently:
  // markup → editor canvas, scripts → re-injected into iframe after render.
  const bodyScripts = bodyChildren.filter((n) => n.nodeName === "SCRIPT");
  const bodyWithoutScripts = bodyChildren.filter((n) => n.nodeName !== "SCRIPT");

  // -- FIX FOR GRAPESJS BASE64 INLINE STYLE PARSING BUG --
  // GrapesJS's string CSS parser chokes on semicolons inside url('data:image/jpeg;base64,...')
  // We extract these safely using the browser's DOM parser, remove them from the inline style,
  // and pass them back so they can be injected directly into the GrapesJS model via the API.
  const base64Backgrounds = {};
  let bgCounter = 0;

  // Traverse all elements in the parsed body to find background images & opacity
  const allElements = doc.body.querySelectorAll("*");
  allElements.forEach((el) => {
    // Make every element resizable by default in GrapesJS
    el.setAttribute("data-gjs-resizable", "true");

    // Auto-inject display based on inline opacity
    if (el.style && el.style.opacity !== "") {
      const op = parseFloat(el.style.opacity);
      if (!isNaN(op)) {
        el.style.display = op === 0 ? "none" : "block";
      }
    }

    if (el.style && el.style.backgroundImage && el.style.backgroundImage.includes("data:image")) {
      const bgImg = el.style.backgroundImage;
      // Assign a temporary ID if it doesn't have one so we can find it in GrapesJS later
      if (!el.id) {
        el.id = `grape-bg-fix-${bgCounter++}`;
      }
      base64Backgrounds[el.id] = bgImg;
      // Remove it from the inline style so GrapesJS string parser doesn't mangle it
      el.style.backgroundImage = "";
    }
  });

  // Inject display rules into <style> tags based on opacity
  headElems.forEach((el) => {
    if (el.tagName === "STYLE" && el.textContent) {
      el.textContent = el.textContent.replace(/opacity\s*:\s*([^;\}]+)(;?)/gi, (match, val, semi) => {
        const op = parseFloat(val);
        if (isNaN(op)) return match;
        const disp = op === 0 ? "none" : "block";
        return `opacity: ${val}${semi || ";"} display: ${disp}${semi || ";"}`;
      });
    }
  });

  // Inject display rules into GSAP vars objects in <script> tags
  bodyScripts.forEach((el) => {
    if (el.textContent) {
      el.textContent = el.textContent.replace(/opacity\s*:\s*([^,\s}]+)(\s*[,}])/gi, (match, val, suffix) => {
        const op = parseFloat(val);
        if (isNaN(op)) return match;
        const disp = op === 0 ? "none" : "block";
        return `opacity: ${val}, display: "${disp}"${suffix}`;
      });
    }
  });

  const bodyHtml = bodyWithoutScripts.map((n) => n.outerHTML || n.textContent).join("");

  return { headElems, bodyHtml, bodyScripts, base64Backgrounds };
}
