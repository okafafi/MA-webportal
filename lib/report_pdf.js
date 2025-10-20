import fs from "node:fs";
import path from "node:path";

// Use the internal base class so we can override constructor behavior safely.
import BaseDocument from "pdfkit/lib/document.js";

// Subclass that prevents Helvetica AFM loading during construction.
class PatchedDocument extends BaseDocument {
  initDefaultFont() {
    // Do nothing; we will select Inter explicitly right after construction.
    return this;
  }
}

// Factory: always construct PatchedDocument (never the default export).
export function createPdfDoc(opts = {}) {
  const doc = new PatchedDocument({
    size: "A4",
    margin: 36,
    bufferPages: true,
    autoFirstPage: false,
    ...opts,
  });

  // Load Inter fonts from public/fonts/
  const interRegular = fs.readFileSync(path.join(process.cwd(), "public/fonts/Inter-Regular.ttf"));
  const interBold    = fs.readFileSync(path.join(process.cwd(), "public/fonts/Inter-Bold.ttf"));
  doc.registerFont("Inter-Regular", interRegular);
  doc.registerFont("Inter-Bold", interBold);

  // Alias common standard names back to Inter (belt & suspenders).
  const _origFont = doc.font.bind(doc);
  doc.font = (name, size) => {
    const map = {
      "Helvetica": "Inter-Regular",
      "Helvetica-Oblique": "Inter-Regular",
      "Helvetica-Bold": "Inter-Bold",
      "Helvetica-BoldOblique": "Inter-Bold",
      "Times-Roman": "Inter-Regular",
      "Times-Bold": "Inter-Bold",
      "Courier": "Inter-Regular",
      "Courier-Bold": "Inter-Bold",
    };
    return _origFont(name ? (map[name] ?? name) : "Inter-Regular", size);
  };

  // Start with Inter explicitly and add the first page manually.
  doc.font("Inter-Regular");
  doc.addPage();
  return doc;
}

// Simple probe for /api/reports/auto?diag=1
export const __pdfPatchInfo = {
  usingPatchedDocument: true,
  source: "pdfkit/lib/document.js",
  overrides: ["initDefaultFont() noop"],
};
