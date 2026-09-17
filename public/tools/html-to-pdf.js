document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const htmlInput = document.getElementById('html-input');
    const previewFrame = document.getElementById('preview-frame');
    const sheetWrapper = document.getElementById('sheet-wrapper');
    const renderArea = document.getElementById('render-area');
    const btnOpenFile = document.getElementById('btn-open-file');
    const htmlFileInput = document.getElementById('html-file-input');
    const btnCopyCode = document.getElementById('btn-copy-code');
    const btnClearCode = document.getElementById('btn-clear-code');
    const btnRefreshPreview = document.getElementById('btn-refresh-preview');
    const previewZoom = document.getElementById('preview-zoom');
    const editorContainer = document.getElementById('editor-container');
    const workspaceGrid = document.getElementById('workspace-grid');

    // Tab buttons
    const tabSplit = document.getElementById('tab-split');
    const tabCode = document.getElementById('tab-code');
    const tabPreview = document.getElementById('tab-preview');

    // Config Elements
    const pageSizeSelect = document.getElementById('page-size');
    const orientationSelect = document.getElementById('orientation');
    const marginSelect = document.getElementById('margin');
    const pageNumbersSelect = document.getElementById('page-numbers');
    const scaleQualitySelect = document.getElementById('scale-quality');

    // Export Buttons
    const convertBtn = document.getElementById('convert-html');
    const exportLabel = document.getElementById('export-label');
    const btnVectorPrint = document.getElementById('btn-vector-print');

    // Starter HTML Document
    const starterHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
    }
    body {
        font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
        color: #1e293b;
        background: #ffffff;
        padding: 40px;
        line-height: 1.6;
    }
    .header {
        border-bottom: 2px solid #2563eb;
        padding-bottom: 14px;
        margin-bottom: 20px;
    }
    h1 {
        color: #2563eb;
        font-size: 26px;
        font-weight: 800;
        letter-spacing: -0.5px;
    }
    .subtitle {
        color: #64748b;
        font-size: 14px;
        margin-top: 4px;
    }
    .content-card {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 10px;
        padding: 20px;
        margin: 20px 0;
    }
    h2 {
        font-size: 16px;
        color: #0f172a;
        margin-bottom: 8px;
    }
    p {
        color: #475569;
        font-size: 13.5px;
        margin-bottom: 10px;
    }
    ul {
        padding-left: 20px;
        color: #475569;
        font-size: 13.5px;
    }
    li {
        margin-bottom: 6px;
    }
</style>
</head>
<body>
    <div class="header">
        <h1>Document Title</h1>
        <p class="subtitle">Generated locally with PDFPals Web to Canvas</p>
    </div>

    <div class="content-card">
        <h2>Getting Started</h2>
        <p>Write or paste your custom HTML and CSS directly into the editor on the left. Changes appear in real time on this document sheet.</p>
        <ul>
            <li>Drag and drop any existing <strong>.html</strong> file into the editor to load it.</li>
            <li>Use <strong>Download Multi-Page PDF</strong> for automatic page slicing without squishing.</li>
            <li>Use <strong>Vector Print to PDF</strong> for 100% crisp, searchable, selectable text.</li>
        </ul>
    </div>
