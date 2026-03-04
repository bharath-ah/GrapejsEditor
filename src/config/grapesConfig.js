/**
 * getGrapesConfig
 *
 * Returns the GrapesJS init() options object.
 * Kept as a function (not a plain object) so `container` and `layerPanel`
 * can be bound at runtime — they are DOM refs that don't exist at module load.
 *
 * @param {{ container: HTMLElement, layerPanel: HTMLElement }} refs
 * @returns {import('grapesjs').EditorConfig}
 */
export function getGrapesConfig({ container, layerPanel, blockPanel }) {
  return {
    container,
    height: "600px",
    width: "100%",
    storageManager: false,
    dragMode: "absolute",

    // Block Manager configuration
    blockManager: {
      appendTo: blockPanel,
      blocks: [
        {
          id: "box",
          label: "Box", // Text only, SVG hidden by CSS
          content: '<div style="min-height: 50px; min-width: 50px; padding: 10px;" data-gjs-resizable="true"></div>',
        },
        {
          id: "text",
          label: "Text",
          content: '<div data-gjs-type="text" data-gjs-resizable="true">Insert your text here</div>',
        },
        {
          id: "image",
          label: "Image",
          content: { type: "image", resizable: true },
        },
        {
          id: "link",
          label: "Link",
          content: '<a href="#" data-gjs-type="link" data-gjs-resizable="true">Link text</a>',
        },
      ],
    },

    assetManager: {
      // File upload is handled manually via FileReader in useBannerEditor.js
      upload: false,
    },

    // Style sectors are added dynamically after the editor loads so we can
    // tailor them to the selected component type.
    styleManager: {
      sectors: [],
    },

    // Render the built-in Layer Manager into our custom sidebar div.
    layerManager: { appendTo: layerPanel },

    deviceManager: {
      devices: [
        {
          id: "desktop",
          name: "Desktop",
          width: "", // default size
        },
        {
          id: "tablet",
          name: "Tablet",
          width: "768px",
          widthMedia: "992px",
        },
        {
          id: "mobile",
          name: "Mobile",
          width: "320px",
          widthMedia: "480px",
        },
      ],
    },

    canvas: {
      // Load GSAP 3 inside the iframe so the animation timeline can use it.
      scripts: ["https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"],
      styles: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Style sector definitions
// Exported as a plain array so they can be used / tested independently.
// ---------------------------------------------------------------------------

/** @type {import('grapesjs').SectorProperties[]} */
export const STYLE_SECTORS = [
  {
    id: "typography",
    name: "Typography",
    open: true,
    properties: [
      {
        property: "font-family",
        type: "select",
        defaultValue: "Arial, Helvetica, sans-serif",
      },
      { property: "font-size", type: "text" },
      { property: "color", type: "color" },
      {
        property: "text-align",
        type: "radio",
        list: [
          { value: "left", className: "fa fa-align-left" },
          { value: "center", className: "fa fa-align-center" },
          { value: "right", className: "fa fa-align-right" },
        ],
      },
    ],
  },
  {
    id: "dimension",
    name: "Dimension",
    open: true,
    properties: [
      { property: "width", type: "text" },
      { property: "height", type: "text" },
      { property: "opacity", type: "slider", step: 0.01, min: 0, max: 1 },
    ],
  },
  {
    id: "background",
    name: "Background",
    open: false,
    properties: [
      { property: "background-color", type: "color" },
      { property: "background-image", type: "text" },
      { property: "background-size", type: "text" },
      { property: "background-position", type: "text" },
      {
        property: "background-repeat",
        type: "select",
        list: [
          { value: "repeat", name: "Repeat" },
          { value: "repeat-x", name: "Repeat X" },
          { value: "repeat-y", name: "Repeat Y" },
          { value: "no-repeat", name: "No Repeat" },
        ],
        defaultValue: "no-repeat",
      },
    ],
  },
];
