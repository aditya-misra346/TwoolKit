"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TOOLS } from "@/lib/tools";
import { DropZone, type StagedFile } from "@/components/DropZone";
import { useQueue } from "@/stores/tasks";
import { runServerJob } from "@/lib/api";
import { PageOrganizer } from "@/components/pdf/PageOrganizer";
import { ConsentModal } from "@/components/ConsentModal";
import { useSettings } from "@/stores/settings";
import {
  mergePdfs,
  splitPdf,
  rotatePdf,
  deletePdfPages,
  addPageNumbers,
  addWatermark,
  addHeaderFooter,
  cropPdfMargins,
  imagesToPdf,
  renderPdfToImages,
  extractPdfText,
  extractPdfToHtml,
  extractPdfToDocx,
  extractPdfToXlsx,
  extractPdfToPptx,
  compressPdfClient,
  repairPdfClient,
  ocrPdf,
  organizePdfPages,
  protectPdfClient,
  unlockPdfClient,
  type PageAction,
} from "@/lib/pdfClient";
import { formatBytes } from "@/lib/fileTypes";
import {
  ArrowLeft,
  Sparkles,
  Lock,
  Unlock,
  Play,
  RotateCw,
  Hash,
  Stamp,
  Crop,
  ScanText,
  FileText,
  CheckCircle2,
  AlertCircle,
  Presentation,
  FileSpreadsheet,
  FileType2,
  Images,
  Cpu,
  Layers,
  Settings,
  Scissors,
  Trash2,
  PanelTop,
  FileImage,
  Type,
  Code,
  Wrench,
  PenLine,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import clsx from "clsx";

interface Props {
  params: Promise<{ tool: string }>;
}

export default function DedicatedPdfToolPage({ params }: Props) {
  const { tool: rawToolSlug } = use(params);
  const router = useRouter();
  const { enqueue, setDrawer } = useQueue();
  const { cloudConsent } = useSettings();

  // Normalize tool slug (strip leading "pdf-" if present for clean routing matching)
  const toolSlug = rawToolSlug.replace(/^pdf-/, "");

  // Find tool definition
  const tool = TOOLS.find(
    (t) =>
      t.id === toolSlug ||
      t.id === `pdf-${toolSlug}` ||
      t.href === `/pdf/${toolSlug}` ||
      t.href === `/pdf/pdf-${toolSlug}`
  );

  const [files, setFiles] = useState<StagedFile[]>([]);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [allowPrinting, setAllowPrinting] = useState(true);
  const [allowCopying, setAllowCopying] = useState(true);
  const [allowModifying, setAllowModifying] = useState(false);
  const [allowAnnotating, setAllowAnnotating] = useState(true);
  const [protectEngine, setProtectEngine] = useState<"local" | "server">("local");
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [watermarkText, setWatermarkText] = useState("CONFIDENTIAL");
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.2);
  const [watermarkColor, setWatermarkColor] = useState<"red" | "gray" | "blue">("red");
  const [pageNumberPos, setPageNumberPos] = useState<"bottom-center" | "bottom-right" | "top-right">("bottom-center");
  const [pageNumberFmt, setPageNumberFmt] = useState<"number" | "page-of-total" | "page-n">("page-of-total");
  const [headerText, setHeaderText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [splitRange, setSplitRange] = useState("");
  const [deletePagesSpec, setDeletePagesSpec] = useState("");
  const [rotateAngle, setRotateAngle] = useState<number>(90);
  const [imageFormat, setImageFormat] = useState<"png" | "jpeg" | "webp">("png");
  const [imageDpi, setImageDpi] = useState<number>(2.0); // scale 2.0 = ~144-150 DPI
  const [ocrLang, setOcrLang] = useState("eng");
  const [cropMargins, setCropMargins] = useState({ top: 36, right: 36, bottom: 36, left: 36 });
  const [pptxMode, setPptxMode] = useState<"hybrid" | "image">("hybrid");
  const [compressLevel, setCompressLevel] = useState<"low" | "balanced" | "max">("balanced");
  const [isProcessing, setIsProcessing] = useState(false);

  const isImagesToPdf = toolSlug === "images-to-pdf";
  const acceptedExt = isImagesToPdf ? ".jpg,.jpeg,.png,.webp,.bmp" : ".pdf";
  const isOrganize = toolSlug === "organize" || toolSlug === "reorder";

  // Dedicated handler for Organize Pages applied from the visual grid
  const handleApplyOrganize = async (actions: PageAction[]) => {
    if (files.length === 0) return;
    setIsProcessing(true);
    const targetFile = files[0].file;

    enqueue(
      { title: "Organize PDF Pages", tool: "pdf-organize", kind: "pdf", statKind: "pdf" },
      [
        {
          label: files[0].name,
          inputSize: files[0].size,
          engine: "local",
          run: async (ctx) => {
            ctx.progress(0.2, "Reorganizing document structure");
            const organizedBlob = await organizePdfPages(targetFile, actions);
            ctx.progress(1.0, "Document ready");
            const outName = files[0].name.replace(/\.pdf$/i, "-organized.pdf");
            return {
              outputs: [
                {
                  name: outName,
                  blob: organizedBlob,
                  note: `${actions.length} page(s) organized`,
                },
              ],
            };
          },
        },
      ]
    );
    setIsProcessing(false);
    setDrawer(true);
  };

  const handleRunTool = async () => {
    if (files.length === 0) return;

    // 1. Organize Pages
    if (isOrganize) {
      if (files.length > 0) {
        // If run button clicked without customized grid, preserve full document with current settings
        enqueue(
          { title: "Organize PDF Pages", tool: "pdf-organize", kind: "pdf", statKind: "pdf" },
          files.map((f) => ({
            label: f.name,
            inputSize: f.size,
            engine: "local",
            run: async (ctx) => {
              ctx.progress(0.2, "Reading page layout");
              const info = await f.file.arrayBuffer();
              const actions: PageAction[] = [];
              // Default to sequential identity mapping
              const { getPdfInfo } = await import("@/lib/pdfClient");
              const details = await getPdfInfo(f.file);
              for (let i = 0; i < details.pageCount; i++) {
                actions.push({ sourceIndex: i });
              }
              const organizedBlob = await organizePdfPages(f.file, actions);
              return {
                outputs: [{ name: f.name.replace(/\.pdf$/i, "-organized.pdf"), blob: organizedBlob }],
              };
            },
          }))
        );
        setDrawer(true);
      }
      return;
    }

    // 2. Merge PDFs
    if (toolSlug === "merge") {
      enqueue(
        { title: "Merge PDFs", tool: "pdf-merge", kind: "pdf", statKind: "pdf" },
        [
          {
            label: `Merged Document (${files.length} PDFs)`,
            engine: "local",
            run: async (ctx) => {
              const mergedBlob = await mergePdfs(
                files.map((f) => f.file),
                (p, s) => ctx.progress(p, s)
              );
              return {
                outputs: [{ name: "merged-document.pdf", blob: mergedBlob, note: `${files.length} PDFs combined` }],
              };
            },
          },
        ]
      );
      setDrawer(true);
      return;
    }

    // 3. Split PDF
    if (toolSlug === "split") {
      enqueue(
        { title: "Split PDF", tool: "pdf-split", kind: "pdf", statKind: "pdf" },
        files.map((f) => ({
          label: f.name,
          inputSize: f.size,
          engine: "local",
          run: async (ctx) => {
            ctx.progress(0.3, "Extracting pages");
            const splitted = await splitPdf(f.file, splitRange);
            return { outputs: splitted };
          },
        }))
      );
      setDrawer(true);
      return;
    }

    // 4. Extract Pages
    if (toolSlug === "extract") {
      enqueue(
        { title: "Extract Pages", tool: "pdf-extract", kind: "pdf", statKind: "pdf" },
        files.map((f) => ({
          label: f.name,
          inputSize: f.size,
          engine: "local",
          run: async (ctx) => {
            ctx.progress(0.3, "Extracting selected pages");
            const extracted = await splitPdf(f.file, splitRange || "1");
            return { outputs: extracted };
          },
        }))
      );
      setDrawer(true);
      return;
    }

    // 5. Delete Pages
    if (toolSlug === "delete") {
      enqueue(
        { title: "Delete Pages", tool: "pdf-delete", kind: "pdf", statKind: "pdf" },
        files.map((f) => ({
          label: f.name,
          inputSize: f.size,
          engine: "local",
          run: async (ctx) => {
            ctx.progress(0.3, "Removing specified pages");
            // Parse comma-separated list of numbers
            const parts = deletePagesSpec.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
            const deletedBlob = await deletePdfPages(f.file, parts);
            return {
              outputs: [
                {
                  name: f.name.replace(/\.pdf$/i, "-pages-removed.pdf"),
                  blob: deletedBlob,
                  note: `${parts.length} page(s) removed`,
                },
              ],
            };
          },
        }))
      );
      setDrawer(true);
      return;
    }

    // 6. Rotate PDF
    if (toolSlug === "rotate") {
      enqueue(
        { title: "Rotate PDF", tool: "pdf-rotate", kind: "pdf", statKind: "pdf" },
        files.map((f) => ({
          label: f.name,
          inputSize: f.size,
          engine: "local",
          run: async (ctx) => {
            ctx.progress(0.3, `Rotating ${rotateAngle}°`);
            const rotated = await rotatePdf(f.file, rotateAngle);
            return { outputs: [{ name: f.name.replace(/\.pdf$/i, "-rotated.pdf"), blob: rotated }] };
          },
        }))
      );
      setDrawer(true);
      return;
    }

    // 7. Page Numbers
    if (toolSlug === "page-numbers") {
      enqueue(
        { title: "Add Page Numbers", tool: "pdf-page-numbers", kind: "pdf", statKind: "pdf" },
        files.map((f) => ({
          label: f.name,
          inputSize: f.size,
          engine: "local",
          run: async (ctx) => {
            ctx.progress(0.3, "Applying pagination stamps");
            const numbered = await addPageNumbers(f.file, {
              position: pageNumberPos,
              format: pageNumberFmt,
            });
            return { outputs: [{ name: f.name.replace(/\.pdf$/i, "-numbered.pdf"), blob: numbered }] };
          },
        }))
      );
      setDrawer(true);
      return;
    }

    // 8. Watermark PDF
    if (toolSlug === "watermark") {
      enqueue(
        { title: "Watermark PDF", tool: "pdf-watermark", kind: "pdf", statKind: "pdf" },
        files.map((f) => ({
          label: f.name,
          inputSize: f.size,
          engine: "local",
          run: async (ctx) => {
            ctx.progress(0.3, "Stamping watermark layer");
            const colorRgb =
              watermarkColor === "blue"
                ? { r: 0.1, g: 0.4, b: 0.9 }
                : watermarkColor === "gray"
                ? { r: 0.4, g: 0.4, b: 0.4 }
                : { r: 0.85, g: 0.15, b: 0.15 };
            const wm = await addWatermark(f.file, {
              text: watermarkText || "CONFIDENTIAL",
              opacity: watermarkOpacity,
              color: colorRgb,
            });
            return { outputs: [{ name: f.name.replace(/\.pdf$/i, "-watermarked.pdf"), blob: wm }] };
          },
        }))
      );
      setDrawer(true);
      return;
    }

    // 9. Header & Footer
    if (toolSlug === "header-footer") {
      enqueue(
        { title: "Add Header & Footer", tool: "pdf-header-footer", kind: "pdf", statKind: "pdf" },
        files.map((f) => ({
          label: f.name,
          inputSize: f.size,
          engine: "local",
          run: async (ctx) => {
            ctx.progress(0.3, "Adding running headers and footers");
            const res = await addHeaderFooter(f.file, headerText, footerText);
            return { outputs: [{ name: f.name.replace(/\.pdf$/i, "-headers.pdf"), blob: res }] };
          },
        }))
      );
      setDrawer(true);
      return;
    }

    // 10. Crop PDF
    if (toolSlug === "crop") {
      enqueue(
        { title: "Crop PDF Margins", tool: "pdf-crop", kind: "pdf", statKind: "pdf" },
        files.map((f) => ({
          label: f.name,
          inputSize: f.size,
          engine: "local",
          run: async (ctx) => {
            ctx.progress(0.4, "Applying crop margins");
            const cropped = await cropPdfMargins(f.file, cropMargins);
            return { outputs: [{ name: f.name.replace(/\.pdf$/i, "-cropped.pdf"), blob: cropped }] };
          },
        }))
      );
      setDrawer(true);
      return;
    }

    // 11. Images to PDF
    if (isImagesToPdf) {
      enqueue(
        { title: "Images to PDF", tool: "images-to-pdf", kind: "pdf", statKind: "pdf" },
        [
          {
            label: `Compiled PDF (${files.length} images)`,
            engine: "local",
            run: async (ctx) => {
              const pdfBlob = await imagesToPdf(
                files.map((f) => f.file),
                "fit",
                (p, s) => ctx.progress(p, s)
              );
              return { outputs: [{ name: "compiled-images.pdf", blob: pdfBlob }] };
            },
          },
        ]
      );
      setDrawer(true);
      return;
    }

    // 12. PDF to Images (PNG, JPEG, WebP)
    if (toolSlug === "to-image") {
      enqueue(
        { title: "PDF to Images", tool: "pdf-to-image", kind: "pdf", statKind: "convert" },
        files.map((f) => ({
          label: f.name,
          inputSize: f.size,
          engine: "local",
          run: async (ctx) => {
            const images = await renderPdfToImages(
              f.file,
              imageFormat,
              imageDpi,
              splitRange,
              (p, s) => ctx.progress(p, s)
            );
            return { outputs: images };
          },
        }))
      );
      setDrawer(true);
      return;
    }

    // 13. PDF to Text
    if (toolSlug === "to-text") {
      enqueue(
        { title: "PDF to Text", tool: "pdf-to-text", kind: "pdf", statKind: "convert" },
        files.map((f) => ({
          label: f.name,
          inputSize: f.size,
          engine: "local",
          run: async (ctx) => {
            const res = await extractPdfText(f.file, splitRange, (p, s) => ctx.progress(p, s));
            const outName = f.name.replace(/\.pdf$/i, ".txt");
            return { outputs: [{ name: outName, blob: res.blob }] };
          },
        }))
      );
      setDrawer(true);
      return;
    }

    // 14. OCR PDF
    if (toolSlug === "ocr") {
      enqueue(
        { title: "OCR PDF", tool: "pdf-ocr", kind: "pdf", statKind: "ocr" },
        files.map((f) => ({
          label: f.name,
          inputSize: f.size,
          engine: "local",
          run: async (ctx) => {
            const res = await ocrPdf(f.file, ocrLang, (p, s) => ctx.progress(p, s));
            const outName = f.name.replace(/\.pdf$/i, "-ocr.txt");
            return { outputs: [{ name: outName, blob: res.blob }] };
          },
        }))
      );
      setDrawer(true);
      return;
    }

    // 15. Annotate / Sign
    if (toolSlug === "edit" || toolSlug === "sign") {
      enqueue(
        { title: "Annotate & Sign", tool: "pdf-edit", kind: "pdf", statKind: "pdf" },
        files.map((f) => ({
          label: f.name,
          inputSize: f.size,
          engine: "local",
          run: async (ctx) => {
            ctx.progress(0.3, "Applying annotation stamp");
            const wm = await addWatermark(f.file, {
              text: watermarkText || "APPROVED & SIGNED",
              opacity: 0.35,
              rotation: 0,
              fontSize: 32,
              color: { r: 0.1, g: 0.3, b: 0.8 },
            });
            return { outputs: [{ name: f.name.replace(/\.pdf$/i, "-signed.pdf"), blob: wm }] };
          },
        }))
      );
      setDrawer(true);
      return;
    }

    // 16. Protect PDF (Enterprise AES-256 with In-Browser & Automatic Failover)
    if (toolSlug === "protect") {
      if (!password) {
        setValidationError("Please enter a password to protect your document.");
        return;
      }
      if (password !== confirmPassword) {
        setValidationError("Passwords do not match. Please verify and re-enter your password.");
        return;
      }
      setValidationError(null);

      // If user selected server mode but hasn't consented yet, show consent dialog
      if (protectEngine === "server" && !cloudConsent) {
        setShowConsentModal(true);
        return;
      }

      enqueue(
        { title: "Protect PDF", tool: "pdf-protect", kind: "pdf", statKind: "pdf" },
        files.map((f) => ({
          label: f.name,
          inputSize: f.size,
          engine: protectEngine,
          run: async (ctx) => {
            if (protectEngine === "server") {
              try {
                ctx.progress(0.2, "Sending document to server for AES-256 encryption");
                const res = await runServerJob(
                  "pdf.protect",
                  [f.file],
                  [f.name],
                  {
                    userPassword: password,
                    ownerPassword: ownerPassword || password,
                    allowPrint: allowPrinting,
                    allowCopy: allowCopying,
                    allowModify: allowModifying,
                  },
                  ctx.signal,
                  (p, s) => ctx.progress(p, s)
                );
                return { outputs: res.files, warnings: res.warnings };
              } catch (err: any) {
                // If server is not reachable, down, or requires local fallback
                const isServerUnavailable =
                  err?.status === 404 ||
                  err?.status === 428 ||
                  err?.status === 503 ||
                  err?.status === 0 ||
                  /active backend service|Server processing is turned off|not reach|disappeared|HTTP 404|404|NetworkError/i.test(
                    err?.message || ""
                  );
                if (isServerUnavailable) {
                  ctx.progress(0.4, "Switching to certified in-browser AES-256 encryption");
                  const encryptedBlob = await protectPdfClient(
                    f.file,
                    {
                      userPassword: password,
                      ownerPassword: ownerPassword || password,
                      allowPrinting,
                      allowCopying,
                      allowModifying,
                      allowAnnotating,
                    },
                    (p, s) => ctx.progress(p, s)
                  );
                  return {
                    outputs: [
                      {
                        name: f.name.replace(/\.pdf$/i, "-protected.pdf"),
                        blob: encryptedBlob,
                        note: "Certified AES-256 (in-browser fallback)",
                      },
                    ],
                    warnings: ["Server was unavailable; protected locally in-browser with AES-256."],
                  };
                }
                throw err;
              }
            } else {
              // Local In-Browser AES-256 (100% Private, zero uploads)
              ctx.progress(0.2, "Encrypting locally with certified AES-256");
              const encryptedBlob = await protectPdfClient(
                f.file,
                {
                  userPassword: password,
                  ownerPassword: ownerPassword || password,
                  allowPrinting,
                  allowCopying,
                  allowModifying,
                  allowAnnotating,
                },
                (p, s) => ctx.progress(p, s)
              );
              return {
                outputs: [
                  {
                    name: f.name.replace(/\.pdf$/i, "-protected.pdf"),
                    blob: encryptedBlob,
                    note: "Certified AES-256 encrypted",
                  },
                ],
              };
            }
          },
        }))
      );
      setDrawer(true);
      return;
    }

    // 17. Unlock PDF (In-Browser Decryption with Server Failover)
    if (toolSlug === "unlock") {
      if (!password) {
        setValidationError("Please enter the decryption password.");
        return;
      }
      setValidationError(null);

      enqueue(
        { title: "Unlock PDF", tool: "pdf-unlock", kind: "pdf", statKind: "pdf" },
        files.map((f) => ({
          label: f.name,
          inputSize: f.size,
          engine: "local",
          run: async (ctx) => {
            ctx.progress(0.3, "Decrypting PDF document");
            try {
              const unlockedBlob = await unlockPdfClient(f.file, password, (p, s) => ctx.progress(p, s));
              return {
                outputs: [
                  {
                    name: f.name.replace(/\.pdf$/i, "-unlocked.pdf"),
                    blob: unlockedBlob,
                    note: "Decrypted & unrestricted",
                  },
                ],
              };
            } catch (err: any) {
              if (cloudConsent) {
                try {
                  ctx.progress(0.5, "Trying server-side decryption engine");
                  const res = await runServerJob(
                    "pdf.unlock",
                    [f.file],
                    [f.name],
                    { password },
                    ctx.signal,
                    (p, s) => ctx.progress(p, s)
                  );
                  return { outputs: res.files, warnings: res.warnings };
                } catch {
                  // Fall through to throw original error
                }
              }
              throw err;
            }
          },
        }))
      );
      setDrawer(true);
      return;
    }

    // -------------------------------------------------------------------------
    // HYBRID & SERVER OPERATIONS (With Instant Automatic Fallback!)
    // -------------------------------------------------------------------------
    let serverOp = "pdf.compress";
    let options: Record<string, any> = {};
    let fallbackFn: ((f: File, ctx: any) => Promise<{ name: string; blob: Blob }[]>) | null = null;

    if (toolSlug === "to-word") {
      serverOp = "pdf.to_docx";
      options = { password: password || undefined };
      fallbackFn = async (file, ctx) => {
        ctx.progress(0.4, "Using high-compatibility client Word engine");
        const docxBlob = await extractPdfToDocx(file, (p, s) => ctx.progress(p, s));
        return [{ name: file.name.replace(/\.pdf$/i, ".docx"), blob: docxBlob }];
      };
    } else if (toolSlug === "to-pptx") {
      serverOp = "pdf.to_pptx";
      options = { mode: pptxMode, password: password || undefined };
      fallbackFn = async (file, ctx) => {
        ctx.progress(0.4, "Using high-compatibility client slide engine");
        const pptxBlob = await extractPdfToPptx(file, pptxMode, (p, s) => ctx.progress(p, s));
        return [{ name: file.name.replace(/\.pdf$/i, ".pptx"), blob: pptxBlob }];
      };
    } else if (toolSlug === "to-excel") {
      serverOp = "pdf.to_xlsx";
      options = { password: password || undefined };
      fallbackFn = async (file, ctx) => {
        ctx.progress(0.4, "Using high-compatibility client spreadsheet engine");
        const xlsxBlob = await extractPdfToXlsx(file, (p, s) => ctx.progress(p, s));
        return [{ name: file.name.replace(/\.pdf$/i, ".xlsx"), blob: xlsxBlob }];
      };
    } else if (toolSlug === "to-html") {
      serverOp = "pdf.to_html";
      fallbackFn = async (file, ctx) => {
        ctx.progress(0.4, "Generating standalone web document");
        const htmlBlob = await extractPdfToHtml(file, (p, s) => ctx.progress(p, s));
        return [{ name: file.name.replace(/\.pdf$/i, ".html"), blob: htmlBlob }];
      };
    } else if (toolSlug === "compress") {
      serverOp = "pdf.compress";
      options = { level: compressLevel, password: password || undefined };
      fallbackFn = async (file, ctx) => {
        ctx.progress(0.4, "Running client object-stream compression");
        const compBlob = await compressPdfClient(file, compressLevel, (p, s) => ctx.progress(p, s));
        return [{ name: file.name.replace(/\.pdf$/i, "-compressed.pdf"), blob: compBlob }];
      };
    } else if (toolSlug === "repair") {
      serverOp = "pdf.repair";
      fallbackFn = async (file, ctx) => {
        ctx.progress(0.4, "Rebuilding cross-reference tables");
        const repBlob = await repairPdfClient(file);
        return [{ name: file.name.replace(/\.pdf$/i, "-repaired.pdf"), blob: repBlob }];
      };
    } else if (toolSlug === "extract-images") {
      serverOp = "pdf.extract_images";
      options = { password: password || undefined };
    } else if (toolSlug === "to-svg") {
      serverOp = "pdf.to_svg";
      options = { pages: splitRange || undefined, password: password || undefined };
    }

    enqueue(
      {
        title: tool?.name || "PDF Operation",
        tool: tool?.id || "pdf",
        kind: "pdf",
        statKind: toolSlug.includes("convert") || toolSlug.includes("to-") ? "convert" : "pdf",
      },
      files.map((f) => ({
        label: f.name,
        inputSize: f.size,
        engine: fallbackFn ? "local" : "server",
        run: async (ctx) => {
          try {
            const res = await runServerJob(serverOp, [f.file], [f.name], options, ctx.signal, (p, s) =>
              ctx.progress(p, s)
            );
            return { outputs: res.files, warnings: res.warnings };
          } catch (err: any) {
            // Check for server unreachability, 404, or network failure
            const isServerIssue =
              err?.status === 404 ||
              err?.status === 0 ||
              /not reach|disappeared|HTTP 404|404|NetworkError/i.test(err?.message || "");

            if (isServerIssue && fallbackFn) {
              ctx.progress(0.2, "Switching to client processing pipeline");
              const clientOutputs = await fallbackFn(f.file, ctx);
              return {
                outputs: clientOutputs,
                warnings: ["Processed locally with client high-speed engine"],
              };
            }
            throw err;
          }
        },
      }))
    );
    setDrawer(true);
  };

  const isLocalEngine =
    tool?.engine === "local" ||
    isImagesToPdf ||
    isOrganize ||
    (toolSlug === "protect" && protectEngine === "local") ||
    toolSlug === "unlock" ||
    [
      "merge",
      "split",
      "rotate",
      "delete",
      "extract",
      "crop",
      "page-numbers",
      "watermark",
      "header-footer",
      "edit",
      "sign",
      "to-image",
      "to-text",
      "ocr",
    ].includes(toolSlug);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-150">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-center gap-3">
          <Link
            href="/pdf"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span>{tool?.name || "PDF Workspace Tool"}</span>
              <span
                className={clsx(
                  "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded",
                  isLocalEngine
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                )}
              >
                {isLocalEngine ? "In-Browser (100% Private)" : "Hybrid & High-Fidelity"}
              </span>
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {tool?.description || "Configure parameters and run the document operation"}
            </p>
          </div>
        </div>
      </div>

      {/* Main Workspace Layout */}
      {files.length === 0 ? (
        <DropZone
          onFilesSelected={(newFiles) => setFiles((prev) => [...prev, ...newFiles])}
          selectedFiles={files}
          onRemoveFile={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
          onClearAll={() => setFiles([])}
          accept={acceptedExt}
          title={
            isImagesToPdf
              ? "Drop images to convert into a compiled PDF"
              : `Drop PDF file(s) for ${tool?.name || "processing"}`
          }
          description={
            isImagesToPdf
              ? "Supports PNG, JPEG, WebP, BMP images"
              : "Select or drag PDF documents to begin"
          }
          showToolRecommendations={false}
        />
      ) : isOrganize ? (
        // Dedicated Visual Page Organizer Layout for Organize Pages
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {files[0].name} ({formatBytes(files[0].size)})
              </span>
            </div>
            <button
              onClick={() => setFiles([])}
              className="text-xs text-slate-500 hover:text-red-500 transition-colors cursor-pointer"
            >
              Choose different PDF
            </button>
          </div>

          <PageOrganizer
            file={files[0].file}
            onApply={handleApplyOrganize}
            isProcessing={isProcessing}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Uploaded Files & Staging Deck (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <DropZone
              onFilesSelected={(newFiles) => setFiles((prev) => [...prev, ...newFiles])}
              selectedFiles={files}
              onRemoveFile={(id) => setFiles((prev) => prev.filter((f) => f.id !== id))}
              onClearAll={() => setFiles([])}
              accept={acceptedExt}
              showToolRecommendations={false}
            />
          </div>

          {/* Right Column: Settings & Execution Controls (7 cols) */}
          <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 shadow-2xs p-5 sm:p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Operation Settings
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">
                {files.length} document(s) staged
              </span>
            </div>

            {/* Validation Error Banner */}
            {validationError && (
              <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 flex items-center gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400" />
                <span className="font-medium">{validationError}</span>
              </div>
            )}

            {/* Options for Rotate */}
            {toolSlug === "rotate" && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Rotation Angle:
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { angle: 90, label: "90° Clockwise" },
                    { angle: 180, label: "180° Flip" },
                    { angle: 270, label: "270° (90° CCW)" },
                  ].map((item) => (
                    <button
                      key={item.angle}
                      type="button"
                      onClick={() => setRotateAngle(item.angle)}
                      className={clsx(
                        "p-2.5 rounded-xl border text-center text-xs transition-all cursor-pointer",
                        rotateAngle === item.angle
                          ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 font-semibold"
                          : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      )}
                    >
                      <RotateCw className="w-4 h-4 mx-auto mb-1" />
                      <div>{item.label}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Options for Delete Pages */}
            {toolSlug === "delete" && (
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Pages to Remove (1-based, comma separated):
                </label>
                <input
                  type="text"
                  value={deletePagesSpec}
                  onChange={(e) => setDeletePagesSpec(e.target.value)}
                  placeholder="e.g. 2, 4, 7"
                  className="w-full max-w-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Enter the specific page numbers you want deleted from the document.
                </p>
              </div>
            )}

            {/* Options for Crop */}
            {toolSlug === "crop" && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                  Crop Margins (Points / approx 1/72 inch):
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(["top", "bottom", "left", "right"] as const).map((side) => (
                    <div key={side}>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                        {side}
                      </span>
                      <input
                        type="number"
                        min="0"
                        max="200"
                        value={cropMargins[side]}
                        onChange={(e) =>
                          setCropMargins((prev) => ({
                            ...prev,
                            [side]: parseInt(e.target.value, 10) || 0,
                          }))
                        }
                        className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Options for Header & Footer */}
            {toolSlug === "header-footer" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Running Header Text:
                  </label>
                  <input
                    type="text"
                    value={headerText}
                    onChange={(e) => setHeaderText(e.target.value)}
                    placeholder="e.g. Project TWOOLKIT Specification"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Running Footer Text:
                  </label>
                  <input
                    type="text"
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    placeholder="e.g. Confidential & Proprietary"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                  />
                </div>
              </div>
            )}

            {/* Options for PDF to Image */}
            {toolSlug === "to-image" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Output Image Format:
                  </label>
                  <div className="flex items-center gap-2">
                    {(["png", "jpeg", "webp"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setImageFormat(fmt)}
                        className={clsx(
                          "px-3 py-1 rounded-lg border text-xs font-semibold uppercase cursor-pointer",
                          imageFormat === fmt
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-300"
                            : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                        )}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Resolution Quality:
                  </label>
                  <select
                    value={imageDpi}
                    onChange={(e) => setImageDpi(parseFloat(e.target.value))}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                  >
                    <option value={1.5}>Standard (108 DPI)</option>
                    <option value={2.0}>High (144 DPI - Recommended)</option>
                    <option value={3.0}>Ultra HD (216 DPI)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Options for OCR */}
            {toolSlug === "ocr" && (
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Recognition Language:
                </label>
                <select
                  value={ocrLang}
                  onChange={(e) => setOcrLang(e.target.value)}
                  className="w-full max-w-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                >
                  <option value="eng">English (Latin)</option>
                  <option value="spa">Spanish (Español)</option>
                  <option value="fra">French (Français)</option>
                  <option value="deu">German (Deutsch)</option>
                </select>
              </div>
            )}

            {/* Options for to-pptx */}
            {toolSlug === "to-pptx" && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Slide Layout Mode:
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setPptxMode("hybrid")}
                    className={clsx(
                      "p-3 rounded-xl border text-left text-xs transition-all cursor-pointer",
                      pptxMode === "hybrid"
                        ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 font-semibold"
                        : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                    )}
                  >
                    <div className="font-bold">Hybrid (Editable Text)</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-normal">
                      Extracts structured text frames for editing in PowerPoint
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPptxMode("image")}
                    className={clsx(
                      "p-3 rounded-xl border text-left text-xs transition-all cursor-pointer",
                      pptxMode === "image"
                        ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 font-semibold"
                        : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                    )}
                  >
                    <div className="font-bold">Image Slides</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 leading-normal">
                      Renders exact high-resolution slide images
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Options for Password Protect */}
            {toolSlug === "protect" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    User Password (Required to Open):
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter document password"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Owner Password (Optional):
                  </label>
                  <input
                    type="password"
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    placeholder="Permissions master password"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                  />
                </div>
              </div>
            )}

            {/* Options for Password Unlock */}
            {toolSlug === "unlock" && (
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Enter Document Decryption Password:
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password to unlock"
                  className="w-full max-w-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                />
              </div>
            )}

            {/* Options for Compress */}
            {toolSlug === "compress" && (
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                  Compression Preset:
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: "low", label: "Low", desc: "Max quality" },
                    { id: "balanced", label: "Balanced", desc: "Best balance" },
                    { id: "max", label: "Maximum", desc: "Smallest size" },
                  ].map((lvl) => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setCompressLevel(lvl.id as any)}
                      className={clsx(
                        "p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer",
                        compressLevel === lvl.id
                          ? "border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-900 dark:text-blue-100 font-semibold"
                          : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
                      )}
                    >
                      <div className="font-bold">{lvl.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{lvl.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Options for Watermark & Annotate */}
            {(toolSlug === "watermark" || toolSlug === "edit" || toolSlug === "sign") && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Stamp Text:
                  </label>
                  <input
                    type="text"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="e.g. CONFIDENTIAL, DRAFT, APPROVED"
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Opacity: {Math.round(watermarkOpacity * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0.05"
                    max="0.8"
                    step="0.05"
                    value={watermarkOpacity}
                    onChange={(e) => setWatermarkOpacity(parseFloat(e.target.value))}
                    className="w-full mt-1.5"
                  />
                </div>
              </div>
            )}

            {/* Options for Page Numbers */}
            {toolSlug === "page-numbers" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Position:
                  </label>
                  <select
                    value={pageNumberPos}
                    onChange={(e) => setPageNumberPos(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                  >
                    <option value="bottom-center">Bottom Center</option>
                    <option value="bottom-right">Bottom Right</option>
                    <option value="top-right">Top Right</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Format:
                  </label>
                  <select
                    value={pageNumberFmt}
                    onChange={(e) => setPageNumberFmt(e.target.value as any)}
                    className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                  >
                    <option value="page-of-total">Page 1 of 10</option>
                    <option value="number">1</option>
                    <option value="page-n">Page 1</option>
                  </select>
                </div>
              </div>
            )}

            {/* Options for Split / Extract / Custom Range */}
            {(toolSlug === "split" || toolSlug === "extract" || toolSlug === "to-svg" || toolSlug === "to-image" || toolSlug === "to-text") && (
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Custom Page Range (leave blank for all pages):
                </label>
                <input
                  type="text"
                  value={splitRange}
                  onChange={(e) => setSplitRange(e.target.value)}
                  placeholder="e.g. 1-3, 5, 8-10"
                  className="w-full max-w-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-hidden"
                />
              </div>
            )}

            {/* Action Bar */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="text-[11px] text-slate-400">
                {isLocalEngine
                  ? "Client-side browser processing · 100% Private"
                  : "Automatic hybrid engine with client fallback"}
              </div>
              <button
                onClick={handleRunTool}
                className="py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Execute Operation</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
