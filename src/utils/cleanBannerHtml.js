export function cleanBannerHtml(htmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, "text/html");

  // Remove noscript + click overlay
  doc.querySelectorAll("noscript").forEach((n) => n.remove());
  const overlay = doc.getElementById("links");
  if (overlay) overlay.remove();

  // Remove HTML comments
  const iterator = doc.createNodeIterator(
    doc.body,
    NodeFilter.SHOW_COMMENT,
    null,
    false,
  );
  let node;
  while ((node = iterator.nextNode())) {
    node.remove();
  }

  const headElems = Array.from(doc.head.children);
  const bodyChildren = Array.from(doc.body.childNodes);

  const bodyScripts = bodyChildren.filter((n) => n.nodeName === "SCRIPT");
  const bodyWithoutScripts = bodyChildren.filter(
    (n) => n.nodeName !== "SCRIPT",
  );

  /* -------------------------------------------------------
     Banner type detection
  ------------------------------------------------------- */
  const isGSAPBanner =
    htmlText.includes("TweenLite") ||
    htmlText.includes("TweenMax") ||
    htmlText.includes("window.tweens");

  const isGWDBanner =
    htmlText.includes("gwd-") ||
    htmlText.includes("gwd-page") ||
    htmlText.includes("gwd-image");

  /* -------------------------------------------------------
     ✅ GSAP SCRIPT PATCH (Vemlidy etc.)
     Safe for both banners
  ------------------------------------------------------- */
  if (isGSAPBanner) {
    //Inject display rules into <style> tags based on opacity
    headElems.forEach((el) => {
      if (el.tagName === "STYLE" && el.textContent) {
        el.textContent = el.textContent.replace(
          /opacity\s*:\s*([^;\}]+)(;?)/gi,
          (match, val, semi) => {
            const op = parseFloat(val);
            if (isNaN(op)) return match;
            const disp = op === 0 ? "none" : "block";
            return `opacity: ${val}${semi || ";"} display: ${disp}${semi || ";"}`;
          },
        );
      }
    });

    bodyScripts.forEach((el) => {
      if (!el.textContent) return;

      el.textContent = el.textContent.replace(
        /opacity\s*:\s*([^,\s}]+)(\s*[,}])/gi,
        (match, val, suffix) => {
          const op = parseFloat(val);
          if (isNaN(op)) return match;
          const disp = op === 0 ? "none" : "block";
          return `opacity: ${val}, display: "${disp}"${suffix}`;
        },
      );
    });
  }

  /* -------------------------------------------------------
     ❌ DO NOT PATCH <style> FOR GWD
     This is intentionally disabled
  ------------------------------------------------------- */
  // if (isGWDBanner) {
  //   DO NOTHING
  // }

  /* -------------------------------------------------------
     Build GrapesJS-safe body HTML
  ------------------------------------------------------- */
  const bodyHtml = bodyWithoutScripts
    .map((n) => n.outerHTML || n.textContent)
    .join("");

  return {
    headElems,
    bodyHtml,
    bodyScripts,
    base64Backgrounds: {},
  };
}
