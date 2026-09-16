# 🚀 PDFPals

**PDFPals** is a professional-grade, local-first PDF utility suite designed for maximum privacy and performance. Unlike cloud-based alternatives, PDFPals processes all documents entirely on your hardware—your files never leave your device.

---

## 🎨 Professional Glassmorphism UI
Experience a premium, high-fidelity interface with dynamic themes (Light, Dark, Linux, Ubuntu) and a glassmorphism design language that feels modern and industrial.

## 🛠️ Feature Categories

### ✍️ Edit & Annotate
*   **Edit PDF (New Flagship Tool)**:
    *   **In-Place Text Editing**: Click and edit existing words, names, or dates on digital certificates and documents.
    *   **Intelligent Color Detection**: Deep pixel-histogram analysis automatically detects colored banner/ribbon backgrounds (e.g., dark red, navy, gold) and matching text ink colors.
    *   **Dual Eyedropper Tools**: Built-in 💧 eyedroppers for sampling both text and background colors directly from any pixel in your document.
    *   **Certificate Typography**: Built-in luxury serif, certificate roman, and calligraphy fonts (*Cinzel*, *Great Vibes*, *Playfair Display*, *Montserrat*, etc.).
    *   **Vector Stamps & Symbols**: Crisp, non-clipping stamps (*APPROVED*, *REJECTED*, *CONFIDENTIAL*, *Checkmarks*, *Crosses*, *Stars*).
    *   **Freehand Pen & Highlighter**: Smooth vector drawing with custom thickness, colors, and opacity.
    *   **Shapes & Lines**: Insert custom rectangles, circles/ovals, straight lines, and directional arrows.
    *   **Whiteout / Eraser**: Easily erase or blackout any sensitive area with one click or drag.
    *   **High-DPI Print Quality**: Renders baked exports at 4x resolution (380+ DPI print quality) for crystal-clear results.
    *   **Mobile & App Responsive**: Optimized for phones and Android WebViews with scrollable ribbons, auto-collapsing sidebar, and enlarged touch handles.
*   **Sign PDF (Digital Signatures)**: Multi-mode signing pad (Draw, Type, Upload) with draggable fields for names, dates, and initials.
*   **Redact PDF**: Permanently blackout and remove sensitive data from documents.
*   **Watermark PDF (Upgraded)**:
    *   **Live Interactive Preview**: See watermarks directly on your actual PDF page in real-time before applying.
    *   **Dynamic Positioning**: Adjust opacity, rotation, tile mosaics, and exact placement with 1:1 preview-to-download accuracy.
*   **Page Numbers**: Add custom page numbers with configurable alignment and formats.
*   **Metadata Editor (Universal Document Suite)**:
    *   **Universal Document Support**: Full inspection and editing for **PDF**, **Word (.docx)**, **Excel (.xlsx)**, and **PowerPoint (.pptx)** documents.
    *   **Description & SEO Fields**: Edit Title, Author, Description, Keywords/Tags, Company, Manager, and Timestamps (fully optional / can be left blank).
    *   **One-Click "Copy Metadata"**: Directly copy human-readable metadata key-values straight to your clipboard, plus quick Paste/Import functionality.
    *   **Privacy Anonymizer ("Wipe All Metadata")**: One-click wipe of personal identifying data, authors, company tags, and timestamps.
    *   **Copyright & Rights Management**: Define Copyright Notice, licensing status (Copyrighted, Public Domain, Creative Commons), and Terms URL.
    *   **Saved Presets**: Quick-switch between the `PDFPals` brand profile, Privacy Wipe, or your own custom saved profiles stored in `localStorage`.
    *   **Technical Document Inspector**: Live read-only technical specs including page/sheet/slide counts, file size, and document format.
    *   **Batch Multi-Document Editing**: Drop multiple mixed files at once, apply shared metadata, and download as a single ZIP archive.

### 🔄 Convert
*   **JPG to PDF (Upgraded)**:
    *   **Multi-Image Batch Conversion**: Convert single or multiple images into a single PDF.
    *   **Add More Images**: Seamlessly append additional photos or scans at any time before building the PDF.
    *   **Layout & Fit Controls**: Adjust page orientation (portrait/landscape), margins, and fit options.
*   **PDF to JPG (Upgraded)**:
    *   **High-Resolution Extraction**: Turn every PDF page into crisp JPG images.
    *   **Flexible Downloads**: Download individual pages instantly or export the entire document as a single ZIP archive.
*   **Image Formats Converter**:
    *   **Universal Offline Conversion**: Convert between JPG, PNG, WEBP, GIF, BMP, HEIC/HEIF, AVIF, TIFF, SVG, and ICO.
    *   **Student & Portal Friendly**: Converts modern iPhone HEIC/HEIF and Android AVIF images for university, bank, and government portals.
    *   **Batch & Icon Tools**: Convert batches into ZIP archives or generate multi-size Windows/browser ICO icons.
*   **Universal PDF Converter**: Convert between PDF and Word (.docx) or Excel (.xlsx).
*   **Asset Ripper**: Deep-scan and extract every original high-resolution embedded image asset from a PDF.
*   **Web to Canvas**: Transform raw HTML/CSS into professional PDF layouts.

### 📂 Organize
*   **Merge PDF**: Combine multiple documents with precision.
*   **Split PDF**: Extract specific ranges or pages into new files.
*   **Organize PDF**: Visual drag-and-drop page reordering and multi-file assembly.
*   **Rotate Panorama**: Fix orientation issues across individual pages or your entire document.
*   **Crop PDF**: Trim margins or cut out areas with pixel-perfect accuracy.

### ⚡ Optimize & Security
*   **Neural Compress**: Advanced local compression engine for sharing large files.
*   **Protect PDF**: Add industry-standard password encryption.
*   **Unlock PDF**: Remove passwords from protected documents.

### 📷 Specialized
*   **CamScanner**: AI-powered document digitization with auto-edge detection, perspective warp, and high-contrast filters.

---

## 🎨 Theme & Accessibility
*   **Theme Switcher**: Instant switching between Light, Dark, Terminal, and Ubuntu themes.
*   **Persistent Theme Memory**: Synchronizes across page reloads and tool navigations.
*   **Mobile & Tablet First**: Full responsive touch layout optimized for touchscreens, mobile browsers, and Android apps (Capacitor/WebView).

---

## 🚀 Getting Started

To run PDFPals locally, you will need [Node.js](https://nodejs.org/) installed on your system.

### 📦 Quick Setup
1. **Clone the repository:**
   ```bash
   git clone https://github.com/N3k0sint/PDFPals.git
   cd PDFPals
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```

### 🌐 Local Web Server
1.  **Start the server**: `npm start` (or `node server.js`)
2.  **Access**: Navigate to `http://localhost:3000` in any modern browser.

### 🖥️ Desktop App
1.  **Launch**: Run `npm run electron:start` to open the standalone desktop environment.
2.  **Build**: Run `npm run build:win` to generate a portable `.exe` for distribution.

---

## 🔒 Privacy & Security
PDFPals is built on the principle of **Zero-Server Processing**. Every operation is performed locally on your device using `pdf-lib` and `pdfjs`, ensuring that your files never touch any external server.

---
© 2026 PDFPals | Professional. Local. Secure.
