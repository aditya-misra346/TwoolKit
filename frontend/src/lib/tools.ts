/**
 * Central registry of every tool and navigation structure in TWOOLKIT.
 */
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  ScanSearch,
  HardDrive,
  FileText,
  FileType2,
  Image as ImageIcon,
  Minimize2,
  FolderTree,
  History,
  Settings,
  Combine,
  Scissors,
  FileOutput,
  Trash2,
  LayoutGrid,
  RotateCw,
  Lock,
  Unlock,
  Wrench,
  Hash,
  Stamp,
  PanelTop,
  PenLine,
  Signature,
  Crop,
  ScanText,
  BookOpen,
  FileSpreadsheet,
  Presentation,
  FileImage,
  FileCode2,
  Images,
  Copy,
  Sparkles,
  Archive,
  FileDown,
  Type,
  Video,
} from "lucide-react";

export type Engine = "local" | "server" | "hybrid";

export interface Tool {
  id: string;
  name: string;
  short?: string;
  description: string;
  href: string;
  icon: LucideIcon;
  group: "core" | "pdf" | "pdf-convert" | "convert" | "image" | "manage";
  engine: Engine;
  keywords: string;
  serverOps?: string[];
}

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

export interface NavSection {
  id: string;
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "workspace",
    title: "Workspace",
    items: [
      { id: "dashboard", label: "Dashboard", href: "/", icon: LayoutDashboard },
      { id: "recent", label: "Recent Files", href: "/recent", icon: History },
    ],
  },
  {
    id: "file-management",
    title: "File Management",
    items: [
      { id: "scanner", label: "File Scanner", href: "/scanner", icon: ScanSearch },
      { id: "storage", label: "Storage Manager", href: "/storage", icon: HardDrive },
      { id: "organizer", label: "File Organizer", href: "/organizer", icon: FolderTree },
      { id: "duplicates", label: "Duplicate Finder", href: "/scanner?tab=duplicates", icon: Copy },
    ],
  },
  {
    id: "pdf-workspace",
    title: "PDF Workspace",
    items: [
      { id: "pdf", label: "All PDF Tools", href: "/pdf", icon: FileText },
      { id: "pdf-merge", label: "Merge PDFs", href: "/pdf/merge", icon: Combine },
      { id: "pdf-split", label: "Split PDF", href: "/pdf/split", icon: Scissors },
      { id: "pdf-compress", label: "Compress PDF", href: "/pdf/compress", icon: Minimize2 },
      { id: "pdf-to-word", label: "PDF to Word", href: "/pdf/to-word", icon: FileType2 },
    ],
  },
  {
    id: "conversion",
    title: "Conversion",
    items: [
      { id: "documents", label: "Document Converter", href: "/documents", icon: FileType2 },
      { id: "presentations", label: "Presentation Studio", href: "/documents/presentations", icon: Presentation },
      { id: "images", label: "Image Studio", href: "/images", icon: ImageIcon },
    ],
  },
  {
    id: "system",
    title: "System & AI",
    items: [
      { id: "compress", label: "File Compressor", href: "/compress", icon: Minimize2 },
      { id: "assistant", label: "File Assistant", href: "/assistant", icon: Sparkles },
      { id: "brand", label: "Brand Identity", href: "/brand", icon: Sparkles },
      { id: "settings", label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

// Flat NAV list for backwards compatibility
export const NAV: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);

/** Bottom bar on phones */
export const MOBILE_NAV = ["dashboard", "scanner", "pdf", "images", "storage"];

export const TOOLS: Tool[] = [
  // ---- core
  { id: "scanner", name: "Scan Files", description: "Analyse files & folders: types, integrity, risks.", href: "/scanner", icon: ScanSearch, group: "core", engine: "local", keywords: "scan analyze folder integrity security signature mime" },
  { id: "storage", name: "Analyze Storage", description: "See what takes space and what you can safely clean up.", href: "/storage", icon: HardDrive, group: "core", engine: "local", keywords: "storage space cleanup large old empty folders recycle" },
  { id: "duplicates", name: "Find Duplicates", description: "Exact (SHA-256) and visually similar duplicates.", href: "/scanner?tab=duplicates", icon: Copy, group: "core", engine: "local", keywords: "duplicate copies hash perceptual similar images" },
  { id: "compress", name: "Compress Files", description: "PDF, images, Office files and ZIP archives.", href: "/compress", icon: Minimize2, group: "core", engine: "hybrid", keywords: "compress reduce size shrink optimize zip" },
  { id: "organizer", name: "Organize Files", description: "Batch rename, sort into folders, ZIP create/extract.", href: "/organizer", icon: FolderTree, group: "manage", engine: "local", keywords: "rename organize sort folder zip extract archive batch" },
  { id: "assistant", name: "File Assistant", description: "Summaries, key facts and format advice for your files.", href: "/assistant", icon: Sparkles, group: "manage", engine: "hybrid", keywords: "ai assistant summarize summary extract explain gemini" },
  { id: "archive", name: "ZIP Archives", description: "Create or safely extract ZIP archives in the browser.", href: "/organizer?tab=archive", icon: Archive, group: "manage", engine: "local", keywords: "zip unzip archive extract create" },

  // ---- PDF management
  { id: "pdf-merge", name: "Merge PDFs", description: "Combine PDFs into one document, in any order.", href: "/pdf/merge", icon: Combine, group: "pdf", engine: "local", keywords: "merge combine join pdf" },
  { id: "pdf-split", name: "Split PDF", description: "Split into single pages or custom ranges.", href: "/pdf/split", icon: Scissors, group: "pdf", engine: "local", keywords: "split separate pages ranges pdf" },
  { id: "pdf-organize", name: "Organize Pages", description: "Reorder, rotate, delete, insert blank or add pages.", href: "/pdf/organize", icon: LayoutGrid, group: "pdf", engine: "local", keywords: "reorder drag rotate delete insert blank add pages organize" },
  { id: "pdf-extract", name: "Extract Pages", description: "Pull selected pages into a new PDF.", href: "/pdf/extract", icon: FileOutput, group: "pdf", engine: "local", keywords: "extract select pages" },
  { id: "pdf-delete", name: "Delete Pages", description: "Remove pages you don't need.", href: "/pdf/delete", icon: Trash2, group: "pdf", engine: "local", keywords: "delete remove pages" },
  { id: "pdf-rotate", name: "Rotate PDF", description: "Rotate all or selected pages.", href: "/pdf/rotate", icon: RotateCw, group: "pdf", engine: "local", keywords: "rotate turn orientation" },
  { id: "pdf-compress", name: "Compress PDF", description: "Downsample images and clean structure.", href: "/pdf/compress", icon: Minimize2, group: "pdf", engine: "hybrid", keywords: "compress reduce shrink pdf size", serverOps: ["pdf.compress"] },
  { id: "pdf-protect", name: "Protect PDF", description: "Encrypt with a password (AES-256).", href: "/pdf/protect", icon: Lock, group: "pdf", engine: "hybrid", keywords: "password encrypt protect secure", serverOps: ["pdf.protect"] },
  { id: "pdf-unlock", name: "Unlock PDF", description: "Remove a password you know.", href: "/pdf/unlock", icon: Unlock, group: "pdf", engine: "hybrid", keywords: "unlock decrypt remove password", serverOps: ["pdf.unlock"] },
  { id: "pdf-repair", name: "Repair PDF", description: "Rebuild damaged cross-reference tables.", href: "/pdf/repair", icon: Wrench, group: "pdf", engine: "hybrid", keywords: "repair fix damaged corrupt broken", serverOps: ["pdf.repair"] },
  { id: "pdf-page-numbers", name: "Page Numbers", description: "Add page numbers in any corner.", href: "/pdf/page-numbers", icon: Hash, group: "pdf", engine: "local", keywords: "page numbers numbering" },
  { id: "pdf-watermark", name: "Watermark", description: "Stamp text or an image across pages.", href: "/pdf/watermark", icon: Stamp, group: "pdf", engine: "local", keywords: "watermark stamp confidential draft" },
  { id: "pdf-header-footer", name: "Header & Footer", description: "Add running headers and footers.", href: "/pdf/header-footer", icon: PanelTop, group: "pdf", engine: "local", keywords: "header footer running title" },
  { id: "pdf-edit", name: "Annotate & Sign", description: "Add text, highlights, drawings and signatures.", href: "/pdf/edit", icon: PenLine, group: "pdf", engine: "local", keywords: "edit annotate text highlight sign signature draw comment" },
  { id: "pdf-sign", name: "Sign PDF", description: "Draw, type or upload your signature.", href: "/pdf/edit?mode=sign", icon: Signature, group: "pdf", engine: "local", keywords: "sign signature esign" },
  { id: "pdf-crop", name: "Crop PDF", description: "Trim page margins visually.", href: "/pdf/crop", icon: Crop, group: "pdf", engine: "local", keywords: "crop trim margins" },
  { id: "pdf-ocr", name: "OCR PDF", description: "Make scanned PDFs & images searchable.", href: "/pdf/ocr", icon: ScanText, group: "pdf", engine: "local", keywords: "ocr text recognition scanned searchable tesseract" },
  { id: "pdf-viewer", name: "PDF Viewer", description: "Read, search, zoom and navigate PDFs.", href: "/pdf/view", icon: BookOpen, group: "pdf", engine: "local", keywords: "view read preview open search" },
  { id: "images-to-pdf", name: "Images to PDF", description: "Turn JPG, PNG or WebP images into a PDF.", href: "/pdf/images-to-pdf", icon: FileDown, group: "pdf", engine: "local", keywords: "jpg to pdf images png to pdf photo" },

  // ---- PDF conversion
  { id: "pdf-to-word", name: "PDF to Word", description: "Editable DOCX with layout reconstruction.", href: "/pdf/to-word", icon: FileType2, group: "pdf-convert", engine: "hybrid", keywords: "pdf to word docx doc convert", serverOps: ["pdf.to_docx"] },
  { id: "pdf-to-pptx", name: "PDF to PowerPoint", description: "Slides with editable text where possible.", href: "/pdf/to-pptx", icon: Presentation, group: "pdf-convert", engine: "hybrid", keywords: "pdf to pptx powerpoint slides convert", serverOps: ["pdf.to_pptx"] },
  { id: "pdf-to-excel", name: "PDF to Excel", description: "Detect tables and export to XLSX.", href: "/pdf/to-excel", icon: FileSpreadsheet, group: "pdf-convert", engine: "hybrid", keywords: "pdf to excel xlsx tables spreadsheet", serverOps: ["pdf.to_xlsx"] },
  { id: "pdf-to-image", name: "PDF to Image", description: "JPEG, PNG or WebP per page, in your browser.", href: "/pdf/to-image", icon: FileImage, group: "pdf-convert", engine: "local", keywords: "pdf to jpg jpeg png webp image" },
  { id: "pdf-to-svg", name: "PDF to SVG", description: "Vector SVG per page.", href: "/pdf/to-svg", icon: FileCode2, group: "pdf-convert", engine: "server", keywords: "pdf to svg vector", serverOps: ["pdf.to_svg"] },
  { id: "pdf-to-text", name: "PDF to Text", description: "Extract the text layer locally.", href: "/pdf/to-text", icon: Type, group: "pdf-convert", engine: "local", keywords: "pdf to txt text extract" },
  { id: "pdf-to-html", name: "PDF to HTML", description: "Single-file HTML with images.", href: "/pdf/to-html", icon: FileCode2, group: "pdf-convert", engine: "hybrid", keywords: "pdf to html web", serverOps: ["pdf.to_html"] },
  { id: "pdf-extract-images", name: "Extract Images", description: "Pull embedded images out of PDFs.", href: "/pdf/extract-images", icon: Images, group: "pdf-convert", engine: "server", keywords: "extract images pictures photos from pdf", serverOps: ["pdf.extract_images"] },

  // ---- converters
  { id: "doc-convert", name: "Convert Documents", description: "Word, ODT, RTF, HTML, TXT, Markdown ↔ PDF & more.", href: "/documents", icon: FileType2, group: "convert", engine: "server", keywords: "docx to pdf word odt rtf html markdown convert document", serverOps: ["office.convert", "data.convert"] },
  { id: "pptx-convert", name: "Convert PPTX", description: "Slides to PDF, images or video; PDF to slides.", href: "/documents/presentations", icon: Presentation, group: "convert", engine: "server", keywords: "pptx ppt powerpoint to pdf slides images video", serverOps: ["office.convert", "office.to_images"] },
  { id: "sheet-convert", name: "Convert Spreadsheets", description: "XLSX, XLS, ODS, CSV, TSV, JSON.", href: "/documents?family=spreadsheet", icon: FileSpreadsheet, group: "convert", engine: "server", keywords: "xlsx csv excel spreadsheet tsv ods json convert", serverOps: ["office.convert", "data.convert"] },
  { id: "image-convert", name: "Convert Images", description: "JPEG, PNG, WebP, AVIF, HEIC, TIFF, SVG & more.", href: "/images", icon: ImageIcon, group: "image", engine: "hybrid", keywords: "image convert png jpg jpeg webp avif heic tiff bmp ico svg gif" },
  { id: "image-compress", name: "Compress Images", description: "Lossy or lossless with live before/after.", href: "/images?tool=compress", icon: Minimize2, group: "image", engine: "local", keywords: "image compress optimize reduce" },
  { id: "image-edit", name: "Resize & Edit", description: "Resize, crop, rotate, flip, grayscale.", href: "/images?tool=edit", icon: Crop, group: "image", engine: "local", keywords: "resize crop rotate flip grayscale aspect edit" },
  { id: "image-metadata", name: "Image Metadata", description: "Inspect and strip EXIF/GPS metadata.", href: "/images?tool=metadata", icon: ScanSearch, group: "image", engine: "local", keywords: "exif metadata gps strip remove privacy" },
];

export const toolById = (id: string) => TOOLS.find((t) => t.id === id);

export const QUICK_ACTIONS = [
  "scanner",
  "storage",
  "pdf-to-pptx",
  "pptx-convert",
  "image-convert",
  "pdf-compress",
  "compress",
  "duplicates",
];
