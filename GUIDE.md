# PDFPals - Ultimate Local User Guide

This guide explains how to use the **PDFPals** suite effectively. All processing is 100% local, private, and secure—no files ever leave your device.

---

## 🚀 Getting Started

1. **Start the Server**:
   ```bash
   npm start
   # or
   node server.js
   ```
2. **Access the Dashboard**:
   Open `http://localhost:3000` in your web browser.
3. **Choose Your Theme**:
   Use the sun/moon or theme toggle in the header to switch between **Light**, **Dark**, **Terminal**, and **Ubuntu** themes.
4. **Desktop Environment**:
   Run `npm run electron:start` to use the standalone desktop application, or `npm run build:win` to generate a portable Windows `.exe`.

---

## 🛠️ Tool Master Class

### ✍️ Edit PDF (Flagship Editor)
- **In-Place Text Editing**: Click directly on existing text on certificates or documents to edit words, names, or dates.
- **Auto Background & Ink Detection**: The intelligent pixel-histogram engine detects background badge/ribbon colors and matching ink tones automatically.
- **Dual Eyedropper Tools**: Sample any text or background color with the built-in 💧 eyedropper directly on the page.
- **Luxury Fonts & Stamps**: Access certificate serif/script fonts (*Cinzel*, *Great Vibes*, *Montserrat*) and crisp vector stamps (*APPROVED*, *CONFIDENTIAL*, checkmarks).
- **High-DPI Vector Export**: Renders exports at 4x resolution (380+ DPI print quality) for crystal-clear physical printing.

---

### 🔏 Sign PDF (Digital Signatures & Flattening)
- **Multi-Mode Signing**:
  - **Draw**: Natural vector ink with pen thickness and color options.
  - **Type**: Elegant cursive and signature typography.
  - **Upload**: Upload transparent PNG or JPG signature scans.
- **Interactive Resizing & Placement**: Smoothly drag, position, and resize your signature stamp anywhere on the canvas.
- **Draggable Field Tags**: Place standard **Name**, **Date**, and **Initials** tags directly onto forms.
- **🔒 Flatten Document (Burn in Signature)**:
  - *What does this do?* In standard PDFs, signatures and annotations exist as floating overlay layers that any third-party PDF reader or editor can select, move, delete, or separate.
  - *When Flatten is ON*: PDFPals renders and burns your signature directly into the static vector page content stream. Once flattened, the signature becomes an irreversible, permanent part of the page background, preventing unauthorized extraction, repositioning, or tampering.

---

### 💧 Watermark PDF & 🚫 Remove Watermark
- **Watermark PDF**:
  - **Live Real-Time Preview**: Preview watermark angle, opacity, font size, and mosaic tiling directly over your document before building.
  - **Flatten Watermark (Embed Permanently)**: Bakes the watermark directly into the underlying page graphics so third parties cannot strip it away with standard PDF editors.
- **Remove Watermark**:
  - **Dual Removal Engines**:
    1. *Text Pattern Purge*: Erases common watermark strings (e.g., "CONFIDENTIAL", "DRAFT", "SAMPLE", website URLs) across all pages.
    2. *Bounding Box Removal*: Interactively select an area containing a watermark, logo, or stamp to cleanly wipe it from the page stream.
  - **Live Side-by-Side Verification**: Review the cleaned document before downloading.

---

### ⚡ Compress PDF (Local Compression Engine)
- **Pre-Flight Result Size Previews**:
  - The compression engine calculates and displays the expected output file size for all 3 compression modes (**Basic**, **Strong**, and **Extreme**) directly on the screen *before* you even start compression.
- **Compression Profiles**:
  - **Basic (Recommended)**: Lossless stream deflating and metadata optimization. Ideal for official submissions where print quality must remain 100%.
  - **Strong**: High-efficiency vector downsampling and clean image compression. Ideal for email attachments.
  - **Extreme**: Maximum reduction for stringent portal upload limits (e.g., government, university, or scholarship portals requiring < 1 MB).

