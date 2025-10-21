// lib/report_pdf.js
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import fs from 'node:fs/promises';
import path from 'node:path';

let _interBytes = null;
async function loadInterBytes() {
  if (_interBytes !== null) return _interBytes; // cache
  const tryPaths = [
    path.join(process.cwd(), 'public', 'fonts', 'Inter-Regular.ttf'),
    path.join(process.cwd(), 'app', 'fonts', 'Inter-Regular.ttf'),
  ];
  for (const p of tryPaths) {
    try {
      const bytes = await fs.readFile(p);
      _interBytes = bytes;
      return bytes;
    } catch {}
  }
  _interBytes = null;
  return null;
}

export async function buildMinimalPdf(payload) {
  // payload: { title, mission, checklist, photoUrls, ... }
  const doc = await PDFDocument.create();
  // IMPORTANT: register fontkit before embedding any custom font
  doc.registerFontkit(fontkit);

  // Try to embed Inter; fall back to TimesRoman (Standard14) if missing
  const interBytes = await loadInterBytes();
  let font;
  if (interBytes) {
    font = await doc.embedFont(interBytes, { subset: true });
  } else {
    // Standard14: no custom font embedding required
    font = await doc.embedFont(StandardFonts.TimesRoman);
  }

  const page = doc.addPage([595.28, 841.89]); // A4 portrait (72 dpi)
  const { width, height } = page.getSize();

  const title = payload?.title || 'Mission Report';
  page.drawText(title, {
    x: 40,
    y: height - 60,
    font,
    size: 20,
    color: rgb(0, 0, 0),
  });

  const missionTitle = payload?.mission?.title || '';
  const store = payload?.mission?.store || '';
  const address = payload?.mission?.address || payload?.mission?.location?.address || '';

  let y = height - 90;
  const lines = [
    missionTitle ? `Mission: ${missionTitle}` : null,
    store ? `Store: ${store}` : null,
    address ? `Address: ${address}` : null,
  ].filter(Boolean);

  for (const line of lines) {
    page.drawText(line, { x: 40, y, font, size: 12, color: rgb(0, 0, 0) });
    y -= 18;
  }

  const items = Array.isArray(payload?.checklist) ? payload.checklist : [];
  const first = items[0];
  if (first) {
    y -= 10;
    page.drawText('Checklist (first item):', { x: 40, y, font, size: 12, color: rgb(0, 0, 0) });
    y -= 16;
    page.drawText(`• ${first.title || 'Untitled'}  |  Rating: ${first.rating ?? '—'}`, {
      x: 40,
      y,
      font,
      size: 12,
      color: rgb(0, 0, 0),
    });
    y -= 18;
  }

  // We keep images out for now (minimal MVP). If needed, they can be embedded later.

  const bytes = await doc.save();
  return bytes;
}
