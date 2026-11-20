/**
 * In-Browser Document, Tabular Data & Presentation Converter Fallback.
 * Powers offline/serverless conversions when the Python/LibreOffice backend
 * is unavailable (e.g., on standalone Vercel deployment or offline Desktop).
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { baseName, extOf } from "./fileTypes";
import { renderPdfToImages } from "./pdfClient";

interface TabularSheet {
  name: string;
  headers: string[];
  rows: string[][];
}

export interface ParsedSlideContent {
  title: string;
  lines: string[];
}

const DATA_INPUTS = new Set(["csv", "tsv", "json", "xml", "xlsx"]);
const DOC_INPUTS = new Set(["txt", "md", "html", "htm", "rtf", "docx", "odt"]);
const SLIDE_INPUTS = new Set(["pptx", "odp"]);
const LEGACY_OLE_INPUTS = new Set(["doc", "xls", "ppt"]);

export function canConvertClientSide(srcExt: string, targetExt: string): boolean {
  const s = srcExt.toLowerCase();
  const t = targetExt.toLowerCase();
  if (LEGACY_OLE_INPUTS.has(s) || LEGACY_OLE_INPUTS.has(t)) return false;
  if (DATA_INPUTS.has(s) && ["csv", "tsv", "json", "xml", "xlsx", "html", "md", "txt", "pdf"].includes(t)) {
    return true;
  }
  if (DOC_INPUTS.has(s) && ["txt", "md", "html", "docx", "pdf"].includes(t)) {
    return true;
  }
  if (SLIDE_INPUTS.has(s) && ["pdf", "txt", "html"].includes(t)) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Text, CSV/TSV, XML, XLSX & Office XML Parsers
// ---------------------------------------------------------------------------

function parseDelimitedText(text: string, delimiter: string): TabularSheet {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);

  if (rows.length === 0) throw new Error("The delimited file contains no data rows.");
  const width = Math.max(...rows.map((r) => r.length));
  const normalized = rows.map((r) => [...r, ...Array(Math.max(0, width - r.length)).fill("")]);
  return {
    name: "Sheet1",
    headers: normalized[0],
    rows: normalized.slice(1),
  };
}

function escapeDelimitedCell(val: string, delim: string): string {
  const s = String(val ?? "");
  if (s.includes(delim) || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function escapeXmlText(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeHtmlText(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function flattenObject(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flattenObject(v as Record<string, unknown>, key));
    } else if (Array.isArray(v)) {
      out[key] = JSON.stringify(v);
    } else {
      out[key] = v == null ? "" : String(v);
    }
  }
  return out;
}

function recordsToSheet(records: Record<string, unknown>[], name = "Sheet1"): TabularSheet {
  const flat = records.map((r) => flattenObject(r));
  const headers: string[] = [];
  const seen = new Set<string>();
  for (const row of flat) {
    for (const k of Object.keys(row)) {
      if (!seen.has(k)) {
        seen.add(k);
        headers.push(k);
      }
    }
  }
  return {
    name,
    headers,
    rows: flat.map((r) => headers.map((h) => r[h] ?? "")),
  };
}

function parseJsonToSheets(text: string): TabularSheet[] {
  const data = JSON.parse(text.replace(/^\uFEFF/, ""));
  if (Array.isArray(data)) {
    if (data.length === 0) return [{ name: "Sheet1", headers: ["value"], rows: [] }];
    if (typeof data[0] === "object" && data[0] !== null && !Array.isArray(data[0])) {
      return [recordsToSheet(data as Record<string, unknown>[])];
    }
    if (Array.isArray(data[0])) {
      const rows = (data as unknown[][]).map((r) => r.map((c) => (c == null ? "" : String(c))));
      return [{ name: "Sheet1", headers: rows[0] || [], rows: rows.slice(1) }];
    }
    return [{ name: "Sheet1", headers: ["value"], rows: data.map((v) => [String(v ?? "")]) }];
  }
  if (data && typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length > 0 && entries.every(([, v]) => Array.isArray(v))) {
      return entries.slice(0, 20).map(([k, v]) => {
        const arr = v as unknown[];
        if (arr.length > 0 && typeof arr[0] === "object" && arr[0] !== null) {
          return recordsToSheet(arr as Record<string, unknown>[], k.slice(0, 31));
        }
        return { name: k.slice(0, 31), headers: ["value"], rows: arr.map((x) => [String(x ?? "")]) };
      });
    }
    return [recordsToSheet([data as Record<string, unknown>])];
  }
  return [{ name: "Sheet1", headers: ["value"], rows: [[String(data ?? "")]] }];
}

function parseXmlText(text: string): { sheets: TabularSheet[]; rawJson: unknown } {
  const parser = typeof DOMParser !== "undefined" ? new DOMParser() : null;
  if (!parser) {
    throw new Error("XML DOM parser is unavailable in this environment.");
  }
  const doc = parser.parseFromString(text, "application/xml");
  const parseErr = doc.querySelector("parsererror");
  if (parseErr) {
    throw new Error("Invalid XML document: " + (parseErr.textContent || "parse error"));
  }
  const elemToObj = (el: Element): unknown => {
    const children = Array.from(el.children);
    const out: Record<string, unknown> = {};
    for (const attr of Array.from(el.attributes)) {
      out[`@${attr.name}`] = attr.value;
    }
    if (children.length === 0) {
      const txt = (el.textContent || "").trim();
      if (Object.keys(out).length === 0) return txt;
      if (txt) out["#text"] = txt;
      return out;
    }
    for (const ch of children) {
      const val = elemToObj(ch);
      if (ch.tagName in out) {
        const existing = out[ch.tagName];
        if (Array.isArray(existing)) existing.push(val);
        else out[ch.tagName] = [existing, val];
      } else {
        out[ch.tagName] = val;
      }
    }
    return out;
  };

  const root = doc.documentElement;
  const obj = { [root.tagName]: elemToObj(root) };
  const childElems = Array.from(root.children);
  if (childElems.length > 0 && childElems.every((c) => typeof elemToObj(c) === "object")) {
    const records = childElems.map((c) => elemToObj(c) as Record<string, unknown>);
    return { sheets: [recordsToSheet(records, root.tagName.slice(0, 31))], rawJson: obj };
  }
  return { sheets: [recordsToSheet([flattenObject(obj as Record<string, unknown>)])], rawJson: obj };
}

async function parseXlsxToSheets(blob: Blob): Promise<TabularSheet[]> {
  const ExcelModule = await import("exceljs");
  const ExcelJS = (ExcelModule as any).default || ExcelModule;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await blob.arrayBuffer());
  const sheets: TabularSheet[] = [];
  wb.eachSheet((ws: any) => {
    const allRows: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row: any) => {
      const vals = (row.values as unknown[]).slice(1).map((cell) => {
        if (cell == null) return "";
        if (typeof cell === "object" && "result" in (cell as any)) return String((cell as any).result ?? "");
        if (typeof cell === "object" && "text" in (cell as any)) return String((cell as any).text ?? "");
        return String(cell);
      });
      if (vals.some((v) => v.trim() !== "")) allRows.push(vals);
    });
    if (allRows.length > 0) {
      const width = Math.max(...allRows.map((r) => r.length));
      const pad = allRows.map((r) => [...r, ...Array(Math.max(0, width - r.length)).fill("")]);
      sheets.push({ name: ws.name || "Sheet1", headers: pad[0], rows: pad.slice(1) });
    }
  });
  if (sheets.length === 0) {
    sheets.push({ name: "Sheet1", headers: ["Empty"], rows: [] });
  }
  return sheets;
}

function stripRtfToText(rtf: string): string {
  return rtf
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\tab/g, "\t")
    .replace(/\\line/g, "\n")
    .replace(/\{\\\*[^}]*\}/g, "")
    .replace(/\\'[0-9a-fA-F]{2}/g, " ")
    .replace(/\\[a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function htmlToPlainAndMd(html: string): { plain: string; markdown: string } {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  const md = cleaned
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n\n")
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n\n")
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n\n")
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|article|section)>/gi, "\n")
    .replace(/<td[^>]*>([\s\S]*?)<\/td>/gi, "$1 | ")
    .replace(/<th[^>]*>([\s\S]*?)<\/th>/gi, "**$1** | ")
    .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
    .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
    .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*")
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const decodedMd = decodeXmlEntities(md);
  const plain = decodedMd.replace(/^#{1,6}\s+/gm, "").replace(/[*`]/g, "");
  return { plain, markdown: decodedMd };
}

function markdownToSimpleHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const htmlLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("### ")) return `<h3>${escapeHtmlText(trimmed.slice(4))}</h3>`;
    if (trimmed.startsWith("## ")) return `<h2>${escapeHtmlText(trimmed.slice(3))}</h2>`;
    if (trimmed.startsWith("# ")) return `<h1>${escapeHtmlText(trimmed.slice(2))}</h1>`;
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      return `<li>${escapeHtmlText(trimmed.slice(2))}</li>`;
    }
    return `<p>${escapeHtmlText(line)}</p>`;
  });
  return htmlLines.filter(Boolean).join("\n");
}

async function extractTextFromDocx(blob: Blob): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const docXml = await zip.file("word/document.xml")?.async("text");
  if (!docXml) throw new Error("Invalid DOCX archive: missing word/document.xml.");
  const paragraphs: string[] = [];
  const pMatches = docXml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];
  for (const p of pMatches) {
    const texts: string[] = [];
    const tMatches = p.match(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g) || [];
    for (const t of tMatches) {
      const inner = t.replace(/^<w:t\b[^>]*>/, "").replace(/<\/w:t>$/, "");
      texts.push(decodeXmlEntities(inner));
    }
    const line = texts.join("").trim();
    if (line) paragraphs.push(line);
  }
  return paragraphs.join("\n\n");
}

async function extractTextFromOdf(blob: Blob): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file("content.xml")?.async("text");
  if (!xml) throw new Error("Invalid OpenDocument archive: missing content.xml.");
  const blocks: string[] = [];
  const matches = xml.match(/<(?:text:p|text:h)\b[^>]*>([\s\S]*?)<\/(?:text:p|text:h)>/g) || [];
  for (const m of matches) {
    const inner = decodeXmlEntities(m.replace(/<[^>]+>/g, "")).trim();
    if (inner) blocks.push(inner);
  }
  return blocks.join("\n\n");
}

export async function extractSlidesClient(blob: Blob, ext: string): Promise<ParsedSlideContent[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());

  if (ext === "odp") {
    const xml = await zip.file("content.xml")?.async("text");
    if (!xml) throw new Error("Invalid ODP archive.");
    const pages = xml.match(/<draw:page\b[\s\S]*?<\/draw:page>/g) || [];
    if (pages.length === 0) return [{ title: baseName((blob as File).name || "Presentation"), lines: [] }];
    return pages.map((pageXml, idx) => {
      const texts = (pageXml.match(/<text:p\b[^>]*>[\s\S]*?<\/text:p>/g) || [])
        .map((m) => decodeXmlEntities(m.replace(/<[^>]+>/g, "")).trim())
        .filter(Boolean);
      return {
        title: texts[0] || `Slide ${idx + 1}`,
        lines: texts.slice(1),
      };
    });
  }

  const slideNames = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/i.test(n))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)\.xml/i)?.[1] || "0", 10);
      const nb = parseInt(b.match(/slide(\d+)\.xml/i)?.[1] || "0", 10);
      return na - nb;
    });

  if (slideNames.length === 0) {
    throw new Error("No slides found inside PPTX package.");
  }

  const slides: ParsedSlideContent[] = [];
  for (let i = 0; i < slideNames.length; i++) {
    const xml = await zip.file(slideNames[i])!.async("text");
    const paras = xml.match(/<a:p\b[\s\S]*?<\/a:p>/g) || [];
    const lines: string[] = [];
    for (const p of paras) {
      const parts = (p.match(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g) || []).map((t) =>
        decodeXmlEntities(t.replace(/^<a:t\b[^>]*>/, "").replace(/<\/a:t>$/, ""))
      );
      const joined = parts.join("").trim();
      if (joined) lines.push(joined);
    }
    slides.push({
      title: lines[0] || `Slide ${i + 1}`,
      lines: lines.slice(1),
    });
  }
  return slides;
}

// ---------------------------------------------------------------------------
// Document / PDF / DOCX / Spreadsheet Writers
// ---------------------------------------------------------------------------

function wrapTextForPdf(line: string, maxChars: number): string[] {
  const safe = line.replace(/[^\x20-\x7E\xA0-\xFF]/g, " ");
  if (safe.length <= maxChars) return [safe];
  const words = safe.split(/\s+/);
  const out: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= maxChars) cur += ` ${w}`;
    else {
      out.push(cur);
      cur = w;
    }
  }
  if (cur) out.push(cur);
  return out;
}

async function renderTextToPdfBlob(title: string, text: string): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pageW = 595.28;
  const pageH = 841.89;
  const margin = 48;
  const fontSize = 10.5;
  const lineHeight = 15;

  let page = pdfDoc.addPage([pageW, pageH]);
  let y = pageH - margin;
  page.drawText(title.replace(/[^\x20-\x7E\xA0-\xFF]/g, " "), {
    x: margin,
    y,
    size: 14,
    font: boldFont,
    color: rgb(0.08, 0.12, 0.22),
  });
  y -= 26;

  const rawLines = text.replace(/\r\n/g, "\n").split("\n");
  for (const raw of rawLines) {
    const wrapped = raw.trim() ? wrapTextForPdf(raw, 84) : [""];
    for (const ln of wrapped) {
      if (y < margin + lineHeight) {
        page = pdfDoc.addPage([pageW, pageH]);
        y = pageH - margin;
      }
      if (ln) {
        page.drawText(ln, {
          x: margin,
          y,
          size: fontSize,
          font,
          color: rgb(0.12, 0.16, 0.24),
        });
      }
      y -= lineHeight;
    }
  }

  const bytes = await pdfDoc.save({ useObjectStreams: true });
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

export async function renderSlidesToPdfClient(
  slides: ParsedSlideContent[],
  orientation: "preserve" | "16:9" | "4:3" = "16:9"
): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const w = orientation === "4:3" ? 720 : 960;
  const h = orientation === "4:3" ? 540 : 540;

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const page = pdfDoc.addPage([w, h]);
    page.drawRectangle({ x: 0, y: 0, width: w, height: h, color: rgb(0.97, 0.98, 1) });
    page.drawRectangle({ x: 0, y: h - 78, width: w, height: 78, color: rgb(0.09, 0.15, 0.28) });
    page.drawText(slide.title.replace(/[^\x20-\x7E\xA0-\xFF]/g, " ").slice(0, 72), {
      x: 44,
      y: h - 48,
      size: 22,
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    let y = h - 118;
    for (const rawLine of slide.lines) {
      const wrapped = wrapTextForPdf(rawLine, orientation === "4:3" ? 76 : 98);
      for (const ln of wrapped) {
        if (y < 48) break;
        page.drawText(ln, { x: 48, y, size: 13, font, color: rgb(0.15, 0.2, 0.3) });
        y -= 21;
      }
    }

    page.drawText(`Slide ${i + 1} of ${slides.length}`, {
      x: w - 120,
      y: 22,
      size: 9,
      font,
      color: rgb(0.45, 0.5, 0.6),
    });
  }

  const bytes = await pdfDoc.save({ useObjectStreams: true });
  return new Blob([bytes as BlobPart], { type: "application/pdf" });
}

async function sheetsToXlsxBlob(sheets: TabularSheet[]): Promise<Blob> {
  const ExcelModule = await import("exceljs");
  const ExcelJS = (ExcelModule as any).default || ExcelModule;
  const wb = new ExcelJS.Workbook();
  wb.creator = "TwoolKit";
  for (const s of sheets) {
    const ws = wb.addWorksheet((s.name || "Sheet1").slice(0, 31));
    if (s.headers.length > 0) {
      ws.addRow(s.headers);
      ws.getRow(1).font = { bold: true };
    }
    for (const r of s.rows) {
      ws.addRow(r);
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

// ---------------------------------------------------------------------------
// Public Document & Data Conversion Entrypoint
// ---------------------------------------------------------------------------

export async function convertDocumentClient(
  file: File,
  targetFormat: string,
  onProgress?: (p: number, stage: string) => void
): Promise<{ name: string; blob: Blob }> {
  const srcExt = extOf(file.name);
  const tgt = targetFormat.toLowerCase();
  const stem = baseName(file.name);

  if (LEGACY_OLE_INPUTS.has(srcExt) || LEGACY_OLE_INPUTS.has(tgt)) {
    throw new Error(
      `Legacy binary .${LEGACY_OLE_INPUTS.has(srcExt) ? srcExt : tgt} conversion requires the Local Server Engine.`
    );
  }

  onProgress?.(0.2, `Reading ${srcExt.toUpperCase()} source`);

  // 1. Tabular Data & Spreadsheets
  if (DATA_INPUTS.has(srcExt)) {
    let sheets: TabularSheet[] = [];
    let rawXmlJson: unknown = null;

    if (srcExt === "csv") sheets = [parseDelimitedText(await file.text(), ",")];
    else if (srcExt === "tsv") sheets = [parseDelimitedText(await file.text(), "\t")];
    else if (srcExt === "json") sheets = parseJsonToSheets(await file.text());
    else if (srcExt === "xml") {
      const parsed = parseXmlText(await file.text());
      sheets = parsed.sheets;
      rawXmlJson = parsed.rawJson;
    } else if (srcExt === "xlsx") {
      sheets = await parseXlsxToSheets(file);
    }

    onProgress?.(0.6, `Encoding to ${tgt.toUpperCase()}`);
    const s = sheets[0];

    if (tgt === "csv" || tgt === "tsv") {
      const delim = tgt === "tsv" ? "\t" : ",";
      const lines = [s.headers, ...s.rows].map((r) => r.map((c) => escapeDelimitedCell(c, delim)).join(delim));
      return {
        name: `${stem}.${tgt}`,
        blob: new Blob([lines.join("\n")], { type: tgt === "tsv" ? "text/tab-separated-values;charset=utf-8" : "text/csv;charset=utf-8" }),
      };
    }

    if (tgt === "json") {
      const payload =
        rawXmlJson ??
        (sheets.length === 1
          ? s.rows.map((r) => Object.fromEntries(s.headers.map((h, idx) => [h || `col_${idx + 1}`, r[idx] ?? ""])))
          : Object.fromEntries(
              sheets.map((sh) => [
                sh.name,
                sh.rows.map((r) => Object.fromEntries(sh.headers.map((h, idx) => [h || `col_${idx + 1}`, r[idx] ?? ""]))),
              ])
            ));
      return {
        name: `${stem}.json`,
        blob: new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }),
      };
    }

    if (tgt === "xml") {
      const rowXml = s.rows
        .map((r) => {
          const cols = s.headers
            .map((h, i) => {
              const tag = (h || `col_${i + 1}`).replace(/[^a-zA-Z0-9_-]/g, "_").replace(/^[^a-zA-Z_]/, "_");
              return `<${tag}>${escapeXmlText(r[i] ?? "")}</${tag}>`;
            })
            .join("");
          return `  <row>${cols}</row>`;
        })
        .join("\n");
      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rows>\n${rowXml}\n</rows>`;
      return { name: `${stem}.xml`, blob: new Blob([xml], { type: "application/xml;charset=utf-8" }) };
    }

    if (tgt === "xlsx") {
      return { name: `${stem}.xlsx`, blob: await sheetsToXlsxBlob(sheets) };
    }

    if (tgt === "md") {
      const hdr = `| ${s.headers.map((h) => h.replace(/\|/g, "\\|")).join(" | ")} |`;
      const sep = `| ${s.headers.map(() => "---").join(" | ")} |`;
      const body = s.rows
        .map((r) => `| ${s.headers.map((_, i) => String(r[i] ?? "").replace(/\|/g, "\\|")).join(" | ")} |`)
        .join("\n");
      return { name: `${stem}.md`, blob: new Blob([[hdr, sep, body].join("\n")], { type: "text/markdown;charset=utf-8" }) };
    }

    if (tgt === "html") {
      const ths = s.headers.map((h) => `<th>${escapeHtmlText(h)}</th>`).join("");
      const trs = s.rows
        .map((r) => `<tr>${s.headers.map((_, i) => `<td>${escapeHtmlText(r[i] ?? "")}</td>`).join("")}</tr>`)
        .join("\n");
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtmlText(stem)}</title><style>body{font-family:system-ui,sans-serif;padding:2rem;color:#0f172a}table{border-collapse:collapse;width:100%}th,td{border:1px solid #cbd5e1;padding:.5rem .75rem;text-align:left;font-size:.875rem}th{background:#f1f5f9}</style></head><body><h1>${escapeHtmlText(stem)}</h1><table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></body></html>`;
      return { name: `${stem}.html`, blob: new Blob([html], { type: "text/html;charset=utf-8" }) };
    }

    if (tgt === "txt") {
      const lines = [s.headers.join("\t"), ...s.rows.map((r) => r.join("\t"))];
      return { name: `${stem}.txt`, blob: new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }) };
    }

    if (tgt === "pdf") {
      const lines = [s.headers.join(" | "), "-".repeat(48), ...s.rows.map((r) => r.join(" | "))];
      return { name: `${stem}.pdf`, blob: await renderTextToPdfBlob(stem, lines.join("\n")) };
    }
  }

  // 2. Presentations converted through Document Converter
  if (SLIDE_INPUTS.has(srcExt)) {
    const slides = await extractSlidesClient(file, srcExt);
    if (tgt === "pdf") {
      return { name: `${stem}.pdf`, blob: await renderSlidesToPdfClient(slides, "16:9") };
    }
    if (tgt === "txt") {
      const text = slides.map((s, i) => `--- Slide ${i + 1}: ${s.title} ---\n${s.lines.join("\n")}`).join("\n\n");
      return { name: `${stem}.txt`, blob: new Blob([text], { type: "text/plain;charset=utf-8" }) };
    }
    if (tgt === "html") {
      const body = slides
        .map(
          (s, i) =>
            `<section style="border:1px solid #cbd5e1;border-radius:12px;padding:1.5rem;margin-bottom:1.5rem"><h2>${i + 1}. ${escapeHtmlText(s.title)}</h2>${s.lines.map((l) => `<p>${escapeHtmlText(l)}</p>`).join("")}</section>`
        )
        .join("\n");
      return {
        name: `${stem}.html`,
        blob: new Blob([`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtmlText(stem)}</title></head><body style="font-family:system-ui,sans-serif;max-width:900px;margin:2rem auto">${body}</body></html>`], {
          type: "text/html;charset=utf-8",
        }),
      };
    }
  }

  // 3. Text, Markdown, HTML, RTF, DOCX, ODT
  if (DOC_INPUTS.has(srcExt)) {
    let plainText = "";
    let mdText = "";
    let htmlFragment = "";

    if (srcExt === "txt") {
      plainText = await file.text();
      mdText = plainText;
      htmlFragment = plainText
        .split(/\r?\n/)
        .map((l) => (l.trim() ? `<p>${escapeHtmlText(l)}</p>` : "<br/>"))
        .join("\n");
    } else if (srcExt === "md") {
      mdText = await file.text();
      plainText = mdText.replace(/^#{1,6}\s+/gm, "");
      htmlFragment = markdownToSimpleHtml(mdText);
    } else if (srcExt === "html" || srcExt === "htm") {
      const rawHtml = await file.text();
      const bodyMatch = rawHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      htmlFragment = bodyMatch ? bodyMatch[1] : rawHtml;
      const conv = htmlToPlainAndMd(htmlFragment);
      plainText = conv.plain;
      mdText = conv.markdown;
    } else if (srcExt === "rtf") {
      plainText = stripRtfToText(await file.text());
      mdText = plainText;
      htmlFragment = plainText
        .split(/\n{2,}/)
        .map((p) => `<p>${escapeHtmlText(p)}</p>`)
        .join("\n");
    } else if (srcExt === "docx") {
      plainText = await extractTextFromDocx(file);
      mdText = plainText;
      htmlFragment = plainText
        .split(/\n{2,}/)
        .map((p) => `<p>${escapeHtmlText(p)}</p>`)
        .join("\n");
    } else if (srcExt === "odt") {
      plainText = await extractTextFromOdf(file);
      mdText = plainText;
      htmlFragment = plainText
        .split(/\n{2,}/)
        .map((p) => `<p>${escapeHtmlText(p)}</p>`)
        .join("\n");
    }

    onProgress?.(0.65, `Compiling ${tgt.toUpperCase()}`);

    if (tgt === "txt") {
      return { name: `${stem}.txt`, blob: new Blob([plainText], { type: "text/plain;charset=utf-8" }) };
    }
    if (tgt === "md") {
      return { name: `${stem}.md`, blob: new Blob([mdText], { type: "text/markdown;charset=utf-8" }) };
    }
    if (tgt === "html") {
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtmlText(stem)}</title><style>body{font-family:system-ui,-apple-system,sans-serif;max-width:820px;margin:2rem auto;padding:0 1rem;line-height:1.6;color:#0f172a}</style></head><body>${htmlFragment}</body></html>`;
      return { name: `${stem}.html`, blob: new Blob([fullHtml], { type: "text/html;charset=utf-8" }) };
    }
    if (tgt === "docx") {
      const { Document, Paragraph, TextRun, Packer } = await import("docx");
      const paragraphs = plainText.split(/\r?\n/).map(
        (line) => new Paragraph({ children: [new TextRun({ text: line, size: 22 })], spacing: { after: 100 } })
      );
      const doc = new Document({
        sections: [{ children: paragraphs.length > 0 ? paragraphs : [new Paragraph("")] }],
      });
      return { name: `${stem}.docx`, blob: await Packer.toBlob(doc) };
    }
    if (tgt === "pdf") {
      return { name: `${stem}.pdf`, blob: await renderTextToPdfBlob(stem, plainText) };
    }
  }

  throw new Error(
    `Direct client conversion from .${srcExt} to .${tgt} requires the Local Server Engine.`
  );
}

// ---------------------------------------------------------------------------
// Presentation Studio Client Fallbacks (Images / Video for PDF & PPTX/ODP)
// ---------------------------------------------------------------------------

function renderSlideToCanvas(
  slide: ParsedSlideContent,
  slideIdx: number,
  total: number,
  width = 1600,
  height = 900
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, width, Math.round(height * 0.16));

  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${Math.round(height * 0.052)}px system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.fillText(slide.title.slice(0, 72), Math.round(width * 0.05), Math.round(height * 0.08));

  ctx.fillStyle = "#1e293b";
  const bodyFontPx = Math.round(height * 0.032);
  ctx.font = `${bodyFontPx}px system-ui, -apple-system, sans-serif`;
  ctx.textBaseline = "top";
  let y = Math.round(height * 0.22);
  const maxW = Math.round(width * 0.9);
  const left = Math.round(width * 0.05);

  for (const rawLine of slide.lines) {
    const words = rawLine.split(/\s+/);
    let cur = "";
    for (const w of words) {
      const candidate = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(candidate).width <= maxW) {
        cur = candidate;
      } else {
        if (y < height - 70) ctx.fillText(cur, left, y);
        y += Math.round(bodyFontPx * 1.45);
        cur = w;
      }
    }
    if (cur && y < height - 70) {
      ctx.fillText(cur, left, y);
      y += Math.round(bodyFontPx * 1.6);
    }
  }

  ctx.fillStyle = "#64748b";
  ctx.font = `${Math.round(height * 0.02)}px monospace`;
  ctx.fillText(`Slide ${slideIdx + 1} / ${total}`, width - 190, height - 42);
  return canvas;
}

export async function presentationToImagesClient(
  file: File,
  format: "png" | "jpeg" | "webp",
  dpi: number,
  onProgress?: (p: number, stage: string) => void
): Promise<{ name: string; blob: Blob }[]> {
  const ext = extOf(file.name);
  if (ext === "pdf") {
    return await renderPdfToImages(file, format, Math.max(1, dpi / 72), undefined, onProgress);
  }
  if (ext === "pptx" || ext === "odp") {
    const slides = await extractSlidesClient(file, ext);
    const scale = Math.max(1, dpi / 144);
    const w = Math.round(1280 * scale);
    const h = Math.round(720 * scale);
    const mime = format === "jpeg" ? "image/jpeg" : format === "webp" ? "image/webp" : "image/png";
    const results: { name: string; blob: Blob }[] = [];

    for (let i = 0; i < slides.length; i++) {
      onProgress?.(i / slides.length, `Rendering slide ${i + 1} of ${slides.length}`);
      const canvas = renderSlideToCanvas(slides[i], i, slides.length, w, h);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas slide render failed"))), mime, 0.92);
      });
      const outExt = format === "webp" && blob.type === "image/png" ? "png" : format === "jpeg" ? "jpg" : format;
      results.push({ name: `slide-${i + 1}.${outExt}`, blob });
    }
    return results;
  }
  throw new Error("Legacy .ppt image rendering requires the Local Server Engine.");
}

export async function presentationToVideoClient(
  file: File,
  secondsPerSlide: number,
  videoWidth: number,
  onProgress?: (p: number, stage: string) => void
): Promise<{ name: string; blob: Blob }> {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("MediaRecorder is not supported in this browser for video encoding.");
  }
  const stem = baseName(file.name);
  const w = Math.max(640, Math.min(1920, videoWidth));
  const h = Math.round((w * 9) / 16);

  const imgFiles = await presentationToImagesClient(file, "png", 150, (p, s) =>
    onProgress?.(p * 0.4, s)
  );
  if (imgFiles.length === 0) throw new Error("No slides available for video.");

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const stream = canvas.captureStream(15);
  const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) =>
    MediaRecorder.isTypeSupported(m)
  );
  const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const donePromise = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });

  recorder.start(200);
  const msPerSlide = Math.max(500, Math.min(10000, secondsPerSlide * 1000));

  for (let i = 0; i < imgFiles.length; i++) {
    onProgress?.(0.4 + 0.55 * (i / imgFiles.length), `Recording slide ${i + 1} of ${imgFiles.length}`);
    const bmp = await createImageBitmap(imgFiles[i].blob);
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);
    const scale = Math.min(w / bmp.width, h / bmp.height);
    const dw = bmp.width * scale;
    const dh = bmp.height * scale;
    ctx.drawImage(bmp, (w - dw) / 2, (h - dh) / 2, dw, dh);
    bmp.close();
    await new Promise((r) => setTimeout(r, msPerSlide));
  }

  recorder.stop();
  const blob = await donePromise;
  return { name: `${stem}-slides.webm`, blob };
}
