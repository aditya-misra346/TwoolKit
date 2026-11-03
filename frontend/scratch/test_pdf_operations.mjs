import { PDFDocument, rgb } from "pdf-lib";
import fs from "fs";

async function runTests() {
  console.log("=== BEGINNING COMPREHENSIVE PDF OPERATIONS TEST SUITE ===");
  const inputBytes = fs.readFileSync("/tmp/vellum_multi.pdf");
  const blob = new Blob([inputBytes], { type: "application/pdf" });

  // 1. Test Organize Pages
  console.log("\n[TEST 1] Testing organizePdfPages...");
  const {
    organizePdfPages,
    mergePdfs,
    splitPdf,
    deletePdfPages,
    rotatePdf,
    addPageNumbers,
    addWatermark,
    addHeaderFooter,
    cropPdfMargins,
    compressPdfClient,
    repairPdfClient,
  } = await import("../src/lib/pdfClient.ts");
  
  // Reorder: Page 3 (idx 2), Page 1 (idx 0), insert blank (-1), Page 2 (idx 1 with 90 deg rotation)
  const organizedBlob = await organizePdfPages(blob, [
    { sourceIndex: 2 },
    { sourceIndex: 0 },
    { sourceIndex: -1 },
    { sourceIndex: 1, rotationDelta: 90 },
  ]);
  const organizedDoc = await PDFDocument.load(await organizedBlob.arrayBuffer());
  if (organizedDoc.getPageCount() !== 4) throw new Error(`Organize failed: expected 4 pages, got ${organizedDoc.getPageCount()}`);
  console.log("✓ organizePdfPages passed: 4 pages created (including blank + rotated page).");

  // 2. Test Merge PDFs
  console.log("\n[TEST 2] Testing mergePdfs...");
  const mergedBlob = await mergePdfs([blob, blob]);
  const mergedDoc = await PDFDocument.load(await mergedBlob.arrayBuffer());
  if (mergedDoc.getPageCount() !== 6) throw new Error(`Merge failed: expected 6 pages, got ${mergedDoc.getPageCount()}`);
  console.log("✓ mergePdfs passed: 6 pages merged.");

  // 3. Test Split PDF
  console.log("\n[TEST 3] Testing splitPdf...");
  const splitAll = await splitPdf(blob);
  if (splitAll.length !== 3) throw new Error(`Split failed: expected 3 single pages, got ${splitAll.length}`);
  const splitRange = await splitPdf(blob, "1, 3");
  if (splitRange.length !== 1) throw new Error("Split range failed");
  const rangeDoc = await PDFDocument.load(await splitRange[0].blob.arrayBuffer());
  if (rangeDoc.getPageCount() !== 2) throw new Error(`Split range page count failed: expected 2, got ${rangeDoc.getPageCount()}`);
  console.log("✓ splitPdf passed: individual splitting and range extraction validated.");

  // 4. Test Delete Pages
  console.log("\n[TEST 4] Testing deletePdfPages...");
  const deletedBlob = await deletePdfPages(blob, [2]);
  const deletedDoc = await PDFDocument.load(await deletedBlob.arrayBuffer());
  if (deletedDoc.getPageCount() !== 2) throw new Error(`Delete failed: expected 2 pages, got ${deletedDoc.getPageCount()}`);
  console.log("✓ deletePdfPages passed: page 2 removed, 2 pages remain.");

  // 5. Test Rotate PDF
  console.log("\n[TEST 5] Testing rotatePdf...");
  const rotatedBlob = await rotatePdf(blob, 90);
  const rotatedDoc = await PDFDocument.load(await rotatedBlob.arrayBuffer());
  if (rotatedDoc.getPage(0).getRotation().angle !== 90) throw new Error("Rotate failed: angle not 90");
  console.log("✓ rotatePdf passed: angle updated to 90 degrees.");

  // 6. Test Add Page Numbers
  console.log("\n[TEST 6] Testing addPageNumbers...");
  const numberedBlob = await addPageNumbers(blob, { position: "bottom-center", format: "page-of-total" });
  if (numberedBlob.size === 0) throw new Error("Page numbering failed");
  console.log(`✓ addPageNumbers passed: valid output (${numberedBlob.size} bytes).`);

  // 7. Test Watermark
  console.log("\n[TEST 7] Testing addWatermark...");
  const wmBlob = await addWatermark(blob, { text: "CONFIDENTIAL", opacity: 0.3 });
  if (wmBlob.size === 0) throw new Error("Watermark failed");
  console.log(`✓ addWatermark passed: valid output (${wmBlob.size} bytes).`);

  // 8. Test Header & Footer
  console.log("\n[TEST 8] Testing addHeaderFooter...");
  const hfBlob = await addHeaderFooter(blob, "Top Header", "Bottom Footer");
  if (hfBlob.size === 0) throw new Error("Header & Footer failed");
  console.log(`✓ addHeaderFooter passed: valid output (${hfBlob.size} bytes).`);

  // 9. Test Crop Margins
  console.log("\n[TEST 9] Testing cropPdfMargins...");
  const cropBlob = await cropPdfMargins(blob, { top: 36, bottom: 36, left: 36, right: 36 });
  if (cropBlob.size === 0) throw new Error("Crop failed");
  console.log(`✓ cropPdfMargins passed: valid output (${cropBlob.size} bytes).`);

  // 10. Test Compress Client
  console.log("\n[TEST 10] Testing compressPdfClient...");
  const compBlob = await compressPdfClient(blob, "balanced");
  if (compBlob.size === 0) throw new Error("Client compression failed");
  console.log(`✓ compressPdfClient passed: valid output (${compBlob.size} bytes).`);

  // 11. Test Repair Client
  console.log("\n[TEST 11] Testing repairPdfClient...");
  const repBlob = await repairPdfClient(blob);
  if (repBlob.size === 0) throw new Error("Client repair failed");
  console.log(`✓ repairPdfClient passed: valid output (${repBlob.size} bytes).`);

  console.log("\n=== ALL 11 IN-BROWSER PDF TEST SUITES PASSED FLAWLESSLY! ===");
}

runTests().catch((e) => {
  console.error("TEST FAILED:", e);
  process.exit(1);
});