---

### 📑 Organize PDF
- **Drag-and-Drop Reordering**: Rearrange pages with fluid drag-and-drop mechanics and automatic viewport scrolling.
- **Add Blank Page (`📄 Add Blank Page`)**: Insert blank pages at any position (beginning, middle, or end). PDFPals automatically matches the exact page dimensions (width, height, orientation) of your source document.
- **High-Visibility Delete (`✕`)**: 32px circular crimson delete buttons make removing single pages fast and accurate.
- **Unlimited Document Merging**: Add multiple PDFs using the `➕ More Docs` button without artificial page restrictions.

---

### 📝 Organize Word (.docx)
- **Visual Section & Page Cards**: Extracts real section headings, text snippets, and embedded images from `word/media/` to display clear, visual previews of your document.
- **Native Word (.docx) Export**: Merges and organizes into a clean `.docx` file using deep OpenXML relationship management. Embedded images are assigned unique relationship IDs to ensure **zero missing pictures or image clashes**.
- **Add Blank Page**: Easily insert clean section breaks and blank pages.
- **Optional PDF Export**: Export directly as a clean PDF if you need an immediate printable copy.

---

### 📊 Organize PowerPoint (.pptx)
- **16:9 Widescreen Preservation**: Preserves original canvas dimensions (`<p:sldSz type="screen16x9"/>`) and landscape aspect ratios without squishing slides to 4:3.
- **Zero Repair Warnings**: Non-destructive OpenXML engine maintains relationship integrity, isolates media files, and assigns non-colliding slide IDs (`p:sldId`), completely eliminating Microsoft PowerPoint's "Repair Presentation" prompts.
- **Multi-Deck Slide Sorter**: Merge multiple presentations, duplicate slides, reorder sequence, or delete unwanted slides visually.

---

### 🏷️ Metadata Editor (Universal Office & PDF Suite)
- **Universal Format Support**: Inspect and edit metadata for **PDF**, **Word (.docx)**, **Excel (.xlsx)**, and **PowerPoint (.pptx)** files.
- **SEO & Field Management**: Edit Title, Author, Subject, Keywords, Company, Manager, and Timestamps.
- **Privacy Anonymizer ("Wipe All Metadata")**: Erase all author names, software signatures, corporate tags, and edit histories with one click.
- **Copyright & License Controls**: Embed standard Copyright notices, Creative Commons licenses, or Public Domain declarations.
- **Batch Processing**: Drop multiple files at once, apply unified metadata, and export as a single ZIP archive.

---

### 🖼️ Universal Image Converter & Asset Ripper
- **Universal Image Converter**: Convert between JPG, PNG, WEBP, GIF, BMP, HEIC/HEIF, AVIF, TIFF, SVG, ICO, and PDF entirely offline. Perfect for student and government portals requiring specific formats.
- **Asset Ripper**: Scans PDF documents and extracts all raw embedded images at their original resolutions into a `.zip` file.
- **JPG to PDF & PDF to JPG**: Batch conversion with orientation adjustments, margin controls, and high-DPI rendering.

---

### 📸 CamScanner (AI-Powered Document Digitization)
- **Edge Detection**: Real-time perspective warp and auto-cropping of photographed documents.
- **Magic B&W Filter**: Enhances text contrast and strips shadows and background noise for photocopy-quality scans.

---

## 🔒 Privacy & Security Architecture

1. **Zero-Server Processing**: All document parsing, rendering, and compiling occurs within your browser memory (WebAssembly + JavaScript). Your files never touch an external server.
2. **Offline Capable**: After loading the application, you can disconnect your Internet connection entirely; all tools will continue to function normally.
3. **AES Military-Grade Encryption**: The **Protect PDF** tool applies standard AES-128 / AES-256 encryption directly on your device.

---

© 2026 PDFPals | Professional. Local. Secure.
