import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    engines: {
      client: { available: true, version: "2.0.0", detail: "In-Browser WebAssembly and Web Worker Engine" },
      pdfLib: { available: true, version: "1.17.1", detail: "Client-side PDF manipulation" },
      pdfJs: { available: true, version: "4.10.38", detail: "Client-side PDF renderer" },
      tesseract: { available: true, version: "7.0.0", detail: "Client-side OCR engine" },
    },
    ops: {
      "pdf.merge": { available: true, reason: null },
      "pdf.split": { available: true, reason: null },
      "pdf.organize": { available: true, reason: null },
      "pdf.rotate": { available: true, reason: null },
      "pdf.delete": { available: true, reason: null },
      "pdf.extract": { available: true, reason: null },
      "pdf.crop": { available: true, reason: null },
      "pdf.page_numbers": { available: true, reason: null },
      "pdf.watermark": { available: true, reason: null },
      "pdf.header_footer": { available: true, reason: null },
      "pdf.to_image": { available: true, reason: null },
      "pdf.to_txt": { available: true, reason: null },
      "pdf.to_html": { available: true, reason: null },
      "pdf.to_docx": { available: true, reason: null },
      "pdf.to_xlsx": { available: true, reason: null },
      "pdf.to_pptx": { available: true, reason: null },
      "pdf.compress": { available: true, reason: null },
      "pdf.repair": { available: true, reason: null },
      "pdf.ocr": { available: true, reason: null },
    },
    limits: {
      maxFileMB: 200,
      maxFilesPerJob: 50,
      retentionMinutes: 60,
    },
    queue: { pending: 0, workers: 4 },
  });
}