</body>
</html>`;

    // Initialize Default Document
    htmlInput.value = starterHtml;

    // View Switching
    function setViewMode(mode) {
        tabSplit.classList.toggle('active', mode === 'split');
        tabCode.classList.toggle('active', mode === 'code');
        tabPreview.classList.toggle('active', mode === 'preview');

        workspaceGrid.classList.remove('code-only', 'preview-only');
        if (mode === 'code') workspaceGrid.classList.add('code-only');
        if (mode === 'preview') workspaceGrid.classList.add('preview-only');
    }

    tabSplit.onclick = () => setViewMode('split');
    tabCode.onclick = () => setViewMode('code');
    tabPreview.onclick = () => setViewMode('preview');

    // Tab key handling in textarea
    htmlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = htmlInput.selectionStart;
            const end = htmlInput.selectionEnd;
            htmlInput.value = htmlInput.value.substring(0, start) + '  ' + htmlInput.value.substring(end);
            htmlInput.selectionStart = htmlInput.selectionEnd = start + 2;
            updateLivePreview();
        }
    });

    // File Drag & Drop on Editor
    editorContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        editorContainer.classList.add('drag-over');
    });
    editorContainer.addEventListener('dragleave', () => {
        editorContainer.classList.remove('drag-over');
    });
    editorContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        editorContainer.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files.length) {
            loadFile(e.dataTransfer.files[0]);
        }
    });

    // Open File Button
    btnOpenFile.onclick = () => htmlFileInput.click();
    htmlFileInput.onchange = (e) => {
        if (e.target.files.length) {
            loadFile(e.target.files[0]);
        }
    };

    function loadFile(file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            htmlInput.value = ev.target.result;
            updateLivePreview();
        };
        reader.readAsText(file);
    }

    // Code Actions
    btnCopyCode.onclick = () => {
        navigator.clipboard.writeText(htmlInput.value).then(() => {
            const originalText = btnCopyCode.textContent;
            btnCopyCode.textContent = '✅ Copied!';
            setTimeout(() => { btnCopyCode.textContent = originalText; }, 1500);
        });
    };

    btnClearCode.onclick = () => {
        if (confirm('Clear all code in editor?')) {
            htmlInput.value = '';
            updateLivePreview();
        }
    };

    btnRefreshPreview.onclick = () => updateLivePreview();

    // Sheet Dimensions and Zoom Styling
    function updateSheetGeometry() {
        const size = pageSizeSelect.value;
        const isLandscape = orientationSelect.value === 'landscape';
        const zoom = parseFloat(previewZoom.value) || 0.85;

        // Standard CSS points/pixels mapping (approx 794 × 1123 for A4 at 96dpi)
        let baseW = 794;
        let baseH = 1123;

        if (size === 'letter') {
            baseW = 816;
            baseH = 1056;
        } else if (size === 'legal') {
            baseW = 816;
            baseH = 1344;
        }

        const finalW = isLandscape ? baseH : baseW;
        const finalH = isLandscape ? baseW : baseH;

        sheetWrapper.style.width = `${finalW}px`;
        sheetWrapper.style.minHeight = `${finalH}px`;
        sheetWrapper.style.transform = `scale(${zoom})`;
    }

    pageSizeSelect.onchange = () => { updateSheetGeometry(); updateLivePreview(); };
    orientationSelect.onchange = () => { updateSheetGeometry(); updateLivePreview(); };
    marginSelect.onchange = () => updateLivePreview();
    previewZoom.onchange = () => updateSheetGeometry();

    // Debounced Live Preview
    let previewDebounceTimer = null;
    htmlInput.addEventListener('input', () => {
        clearTimeout(previewDebounceTimer);
        previewDebounceTimer = setTimeout(updateLivePreview, 250);
    });

    function updateLivePreview() {
        const rawHtml = htmlInput.value.trim();
        const marginPx = marginSelect.value;

        // Build injected preview with correct print simulation
        const docHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    html, body {
                        margin: 0;
                        padding: 0;
                        background: #ffffff;
                    }
                    .document-wrapper {
                        box-sizing: border-box;
                        padding: ${marginPx}px;
                    }
                </style>
            </head>
            <body>
                <div class="document-wrapper">
                    ${rawHtml}
                </div>
            </body>
            </html>
        `;

        previewFrame.srcdoc = docHtml;
    }

    // Initial Preview Render
    updateSheetGeometry();
    updateLivePreview();

    // ==========================================
    // EXPORT ENGINE 1: Multi-Page Canvas Slicing
    // ==========================================
    convertBtn.onclick = async () => {
        const html = htmlInput.value.trim();
        if (!html) return alert('Please enter or load some HTML code to export.');

        convertBtn.disabled = true;
        exportLabel.textContent = 'Rendering Canvas...';

        try {
            // Setup hidden rendering container with strict dimensions
            const size = pageSizeSelect.value;
            const isLandscape = orientationSelect.value === 'landscape';
            const marginPx = parseInt(marginSelect.value, 10) || 0;
            const scaleFactor = parseInt(scaleQualitySelect.value, 10) || 2;

            let baseW = 794;
            let baseH = 1123;
            if (size === 'letter') { baseW = 816; baseH = 1056; }
            if (size === 'legal') { baseW = 816; baseH = 1344; }

            const targetW = isLandscape ? baseH : baseW;
            const targetH = isLandscape ? baseW : baseH;

            renderArea.style.width = `${targetW}px`;
            renderArea.style.padding = `${marginPx}px`;
            renderArea.style.boxSizing = 'border-box';
            renderArea.style.background = '#ffffff';
            renderArea.innerHTML = html;

            // Wait brief moment for layout/fonts to settle
            await new Promise((r) => setTimeout(r, 350));

            exportLabel.textContent = 'Capturing High-DPI Content...';

            const canvas = await window.html2canvas(renderArea, {
                useCORS: true,
                scale: scaleFactor,
                backgroundColor: '#ffffff',
                logging: false,
                windowWidth: targetW
            });

            exportLabel.textContent = 'Paginating PDF Document...';

            const { PDFDocument, PageSizes, rgb, StandardFonts } = window.PDFLib;
            const pdfDoc = await PDFDocument.create();
            const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

            const selectedKey = size.toUpperCase();
            const basePageDims = PageSizes[selectedKey] || PageSizes.A4;
            const pageDims = isLandscape ? [basePageDims[1], basePageDims[0]] : basePageDims;
            const [pdfPageW, pdfPageH] = pageDims;

            // PDF margins in points (approx 1px ~ 0.75pt)
            const ptMargin = marginPx * 0.75;
            const printableW = pdfPageW - (ptMargin * 2);
            const printableH = pdfPageH - (ptMargin * 2);

            // Compute vertical slice height in canvas pixels based on printable aspect ratio
            const sliceRatio = printableH / printableW;
            const sliceHeightPx = Math.floor(canvas.width * sliceRatio);

            const totalCanvasH = canvas.height;
            const totalPages = Math.max(1, Math.ceil(totalCanvasH / sliceHeightPx));
            const pageNumberMode = pageNumbersSelect.value;

            for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
                exportLabel.textContent = `Generating Page ${pageIdx + 1} of ${totalPages}...`;

                const startY = pageIdx * sliceHeightPx;
                const remainingH = totalCanvasH - startY;
                const currentSliceH = Math.min(sliceHeightPx, remainingH);

                // Create offscreen canvas for this slice
                const sliceCanvas = document.createElement('canvas');
                sliceCanvas.width = canvas.width;
                sliceCanvas.height = sliceHeightPx;
                const ctx = sliceCanvas.getContext('2d');

                // Fill background white
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);

                // Draw slice
                ctx.drawImage(
                    canvas,
                    0, startY, canvas.width, currentSliceH,
                    0, 0, canvas.width, currentSliceH
                );

                const slicePngUrl = sliceCanvas.toDataURL('image/png');
                const sliceImage = await pdfDoc.embedPng(slicePngUrl);

                const page = pdfDoc.addPage(pageDims);

                // Draw embedded image fitting printable area
                page.drawImage(sliceImage, {
                    x: ptMargin,
                    y: ptMargin,
                    width: printableW,
                    height: printableH
                });

                // Stamp page numbering if configured
                if (pageNumberMode !== 'none') {
                    const pageText = `Page ${pageIdx + 1} of ${totalPages}`;
                    const fontSize = 9;
                    const textWidth = helveticaFont.widthOfTextAtSize(pageText, fontSize);
                    const textX = pageNumberMode === 'bottom-center'
                        ? (pdfPageW - textWidth) / 2
                        : (pdfPageW - ptMargin - textWidth);
                    const textY = Math.max(12, ptMargin / 2);

                    page.drawText(pageText, {
                        x: textX,
                        y: textY,
                        size: fontSize,
                        font: helveticaFont,
                        color: rgb(0.4, 0.4, 0.4)
                    });
                }
            }

            pdfDoc.setProducer('PDFPals Suite');
            pdfDoc.setCreator('PDFPals Web to Canvas Engine');

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const filename = `document_${new Date().toISOString().slice(0,10)}.pdf`;

            // Save using MobileBridge (or fallback)
            if (window.MobileBridge && typeof window.MobileBridge.saveFile === 'function') {
                await window.MobileBridge.saveFile(blob, filename, 'application/pdf');
            } else {
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                setTimeout(() => {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(link.href);
                }, 1000);
            }

        } catch (err) {
            console.error('Canvas export error:', err);
            alert('Failed to generate PDF: ' + (err.message || err));
        } finally {
            convertBtn.disabled = false;
            exportLabel.textContent = 'Download Multi-Page PDF';
            renderArea.innerHTML = '';
        }
    };

    // ==========================================
    // EXPORT ENGINE 2: Vector Print-to-PDF
    // ==========================================
    btnVectorPrint.onclick = () => {
        const rawHtml = htmlInput.value.trim();
        if (!rawHtml) return alert('Please enter or load some HTML code to print.');

        const size = pageSizeSelect.value;
        const orientation = orientationSelect.value;
        const marginPx = marginSelect.value;

        // Hidden iframe for printing
        let printFrame = document.getElementById('print-stream-frame');
        if (printFrame) printFrame.remove();

        printFrame = document.createElement('iframe');
        printFrame.id = 'print-stream-frame';
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);

        const printDoc = printFrame.contentWindow.document;
        printDoc.open();
        printDoc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <style>
                    @page {
                        size: ${size} ${orientation};
                        margin: ${marginPx}px;
                    }
                    @media print {
                        html, body {
                            margin: 0;
                            padding: 0;
                            -webkit-print-color-adjust: exact !important;
                            print-color-adjust: exact !important;
                        }
                    }
                </style>
            </head>
            <body>
                ${rawHtml}
            </body>
            </html>
        `);
        printDoc.close();

        // Trigger native print once iframe resources are ready
        setTimeout(() => {
            printFrame.contentWindow.focus();
            printFrame.contentWindow.print();
        }, 300);
    };
});