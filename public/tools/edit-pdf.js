import * as pdfjsLib from '../vendor/pdfjs-dist/build/pdf.mjs';

// Configure PDF.js worker
const workerSrc = new URL('../vendor/pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.querySelector('.browse-btn');
    const editorRoot = document.getElementById('editor-workspace-root');
    const documentViewport = document.getElementById('document-viewport');
    const thumbnailsSidebar = document.getElementById('thumbnails-sidebar');

    // Tool Buttons
    const toolSelectBtn = document.getElementById('tool-select');
    const toolEditTextBtn = document.getElementById('tool-edit-text');
    const toolTextBtn = document.getElementById('tool-text');
    const toolWhiteoutBtn = document.getElementById('tool-whiteout');
    const toolImageBtn = document.getElementById('tool-image');
    const imageFileInput = document.getElementById('image-file-input');
    const toolPenBtn = document.getElementById('tool-pen');
    const toolHighlighterBtn = document.getElementById('tool-highlighter');
    const toolShapesBtn = document.getElementById('tool-shapes-btn');
    const shapesMenu = document.getElementById('shapes-menu');
    const toolSymbolsBtn = document.getElementById('tool-symbols-btn');
    const symbolsMenu = document.getElementById('symbols-menu');
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');

    // Zoom & View
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomFit = document.getElementById('btn-zoom-fit');
    const zoomLevelDisplay = document.getElementById('zoom-level');
    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    const btnSwitchPdf = document.getElementById('btn-switch-pdf');
    const btnSavePdf = document.getElementById('btn-save-pdf');

    // Context Bar Elements
    const ctxTextGroup = document.getElementById('ctx-text-group');
    const ctxDrawGroup = document.getElementById('ctx-draw-group');
    const ctxShapeGroup = document.getElementById('ctx-shape-group');
    const ctxSelectionGroup = document.getElementById('ctx-selection-group');
    const ctxTipText = document.getElementById('ctx-tip-text');

    // Text Context Controls
    const ctxFontFamily = document.getElementById('ctx-font-family');
    const ctxFontSize = document.getElementById('ctx-font-size');
    const ctxFontSizeDec = document.getElementById('ctx-font-size-dec');
    const ctxFontSizeInc = document.getElementById('ctx-font-size-inc');
    const ctxBold = document.getElementById('ctx-bold');
    const ctxItalic = document.getElementById('ctx-italic');
    const ctxAlignLeft = document.getElementById('ctx-align-left');
    const ctxAlignCenter = document.getElementById('ctx-align-center');
    const ctxAlignRight = document.getElementById('ctx-align-right');
    const ctxTextColor = document.getElementById('ctx-text-color');
    const ctxColorLabel = document.getElementById('ctx-color-label');
    const ctxEyedropperBtn = document.getElementById('ctx-eyedropper-btn');
    const ctxBgColor = document.getElementById('ctx-bg-color');
    const ctxBgColorLabel = document.getElementById('ctx-bg-color-label');
    const ctxBgEyedropperBtn = document.getElementById('ctx-bg-eyedropper-btn');
    const ctxBgTransparent = document.getElementById('ctx-bg-transparent');

    // Draw Context Controls
    const ctxStrokeColor = document.getElementById('ctx-stroke-color');
    const ctxStrokeColorLabel = document.getElementById('ctx-stroke-color-label');
    const ctxStrokeWidth = document.getElementById('ctx-stroke-width');
    const ctxStrokeWidthVal = document.getElementById('ctx-stroke-width-val');

    // Shape Context Controls
    const ctxShapeBorder = document.getElementById('ctx-shape-border');
    const ctxShapeBorderLabel = document.getElementById('ctx-shape-border-label');
    const ctxShapeFill = document.getElementById('ctx-shape-fill');
    const ctxShapeFillLabel = document.getElementById('ctx-shape-fill-label');
    const ctxShapeNofill = document.getElementById('ctx-shape-nofill');
    const ctxShapeStrokeWidth = document.getElementById('ctx-shape-stroke-width');

    // Selection Action Buttons
    const ctxBtnDuplicate = document.getElementById('ctx-btn-duplicate');
    const ctxBtnFront = document.getElementById('ctx-btn-front');
    const ctxBtnBack = document.getElementById('ctx-btn-back');
    const ctxBtnDelete = document.getElementById('ctx-btn-delete');

    // State Variables
    let currentPdfFile = null;
    let pdfBytes = null;
    let pdfJsDoc = null;
    let totalPages = 0;
    let currentZoom = 1.0;
    let activeTool = 'select'; // 'select', 'edit-text', 'text', 'whiteout', 'image', 'pen', 'highlighter', 'shape', 'symbol'
    let activeShapeType = 'rectangle';
    let activeSymbolType = 'approved';

    // Per-page state
    let pagesData = [];
    let selectedAnnotation = null;

    // History for Undo/Redo
    let historyStack = [];
    let redoStack = [];

    // Freehand drawing state
    let isDrawing = false;
    let currentDrawingStroke = null;

    // Initialize Dropzone
    if (browseBtn) browseBtn.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
        if (e.target.files.length) handlePdfFile(e.target.files[0]);
    };

    dropZone.ondragover = (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    };
    dropZone.ondragleave = () => dropZone.classList.remove('drag-over');
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) {
            handlePdfFile(e.dataTransfer.files[0]);
        }
    };

    // Load PDF
    async function handlePdfFile(file) {
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            alert('Please select a valid PDF document.');
            return;
        }

        currentPdfFile = file;
        const buffer = await file.arrayBuffer();
        pdfBytes = new Uint8Array(buffer);

        const toolHeader = document.getElementById('tool-header');
        const toolFooter = document.getElementById('tool-footer');
        const appContainer = document.querySelector('.app-container');

        const dropZoneMain = document.getElementById('drop-zone-main');
        if (dropZoneMain) dropZoneMain.classList.add('hidden');
        dropZone.classList.add('hidden');
        if (toolHeader) toolHeader.classList.add('hidden');
        if (toolFooter) toolFooter.classList.add('hidden');
        if (appContainer) appContainer.classList.add('editing-active');
        editorRoot.classList.remove('hidden');

        try {
            pdfJsDoc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;
            totalPages = pdfJsDoc.numPages;
            pagesData = [];
            historyStack = [];
            redoStack = [];
            updateUndoRedoUI();

            await renderAllPages();
            setTool('select');
        } catch (err) {
            console.error('Error loading PDF:', err);
            alert('Failed to load PDF: ' + (err.message || 'Corrupted file'));
        }
    }

    // Helper: sample pixel color from canvas
    function sampleCanvasColor(canvas, x, y) {
        try {
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            const px = Math.max(0, Math.min(canvas.width - 1, Math.round(x)));
            const py = Math.max(0, Math.min(canvas.height - 1, Math.round(y)));
            const p = ctx.getImageData(px, py, 1, 1).data;
            if (p[3] < 30) return '#ffffff';
            const toHex = (c) => c.toString(16).padStart(2, '0');
            return `#${toHex(p[0])}${toHex(p[1])}${toHex(p[2])}`;
        } catch (e) {
            return '#ffffff';
        }
    }

    // Helper: Comprehensive pixel analysis of the text line region to detect
    // BOTH the dominant background color (e.g. dark red banner, navy header, white paper)
    // AND the actual glyph ink color (e.g. white on red banner, gold on dark cert, black on white)
    function analyzeTextColors(canvas, left, top, width, height) {
        try {
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            const startX = Math.max(0, Math.min(canvas.width - 1, Math.round(left)));
            const startY = Math.max(0, Math.min(canvas.height - 1, Math.round(top)));
            const scanW = Math.max(1, Math.min(canvas.width - startX, Math.round(width)));
            const scanH = Math.max(1, Math.min(canvas.height - startY, Math.round(height)));

            const imgData = ctx.getImageData(startX, startY, scanW, scanH).data;
            const colorBuckets = new Map();
            const pixelCount = scanW * scanH;
            const step = Math.max(1, Math.floor(pixelCount / 700));

            for (let i = 0; i < imgData.length; i += step * 4) {
                const a = imgData[i + 3];
                if (a < 50) continue;
                const r = imgData[i];
                const g = imgData[i + 1];
                const b = imgData[i + 2];

                // Quantize to 16-level buckets to group similar background/shading pixels
                const qr = Math.round(r / 16) * 16;
                const qg = Math.round(g / 16) * 16;
                const qb = Math.round(b / 16) * 16;
                const key = `${qr},${qg},${qb}`;

                const bucket = colorBuckets.get(key);
                if (bucket) {
                    bucket.count++;
                    bucket.totalR += r;
                    bucket.totalG += g;
                    bucket.totalB += b;
                } else {
                    colorBuckets.set(key, { count: 1, totalR: r, totalG: g, totalB: b });
                }
            }

            const toHex = (c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0');

            if (colorBuckets.size === 0) {
                return { bgColor: '#ffffff', textColor: '#000000' };
            }

            // The background makes up the vast majority (70% - 90%) of pixels in a text bounding box
            const sorted = Array.from(colorBuckets.values()).sort((a, b) => b.count - a.count);
            const dominantBg = sorted[0];
            const bgR = dominantBg.totalR / dominantBg.count;
            const bgG = dominantBg.totalG / dominantBg.count;
            const bgB = dominantBg.totalB / dominantBg.count;
            const bgColor = `#${toHex(bgR)}${toHex(bgG)}${toHex(bgB)}`;

            // Background perceived brightness (0 to 1)
            const bgLum = (0.299 * bgR + 0.587 * bgG + 0.114 * bgB) / 255;

            // Find ink pixels that contrast strongly against this background
            const inkSamples = [];
            for (let i = 0; i < imgData.length; i += step * 4) {
                const a = imgData[i + 3];
                if (a < 50) continue;
                const r = imgData[i];
                const g = imgData[i + 1];
                const b = imgData[i + 2];

                const dist = Math.hypot((r - bgR) / 255, (g - bgG) / 255, (b - bgB) / 255);
                if (dist > 0.22) {
                    inkSamples.push({ r, g, b, dist });
                }
            }

            let textColor = bgLum > 0.5 ? '#000000' : '#ffffff';
            if (inkSamples.length > 0) {
                // Sort by contrast from the background
                inkSamples.sort((a, b) => b.dist - a.dist);
                // Average top 30% most distinct ink pixels (filters out antialiasing fringing)
                const topCount = Math.max(1, Math.floor(inkSamples.length * 0.3));
                let sumR = 0, sumG = 0, sumB = 0;
                for (let j = 0; j < topCount; j++) {
                    sumR += inkSamples[j].r;
                    sumG += inkSamples[j].g;
                    sumB += inkSamples[j].b;
                }
                textColor = `#${toHex(sumR / topCount)}${toHex(sumG / topCount)}${toHex(sumB / topCount)}`;
            }

            return { bgColor, textColor };
        } catch (e) {
            return { bgColor: '#ffffff', textColor: '#000000' };
        }
    }

    // Render All Document Pages & Thumbnails
    async function renderAllPages() {
        if (!pdfJsDoc) return;
        documentViewport.innerHTML = '';
        thumbnailsSidebar.innerHTML = '';

        // Auto-collapse sidebar on mobile screens
        if (window.innerWidth <= 768 && thumbnailsSidebar && !thumbnailsSidebar.classList.contains('collapsed')) {
            thumbnailsSidebar.classList.add('collapsed');
        }

        const isMobile = window.innerWidth <= 768;
        const availableWidth = Math.max(300, documentViewport.clientWidth - (isMobile ? 24 : 100));

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            const pageIndex = pageNum - 1;
            const page = await pdfJsDoc.getPage(pageNum);
            const unscaled = page.getViewport({ scale: 1.0 });

            // Fit initial zoom to available viewport width
            if (pageNum === 1 && currentZoom === 1.0) {
                currentZoom = Math.min(1.4, Math.max(0.4, (availableWidth / unscaled.width)));
            }

            const viewport = page.getViewport({ scale: currentZoom });

            const existingAnnotations = pagesData[pageIndex] ? pagesData[pageIndex].annotations : [];
            const existingDrawings = pagesData[pageIndex] ? pagesData[pageIndex].drawings : [];
            const cachedTextContent = pagesData[pageIndex] ? pagesData[pageIndex].cachedTextContent : null;

            // 1. Page Container
            const pageContainer = document.createElement('div');
            pageContainer.className = 'page-container';
            pageContainer.dataset.pageIndex = pageIndex;
            pageContainer.style.width = `${viewport.width}px`;
            pageContainer.style.height = `${viewport.height}px`;

            // Badge
            const badge = document.createElement('div');
            badge.className = 'page-badge';
            badge.textContent = `PAGE ${pageNum} OF ${totalPages}`;
            pageContainer.appendChild(badge);

            // 2. Base PDF Canvas
            const pdfCanvas = document.createElement('canvas');
            pdfCanvas.className = 'page-canvas';
            pdfCanvas.width = viewport.width;
            pdfCanvas.height = viewport.height;
            const pdfCtx = pdfCanvas.getContext('2d');
            pageContainer.appendChild(pdfCanvas);

            // 3. Interactive PDF Original Text Layer
            const textLayer = document.createElement('div');
            textLayer.className = 'pdf-text-layer';
            pageContainer.appendChild(textLayer);

            // 4. Freehand Draw Canvas
            const drawCanvas = document.createElement('canvas');
            drawCanvas.className = 'draw-canvas';
            drawCanvas.width = viewport.width;
            drawCanvas.height = viewport.height;
            const drawCtx = drawCanvas.getContext('2d');
            pageContainer.appendChild(drawCanvas);

            // 5. Interactive Annotation Overlay Layer
            const annoLayer = document.createElement('div');
            annoLayer.className = 'annotation-layer select-mode';
            pageContainer.appendChild(annoLayer);

            documentViewport.appendChild(pageContainer);

            // Store page metadata
            pagesData[pageIndex] = {
                pageNumber: pageNum,
                unscaledViewport: unscaled,
                viewport: viewport,
                pageContainer: pageContainer,
                pdfCanvas: pdfCanvas,
                textLayer: textLayer,
                drawCanvas: drawCanvas,
                drawCtx: drawCtx,
                annoLayer: annoLayer,
                annotations: existingAnnotations,
                drawings: existingDrawings,
                cachedTextContent: cachedTextContent
            };

            // Render PDF canvas content asynchronously
            page.render({
                canvasContext: pdfCtx,
                viewport: viewport
            }).promise.then(() => {
                renderThumbnail(pageIndex, pdfCanvas);
                // Populate clickable text layer once canvas is ready for color sampling
                loadPageTextLayer(page, pageIndex, viewport, textLayer, pdfCanvas);
            });

            // Re-render drawings on canvas
            redrawPageDrawings(pageIndex);

            // Re-render placed annotations
            rebuildPageAnnotationDOM(pageIndex);

            // Bind interactions on this page
            bindPageEvents(pageIndex);
        }

        zoomLevelDisplay.textContent = `${Math.round(currentZoom * 100)}%`;
        updateLayerPointerEvents();
    }

    // Helper: Group individual PDF.js text items into coherent lines with complete vertical coverage
    function groupTextItemsIntoLines(items, styles, viewport) {
        if (!items || !items.length) return [];

        const validItems = items.filter(i => i.str && i.str.trim());
        if (!validItems.length) return [];

        const mapped = validItems.map(item => {
            const fontHeight = Math.max(1, Math.hypot(item.transform[2], item.transform[3]) || item.height || Math.hypot(item.transform[0], item.transform[1]) || 12);
            const x = item.transform[4];
            const y = item.transform[5];
            const w = item.width || (fontHeight * item.str.length * 0.55);

            const fontStyle = (styles && styles[item.fontName]) ? styles[item.fontName] : null;
            const ascentRatio = (fontStyle && fontStyle.ascent) ? Math.max(0.85, fontStyle.ascent) : 1.05;
            const descentRatio = (fontStyle && fontStyle.descent) ? Math.abs(fontStyle.descent) : 0.30;

            // Bounds in PDF space with clean coverage
            const pdfLeft = x - 2;
            const pdfRight = x + w + 2;
            const pdfBottom = y - (fontHeight * descentRatio) - 2;
            const pdfTop = y + (fontHeight * ascentRatio) + 2;

            const r = viewport.convertToViewportRectangle([pdfLeft, pdfBottom, pdfRight, pdfTop]);
            const left = Math.min(r[0], r[2]);
            const top = Math.min(r[1], r[3]);
            const width = Math.max(Math.abs(r[2] - r[0]), 8);
            const height = Math.max(Math.abs(r[3] - r[1]), 12);

            return {
                raw: item,
                str: item.str,
                fontName: item.fontName || '',
                fontHeight: fontHeight,
                pdfX: x,
                pdfY: y,
                pdfW: w,
                pdfBottom: pdfBottom,
                pdfTop: pdfTop,
                left,
                top,
                width,
                height,
                right: left + width,
                bottom: top + height
            };
        });

        // Sort by top, then left
        mapped.sort((a, b) => {
            if (Math.abs(a.top - b.top) > 5) return a.top - b.top;
            return a.left - b.left;
        });

        const lines = [];
        let currentLine = null;

        for (const item of mapped) {
            if (!currentLine) {
                currentLine = {
                    str: item.str,
                    fontName: item.fontName,
                    fontHeight: item.fontHeight,
                    pdfX: item.pdfX,
                    pdfY: item.pdfY,
                    pdfW: item.pdfW,
                    pdfBottom: item.pdfBottom,
                    pdfTop: item.pdfTop,
                    left: item.left,
                    top: item.top,
                    right: item.right,
                    bottom: item.bottom,
                    items: [item]
                };
                continue;
            }

            // Baseline proximity check
            const vertClose = Math.abs(item.top - currentLine.top) <= Math.max(item.height, currentLine.bottom - currentLine.top) * 0.45;
            const horizGap = item.left - currentLine.right;
            const maxGap = Math.max(item.fontHeight * 1.6, 28);

            if (vertClose && horizGap >= -8 && horizGap <= maxGap) {
                const addSpace = horizGap > 1 && !currentLine.str.endsWith(' ') && !item.str.startsWith(' ');
                currentLine.str += (addSpace ? ' ' : '') + item.str;
                currentLine.right = Math.max(currentLine.right, item.right);
                currentLine.top = Math.min(currentLine.top, item.top);
                currentLine.bottom = Math.max(currentLine.bottom, item.bottom);
                currentLine.fontHeight = Math.max(currentLine.fontHeight, item.fontHeight);
                currentLine.pdfW = (item.pdfX + item.pdfW) - currentLine.pdfX;
                currentLine.pdfBottom = Math.min(currentLine.pdfBottom, item.pdfBottom);
                currentLine.pdfTop = Math.max(currentLine.pdfTop, item.pdfTop);
                currentLine.items.push(item);
            } else {
                lines.push(currentLine);
                currentLine = {
                    str: item.str,
                    fontName: item.fontName,
                    fontHeight: item.fontHeight,
                    pdfX: item.pdfX,
                    pdfY: item.pdfY,
                    pdfW: item.pdfW,
                    pdfBottom: item.pdfBottom,
                    pdfTop: item.pdfTop,
                    left: item.left,
                    top: item.top,
                    right: item.right,
                    bottom: item.bottom,
                    items: [item]
                };
            }
        }
        if (currentLine) lines.push(currentLine);

        return lines.map(line => {
            const h = line.bottom - line.top;
            const totalPdfH = line.pdfTop - line.pdfBottom;
            const baselineRatio = totalPdfH > 0 ? (line.pdfY - line.pdfBottom) / totalPdfH : 0.28;

            return {
                str: line.str.trim(),
                fontName: line.fontName,
                fontHeight: line.fontHeight,
                left: line.left,
                top: line.top,
                width: line.right - line.left,
                height: h,
                pdfX: line.pdfX,
                pdfY: line.pdfY,
                pdfW: line.pdfW,
                pdfBaselineRatio: Math.max(0.18, Math.min(0.42, baselineRatio))
            };
        });
    }

    // Populate Click-to-Edit Original Text Spans
    async function loadPageTextLayer(page, pageIndex, viewport, textLayer, pdfCanvas) {
        try {
            let textContent = pagesData[pageIndex]?.cachedTextContent;
            if (!textContent) {
                textContent = await page.getTextContent();
                if (pagesData[pageIndex]) pagesData[pageIndex].cachedTextContent = textContent;
            }

            textLayer.innerHTML = '';
            if (!textContent || !textContent.items) return;

            const mergedLines = groupTextItemsIntoLines(textContent.items, textContent.styles, viewport);

            for (const line of mergedLines) {
                if (!line.str) continue;

                // Detect styling from font name & styles
                const fn = (line.fontName || '').toLowerCase();
                const fontStyleObj = textContent.styles ? textContent.styles[line.fontName] : null;
                const styleFam = fontStyleObj ? (fontStyleObj.fontFamily || '').toLowerCase() : '';

                // Bold detection: check font name, style, or large recipient name size
                const isBold = /bold|black|heavy|medium|semibold|b[0-9]|700|800|900/i.test(fn) ||
                               /bold|black|heavy|medium|semibold|700|800|900/i.test(styleFam) ||
                               line.fontHeight >= 22;

                // Italic detection
                const isItalic = /italic|oblique/i.test(fn) || /italic|oblique/i.test(styleFam);

                // Detect Font Family
                let fontFamily = 'Montserrat';
                if (/cinzel|trajan/i.test(fn) || /cinzel|trajan/i.test(styleFam)) {
                    fontFamily = 'Cinzel';
                } else if (/playfair/i.test(fn) || /playfair/i.test(styleFam)) {
                    fontFamily = 'Playfair Display';
                } else if (/great vibes|vibes|script|brush|calligraph|hand/i.test(fn) || /great vibes|script/i.test(styleFam)) {
                    fontFamily = 'Great Vibes';
                } else if (/georgia/i.test(fn) || /georgia/i.test(styleFam)) {
                    fontFamily = 'Georgia';
                } else if (/times|roman|serif|baskerville|garamond/i.test(fn) || /times|serif/i.test(styleFam)) {
                    fontFamily = 'Times';
                } else if (/courier|mono|console/i.test(fn)) {
                    fontFamily = 'Courier';
                } else if (/helvetica/i.test(fn)) {
                    fontFamily = 'Helvetica';
                } else if (/arial/i.test(fn)) {
                    fontFamily = 'Arial';
                }

                // Detect Horizontal Alignment
                const pageCenterX = viewport.width / 2;
                const lineCenterX = line.left + line.width / 2;
                const isCentered = Math.abs(lineCenterX - pageCenterX) < (viewport.width * 0.16);
                const textAlign = isCentered ? 'center' : 'left';

                // Original Font Size in Points
                const detectedFontSize = Math.max(1, Math.round(line.fontHeight));

                const span = document.createElement('div');
                span.className = 'pdf-text-span';
                span.style.left = `${line.left}px`;
                span.style.top = `${line.top}px`;
                span.style.width = `${line.width}px`;
                span.style.height = `${line.height}px`;
                span.title = `Click to edit text: "${line.str}"`;

                span.onclick = (e) => {
                    e.stopPropagation();
                    if (activeTool !== 'edit-text') return;

                    // Comprehensively analyze the exact text line region for dominant background and ink color
                    const { bgColor: sampledBg, textColor } = analyzeTextColors(pdfCanvas, line.left, line.top, line.width, line.height);

                    const newAnno = {
                        id: Date.now(),
                        pageIndex: pageIndex,
                        type: 'text',
                        content: line.str,
                        x: Math.round(line.left),
                        y: Math.round(line.top),
                        width: Math.max(Math.round(line.width) + 4, 80),
                        height: Math.max(Math.round(line.height), 16),
                        pdfBaselineRatio: line.pdfBaselineRatio || 0.28,
                        fontFamily: fontFamily,
                        fontSize: detectedFontSize,
                        bold: isBold,
                        italic: isItalic,
                        textAlign: textAlign,
                        color: textColor,
                        bgColor: sampledBg
                    };

                    addAnnotation(newAnno);
                    setTool('select');
                    selectAnnotation(newAnno);

                    // Focus contentEditable box with text selected for instant replacement
                    setTimeout(() => {
                        const domEl = document.getElementById(`anno-${newAnno.id}`);
                        if (domEl) {
                            const textContentEl = domEl.querySelector('.anno-text-content');
                            if (textContentEl) {
                                textContentEl.focus();
                                const range = document.createRange();
                                range.selectNodeContents(textContentEl);
                                const sel = window.getSelection();
                                sel.removeAllRanges();
                                sel.addRange(range);
                            }
                        }
                    }, 40);
                };

                textLayer.appendChild(span);
            }
        } catch (err) {
            console.warn('Text layer loading error for page', pageIndex + 1, err);
        }
    }

    // Render Page Thumbnail
    function renderThumbnail(pageIndex, sourceCanvas) {
        const thumbCard = document.createElement('div');
        thumbCard.className = `thumb-card ${pageIndex === 0 ? 'active' : ''}`;
        thumbCard.dataset.pageIndex = pageIndex;

        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.className = 'thumb-canvas';
        const thumbWidth = 160;
        const thumbHeight = (sourceCanvas.height / sourceCanvas.width) * thumbWidth;
        thumbCanvas.width = thumbWidth;
        thumbCanvas.height = thumbHeight;

        const tCtx = thumbCanvas.getContext('2d');
        tCtx.drawImage(sourceCanvas, 0, 0, thumbWidth, thumbHeight);

        const label = document.createElement('span');
        label.className = 'thumb-label';
        label.textContent = `Page ${pageIndex + 1}`;

        thumbCard.appendChild(thumbCanvas);
        thumbCard.appendChild(label);

        thumbCard.onclick = () => {
            document.querySelectorAll('.thumb-card').forEach(c => c.classList.remove('active'));
            thumbCard.classList.add('active');
            pagesData[pageIndex].pageContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        };

        thumbnailsSidebar.appendChild(thumbCard);
    }

    // Tool Management
    function setTool(toolName) {
        activeTool = toolName;

        const allToolBtns = [
            { name: 'select', btn: toolSelectBtn },
            { name: 'edit-text', btn: toolEditTextBtn },
            { name: 'text', btn: toolTextBtn },
            { name: 'whiteout', btn: toolWhiteoutBtn },
            { name: 'image', btn: toolImageBtn },
            { name: 'pen', btn: toolPenBtn },
            { name: 'highlighter', btn: toolHighlighterBtn },
            { name: 'shape', btn: toolShapesBtn },
            { name: 'symbol', btn: toolSymbolsBtn }
        ];

        allToolBtns.forEach(item => {
            if (item.btn) item.btn.classList.toggle('active', item.name === toolName);
        });

        shapesMenu.classList.remove('show');
        symbolsMenu.classList.remove('show');

        // Update Context Bar UI
        ctxTextGroup.classList.add('hidden');
        ctxDrawGroup.classList.add('hidden');
        ctxShapeGroup.classList.add('hidden');

        if (toolName === 'text' || toolName === 'edit-text') {
            ctxTextGroup.classList.remove('hidden');
            if (ctxTipText) {
                ctxTipText.innerHTML = toolName === 'edit-text'
                    ? '💡 <b>Edit Mode:</b> Click any existing name or words to edit them in-place with certificate formatting.'
                    : '💡 Click anywhere on the document to insert a new text box.';
            }
        } else if (toolName === 'whiteout') {
            if (ctxTipText) {
                ctxTipText.innerHTML = '💡 <b>Whiteout:</b> Click or drag over any text or graphic to erase/cover it with white.';
            }
        } else if (toolName === 'pen' || toolName === 'highlighter') {
            ctxDrawGroup.classList.remove('hidden');
            if (toolName === 'highlighter') {
                ctxStrokeColor.value = '#fef08a';
                ctxStrokeColorLabel.style.background = '#fef08a';
                ctxStrokeWidth.value = '16';
                ctxStrokeWidthVal.textContent = '16px';
            } else {
                ctxStrokeColor.value = '#ff0000';
                ctxStrokeColorLabel.style.background = '#ff0000';
                ctxStrokeWidth.value = '3';
                ctxStrokeWidthVal.textContent = '3px';
            }
            if (ctxTipText) ctxTipText.innerHTML = '💡 Draw or highlight directly on the document.';
        } else if (toolName === 'shape') {
            ctxShapeGroup.classList.remove('hidden');
            if (ctxTipText) ctxTipText.innerHTML = '💡 Click to place selected shape, or select an existing shape to adjust properties.';
        } else if (toolName === 'symbol') {
            if (ctxTipText) ctxTipText.innerHTML = `💡 Click on the document to stamp <b>${activeSymbolType.toUpperCase()}</b>.`;
        } else {
            if (ctxTipText) ctxTipText.innerHTML = '💡 Click <b>Edit PDF Text</b> to edit original words, or select objects to move and resize.';
        }

        updateLayerPointerEvents();

        if (toolName !== 'select') {
            deselectAnnotation();
        }
    }

    function updateLayerPointerEvents() {
        const isDrawMode = activeTool === 'pen' || activeTool === 'highlighter';
        const isEditTextMode = activeTool === 'edit-text';
        const isSelectMode = activeTool === 'select';

        pagesData.forEach(pData => {
            if (!pData) return;
            if (pData.drawCanvas) {
                pData.drawCanvas.classList.toggle('drawing-active', isDrawMode);
            }
            if (pData.annoLayer) {
                pData.annoLayer.classList.toggle('select-mode', isSelectMode);
            }
            if (pData.textLayer) {
                pData.textLayer.classList.toggle('edit-mode', isEditTextMode);
            }
        });
    }

    // Tool Button Handlers
    if (toolSelectBtn) toolSelectBtn.onclick = () => setTool('select');
    if (toolEditTextBtn) toolEditTextBtn.onclick = () => setTool('edit-text');
    if (toolTextBtn) toolTextBtn.onclick = () => setTool('text');
    if (toolWhiteoutBtn) toolWhiteoutBtn.onclick = () => setTool('whiteout');
    if (toolPenBtn) toolPenBtn.onclick = () => setTool('pen');
    if (toolHighlighterBtn) toolHighlighterBtn.onclick = () => setTool('highlighter');

    if (toolImageBtn) {
        toolImageBtn.onclick = () => {
            imageFileInput.click();
        };
    }

    if (imageFileInput) {
        imageFileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (ev) => {
                const dataUrl = ev.target.result;
                const img = new Image();
                img.onload = () => {
                    const targetPage = pagesData[0];
                    if (!targetPage) return;
                    const aspect = img.width / img.height;
                    const baseW = Math.min(250, targetPage.viewport.width * 0.4);
                    const baseH = baseW / aspect;

                    const newAnno = {
                        id: Date.now(),
                        pageIndex: 0,
                        type: 'image',
                        x: (targetPage.viewport.width - baseW) / 2,
                        y: (targetPage.viewport.height - baseH) / 2,
                        width: baseW,
                        height: baseH,
                        aspectRatio: aspect,
                        dataUrl: dataUrl,
                        opacity: 1.0
                    };

                    addAnnotation(newAnno);
                    setTool('select');
                    selectAnnotation(newAnno);
                };
                img.src = dataUrl;
            };
            reader.readAsDataURL(file);
            imageFileInput.value = '';
        };
    }

    // Shapes Dropdown
    if (toolShapesBtn) {
        toolShapesBtn.onclick = (e) => {
            e.stopPropagation();
            shapesMenu.classList.toggle('show');
            symbolsMenu.classList.remove('show');
        };
    }

    document.querySelectorAll('.dropdown-item[data-shape]').forEach(item => {
        item.onclick = (e) => {
            e.stopPropagation();
            activeShapeType = item.dataset.shape;
            shapesMenu.classList.remove('show');
            setTool('shape');
        };
    });

    // Symbols Dropdown
    if (toolSymbolsBtn) {
        toolSymbolsBtn.onclick = (e) => {
            e.stopPropagation();
            symbolsMenu.classList.toggle('show');
            shapesMenu.classList.remove('show');
        };
    }

    document.querySelectorAll('.dropdown-item[data-symbol]').forEach(item => {
        item.onclick = (e) => {
            e.stopPropagation();
            activeSymbolType = item.dataset.symbol;
            symbolsMenu.classList.remove('show');
            setTool('symbol');
        };
    });

    // Close Dropdowns on outer click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#tool-shapes-btn') && !e.target.closest('#shapes-menu')) {
            shapesMenu.classList.remove('show');
        }
        if (!e.target.closest('#tool-symbols-btn') && !e.target.closest('#symbols-menu')) {
            symbolsMenu.classList.remove('show');
        }
    });

    // Color Pickers Input Event Handling
    ctxTextColor.oninput = () => {
        ctxColorLabel.style.background = ctxTextColor.value;
        if (selectedAnnotation && selectedAnnotation.type === 'text') {
            selectedAnnotation.color = ctxTextColor.value;
            updateSelectedElementDOM();
            recordState();
        }
    };

    // Eyedropper Tool for exact certificate ink color picking
    if (ctxEyedropperBtn) {
        ctxEyedropperBtn.onclick = async () => {
            if (window.EyeDropper) {
                try {
                    const eyeDropper = new EyeDropper();
                    const res = await eyeDropper.open();
                    if (res && res.sRGBHex) {
                        ctxTextColor.value = res.sRGBHex;
                        ctxColorLabel.style.background = res.sRGBHex;
                        if (selectedAnnotation && selectedAnnotation.type === 'text') {
                            selectedAnnotation.color = res.sRGBHex;
                            updateSelectedElementDOM();
                            recordState();
                        }
                    }
                } catch (err) {}
            } else {
                alert('Eyedropper tool requires Chrome, Edge, or an EyeDropper-supported browser. Use the color picker circle to choose custom colors.');
            }
        };
    }

    ctxBgColor.oninput = () => {
        ctxBgColorLabel.style.background = ctxBgColor.value;
        ctxBgColorLabel.style.borderStyle = 'solid';
        if (selectedAnnotation && selectedAnnotation.type === 'text') {
            selectedAnnotation.bgColor = ctxBgColor.value;
            updateSelectedElementDOM();
            recordState();
        }
    };

    // Eyedropper Tool for background color picking (e.g. certificate banners/ribbons)
    if (ctxBgEyedropperBtn) {
        ctxBgEyedropperBtn.onclick = async () => {
            if (window.EyeDropper) {
                try {
                    const eyeDropper = new EyeDropper();
                    const res = await eyeDropper.open();
                    if (res && res.sRGBHex) {
                        ctxBgColor.value = res.sRGBHex;
                        ctxBgColorLabel.style.background = res.sRGBHex;
                        ctxBgColorLabel.style.borderStyle = 'solid';
                        if (selectedAnnotation && selectedAnnotation.type === 'text') {
                            selectedAnnotation.bgColor = res.sRGBHex;
                            updateSelectedElementDOM();
                            recordState();
                        }
                    }
                } catch (err) {}
            } else {
                alert('Eyedropper tool requires Chrome, Edge, or an EyeDropper-supported browser. Use the color picker circle to choose custom colors.');
            }
        };
    }

    ctxBgTransparent.onclick = () => {
        ctxBgColorLabel.style.background = 'transparent';
        ctxBgColorLabel.style.borderStyle = 'dashed';
        if (selectedAnnotation && selectedAnnotation.type === 'text') {
            selectedAnnotation.bgColor = 'transparent';
            updateSelectedElementDOM();
            recordState();
        }
    };

    ctxFontFamily.onchange = () => {
        if (selectedAnnotation && selectedAnnotation.type === 'text') {
            selectedAnnotation.fontFamily = ctxFontFamily.value;
            updateSelectedElementDOM();
            recordState();
        }
    };

    function syncFontSizeOption(size) {
        const s = Math.max(1, Math.min(500, Math.round(size)));
        const str = String(s);
        ctxFontSize.dataset.lastValue = str;
        let opt = Array.from(ctxFontSize.options).find(o => o.value === str);
        if (!opt) {
            opt = document.createElement('option');
            opt.value = str;
            opt.textContent = `${str} pt`;
            const customOpt = ctxFontSize.querySelector('option[value="custom"]');
            if (customOpt) {
                ctxFontSize.insertBefore(opt, customOpt);
            } else {
                ctxFontSize.appendChild(opt);
            }
        }
        ctxFontSize.value = str;
    }

    ctxFontSize.onchange = () => {
        if (ctxFontSize.value === 'custom') {
            const current = selectedAnnotation ? selectedAnnotation.fontSize : (parseInt(ctxFontSize.dataset.lastValue) || 32);
            const input = prompt('Enter custom font size in pt (1 - 500):', current);
            if (input !== null) {
                const val = Math.max(1, Math.min(500, parseInt(input) || current));
                syncFontSizeOption(val);
                if (selectedAnnotation && selectedAnnotation.type === 'text') {
                    selectedAnnotation.fontSize = val;
                    updateSelectedElementDOM();
                    recordState();
                }
            } else {
                syncFontSizeOption(selectedAnnotation ? selectedAnnotation.fontSize : (parseInt(ctxFontSize.dataset.lastValue) || 32));
            }
            return;
        }

        const size = Math.max(1, parseInt(ctxFontSize.value) || 28);
        ctxFontSize.dataset.lastValue = size;
        if (selectedAnnotation && selectedAnnotation.type === 'text') {
            selectedAnnotation.fontSize = size;
            updateSelectedElementDOM();
            recordState();
        }
    };

    if (ctxFontSizeDec) {
        ctxFontSizeDec.onclick = () => {
            const current = selectedAnnotation ? selectedAnnotation.fontSize : (parseInt(ctxFontSize.value) || 32);
            const newSize = Math.max(1, current - 1);
            syncFontSizeOption(newSize);
            if (selectedAnnotation && selectedAnnotation.type === 'text') {
                selectedAnnotation.fontSize = newSize;
                updateSelectedElementDOM();
                recordState();
            }
        };
    }

    if (ctxFontSizeInc) {
        ctxFontSizeInc.onclick = () => {
            const current = selectedAnnotation ? selectedAnnotation.fontSize : (parseInt(ctxFontSize.value) || 32);
            const newSize = Math.min(500, current + 1);
            syncFontSizeOption(newSize);
            if (selectedAnnotation && selectedAnnotation.type === 'text') {
                selectedAnnotation.fontSize = newSize;
                updateSelectedElementDOM();
                recordState();
            }
        };
    }

    ctxBold.onclick = () => {
        ctxBold.classList.toggle('active');
        if (selectedAnnotation && selectedAnnotation.type === 'text') {
            selectedAnnotation.bold = ctxBold.classList.contains('active');
            updateSelectedElementDOM();
            recordState();
        }
    };

    ctxItalic.onclick = () => {
        ctxItalic.classList.toggle('active');
        if (selectedAnnotation && selectedAnnotation.type === 'text') {
            selectedAnnotation.italic = ctxItalic.classList.contains('active');
            updateSelectedElementDOM();
            recordState();
        }
    };

    // Text Alignment Handlers
    function setTextAlign(align) {
        if (ctxAlignLeft) ctxAlignLeft.classList.toggle('active', align === 'left');
        if (ctxAlignCenter) ctxAlignCenter.classList.toggle('active', align === 'center');
        if (ctxAlignRight) ctxAlignRight.classList.toggle('active', align === 'right');

        if (selectedAnnotation && selectedAnnotation.type === 'text') {
            selectedAnnotation.textAlign = align;
            updateSelectedElementDOM();
            recordState();
        }
    }

    if (ctxAlignLeft) ctxAlignLeft.onclick = () => setTextAlign('left');
    if (ctxAlignCenter) ctxAlignCenter.onclick = () => setTextAlign('center');
    if (ctxAlignRight) ctxAlignRight.onclick = () => setTextAlign('right');

    // Draw Settings
    ctxStrokeColor.oninput = () => {
        ctxStrokeColorLabel.style.background = ctxStrokeColor.value;
    };

    ctxStrokeWidth.oninput = () => {
        ctxStrokeWidthVal.textContent = `${ctxStrokeWidth.value}px`;
    };

    document.querySelectorAll('.color-preset').forEach(btn => {
        btn.onclick = () => {
            const col = btn.dataset.color;
            ctxStrokeColor.value = col;
            ctxStrokeColorLabel.style.background = col;
        };
    });

    // Shape Settings
    ctxShapeBorder.oninput = () => {
        ctxShapeBorderLabel.style.background = ctxShapeBorder.value;
        if (selectedAnnotation && selectedAnnotation.type === 'shape') {
            selectedAnnotation.strokeColor = ctxShapeBorder.value;
            updateSelectedElementDOM();
            recordState();
        }
    };

    ctxShapeFill.oninput = () => {
        ctxShapeFillLabel.style.background = ctxShapeFill.value;
        ctxShapeFillLabel.style.borderStyle = 'solid';
        if (selectedAnnotation && selectedAnnotation.type === 'shape') {
            selectedAnnotation.fillColor = ctxShapeFill.value;
            updateSelectedElementDOM();
            recordState();
        }
    };

    ctxShapeNofill.onclick = () => {
        ctxShapeFillLabel.style.background = 'transparent';
        ctxShapeFillLabel.style.borderStyle = 'dashed';
        if (selectedAnnotation && selectedAnnotation.type === 'shape') {
            selectedAnnotation.fillColor = 'transparent';
            updateSelectedElementDOM();
            recordState();
        }
    };

    ctxShapeStrokeWidth.onchange = () => {
        if (selectedAnnotation && selectedAnnotation.type === 'shape') {
            selectedAnnotation.strokeWidth = parseInt(ctxShapeStrokeWidth.value) || 2;
            updateSelectedElementDOM();
            recordState();
        }
    };

    // Selection Controls
    ctxBtnDuplicate.onclick = () => {
        if (!selectedAnnotation) return;
        const dup = JSON.parse(JSON.stringify(selectedAnnotation));
        dup.id = Date.now();
        dup.x += 20;
        dup.y += 20;
        addAnnotation(dup);
        selectAnnotation(dup);
    };

    ctxBtnFront.onclick = () => {
        if (!selectedAnnotation) return;
        const annos = pagesData[selectedAnnotation.pageIndex].annotations;
        const idx = annos.findIndex(a => a.id === selectedAnnotation.id);
        if (idx !== -1 && idx < annos.length - 1) {
            annos.splice(idx, 1);
            annos.push(selectedAnnotation);
            rebuildPageAnnotationDOM(selectedAnnotation.pageIndex);
            selectAnnotation(selectedAnnotation);
            recordState();
        }
    };

    ctxBtnBack.onclick = () => {
        if (!selectedAnnotation) return;
        const annos = pagesData[selectedAnnotation.pageIndex].annotations;
        const idx = annos.findIndex(a => a.id === selectedAnnotation.id);
        if (idx > 0) {
            annos.splice(idx, 1);
            annos.unshift(selectedAnnotation);
            rebuildPageAnnotationDOM(selectedAnnotation.pageIndex);
            selectAnnotation(selectedAnnotation);
            recordState();
        }
    };

    ctxBtnDelete.onclick = () => {
        if (!selectedAnnotation) return;
        deleteSelectedAnnotation();
    };

    function deleteSelectedAnnotation() {
        if (!selectedAnnotation) return;
        const pIndex = selectedAnnotation.pageIndex;
        pagesData[pIndex].annotations = pagesData[pIndex].annotations.filter(a => a.id !== selectedAnnotation.id);
        const domEl = document.getElementById(`anno-${selectedAnnotation.id}`);
        if (domEl) domEl.remove();
        deselectAnnotation();
        recordState();
    }

    // Page Interaction Events (Adding elements, Whiteout & Drawing)
    function bindPageEvents(pageIndex) {
        const pData = pagesData[pageIndex];
        const { pageContainer, drawCanvas, drawCtx } = pData;

        // Click or Drag to add annotation (Text, Whiteout, Shape, Symbol)
        pageContainer.addEventListener('mousedown', (e) => {
            if (activeTool === 'select' || activeTool === 'edit-text' || activeTool === 'pen' || activeTool === 'highlighter') return;
            if (e.target.closest('.anno-item')) return;

            const rect = pageContainer.getBoundingClientRect();
            const clickX = (e.clientX - rect.left);
            const clickY = (e.clientY - rect.top);

            if (activeTool === 'whiteout') {
                const startX = clickX;
                const startY = clickY;

                const previewBox = document.createElement('div');
                previewBox.style.position = 'absolute';
                previewBox.style.left = `${startX}px`;
                previewBox.style.top = `${startY}px`;
                previewBox.style.width = '0px';
                previewBox.style.height = '0px';
                previewBox.style.background = '#ffffff';
                previewBox.style.border = '1.5px dashed #4f46e5';
                previewBox.style.pointerEvents = 'none';
                previewBox.style.zIndex = '50';
                pageContainer.appendChild(previewBox);

                const onMove = (me) => {
                    const currX = me.clientX - rect.left;
                    const currY = me.clientY - rect.top;
                    const boxL = Math.min(startX, currX);
                    const boxT = Math.min(startY, currY);
                    const boxW = Math.abs(currX - startX);
                    const boxH = Math.abs(currY - startY);

                    previewBox.style.left = `${boxL}px`;
                    previewBox.style.top = `${boxT}px`;
                    previewBox.style.width = `${boxW}px`;
                    previewBox.style.height = `${boxH}px`;
                };

                const onUp = (ue) => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);

                    const currX = ue.clientX - rect.left;
                    const currY = ue.clientY - rect.top;
                    let boxL = Math.min(startX, currX);
                    let boxT = Math.min(startY, currY);
                    let boxW = Math.abs(currX - startX);
                    let boxH = Math.abs(currY - startY);
                    previewBox.remove();

                    if (boxW < 8 || boxH < 8) {
                        boxW = 140;
                        boxH = 32;
                        boxL = Math.max(0, startX - 70);
                        boxT = Math.max(0, startY - 16);
                    }

                    const newAnno = {
                        id: Date.now(),
                        pageIndex: pageIndex,
                        type: 'shape',
                        shapeType: 'rectangle',
                        x: boxL,
                        y: boxT,
                        width: boxW,
                        height: boxH,
                        strokeColor: '#ffffff',
                        fillColor: '#ffffff',
                        strokeWidth: 1
                    };
                    addAnnotation(newAnno);
                    setTool('select');
                    selectAnnotation(newAnno);
                };

                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
                return;
            }

            if (activeTool === 'text') {
                const defaultAlign = ctxAlignCenter?.classList.contains('active') ? 'center' : 'left';
                const newAnno = {
                    id: Date.now(),
                    pageIndex: pageIndex,
                    type: 'text',
                    content: 'Type your text here...',
                    x: Math.max(10, clickX - 100),
                    y: Math.max(10, clickY - 20),
                    width: 240,
                    height: 44,
                    pdfBaselineRatio: 0.28,
                    fontFamily: ctxFontFamily.value || 'Arial',
                    fontSize: parseInt(ctxFontSize.value) || 28,
                    bold: ctxBold.classList.contains('active'),
                    italic: ctxItalic.classList.contains('active'),
                    textAlign: defaultAlign,
                    color: ctxTextColor.value || '#000000',
                    bgColor: ctxBgColorLabel.style.borderStyle === 'dashed' ? 'transparent' : ctxBgColor.value
                };
                addAnnotation(newAnno);
                setTool('select');
                selectAnnotation(newAnno);
            } else if (activeTool === 'shape') {
                const newAnno = {
                    id: Date.now(),
                    pageIndex: pageIndex,
                    type: 'shape',
                    shapeType: activeShapeType,
                    x: Math.max(10, clickX - 75),
                    y: Math.max(10, clickY - 45),
                    width: 150,
                    height: 90,
                    strokeColor: ctxShapeBorder.value || '#ff0000',
                    fillColor: ctxShapeFillLabel.style.borderStyle === 'dashed' ? 'transparent' : ctxShapeFill.value,
                    strokeWidth: parseInt(ctxShapeStrokeWidth.value) || 2
                };
                addAnnotation(newAnno);
                setTool('select');
                selectAnnotation(newAnno);
            } else if (activeTool === 'symbol') {
                // Precise non-clipping default dimensions for stamps
                let w = 180, h = 60;
                if (activeSymbolType === 'confidential') {
                    w = 208; h = 64;
                } else if (['checkmark', 'cross', 'star'].includes(activeSymbolType)) {
                    w = 60; h = 60;
                }

                const newAnno = {
                    id: Date.now(),
                    pageIndex: pageIndex,
                    type: 'symbol',
                    symbolType: activeSymbolType,
                    x: Math.max(10, clickX - (w / 2)),
                    y: Math.max(10, clickY - (h / 2)),
                    width: w,
                    height: h,
                    aspectRatio: w / h
                };
                addAnnotation(newAnno);
                setTool('select');
                selectAnnotation(newAnno);
            }
        });

        // Freehand Drawing (Pen & Highlighter)
        const startDraw = (clientX, clientY) => {
            if (activeTool !== 'pen' && activeTool !== 'highlighter') return;
            isDrawing = true;

            const rect = drawCanvas.getBoundingClientRect();
            const startX = (clientX - rect.left);
            const startY = (clientY - rect.top);

            const isHighlighter = activeTool === 'highlighter';
            const strokeColor = ctxStrokeColor.value || (isHighlighter ? '#fef08a' : '#ff0000');
            const strokeWidth = parseInt(ctxStrokeWidth.value) || (isHighlighter ? 16 : 3);
            const opacity = isHighlighter ? 0.4 : 1.0;

            currentDrawingStroke = {
                color: strokeColor,
                width: strokeWidth,
                opacity: opacity,
                isHighlighter: isHighlighter,
                points: [{ x: startX, y: startY }]
            };

            drawCtx.beginPath();
            drawCtx.moveTo(startX, startY);
            drawCtx.lineCap = 'round';
            drawCtx.lineJoin = 'round';
            drawCtx.lineWidth = strokeWidth;
            drawCtx.strokeStyle = strokeColor;
            drawCtx.globalAlpha = opacity;
        };

        const moveDraw = (clientX, clientY) => {
            if (!isDrawing || !currentDrawingStroke) return;

            const rect = drawCanvas.getBoundingClientRect();
            const currX = (clientX - rect.left);
            const currY = (clientY - rect.top);

            currentDrawingStroke.points.push({ x: currX, y: currY });

            drawCtx.lineTo(currX, currY);
            drawCtx.stroke();
        };

        const endDraw = () => {
            if (!isDrawing) return;
            isDrawing = false;
            if (currentDrawingStroke && currentDrawingStroke.points.length > 1) {
                pData.drawings.push(currentDrawingStroke);
                recordState();
            }
            currentDrawingStroke = null;
        };

        drawCanvas.addEventListener('mousedown', (e) => startDraw(e.clientX, e.clientY));
        window.addEventListener('mousemove', (e) => {
            if (isDrawing) moveDraw(e.clientX, e.clientY);
        });
        window.addEventListener('mouseup', endDraw);

        drawCanvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) startDraw(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });

        window.addEventListener('touchmove', (e) => {
            if (isDrawing && e.touches.length === 1) moveDraw(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });

        window.addEventListener('touchend', endDraw);
    }

    // Redraw Freehand Paths on a Page
    function redrawPageDrawings(pageIndex) {
        const pData = pagesData[pageIndex];
        if (!pData || !pData.drawCtx) return;
        const { drawCanvas, drawCtx, drawings } = pData;

        drawCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);

        drawings.forEach(stroke => {
            if (!stroke.points || stroke.points.length < 2) return;
            drawCtx.save();
            drawCtx.beginPath();
            drawCtx.lineCap = 'round';
            drawCtx.lineJoin = 'round';
            drawCtx.lineWidth = stroke.width;
            drawCtx.strokeStyle = stroke.color;
            drawCtx.globalAlpha = stroke.opacity;

            drawCtx.moveTo(stroke.points[0].x, stroke.points[0].y);
            for (let i = 1; i < stroke.points.length; i++) {
                drawCtx.lineTo(stroke.points[i].x, stroke.points[i].y);
            }
            drawCtx.stroke();
            drawCtx.restore();
        });
    }

    // Add Annotation Object & Render
    function addAnnotation(anno) {
        pagesData[anno.pageIndex].annotations.push(anno);
        renderAnnotationElement(anno);
        recordState();
    }

    function rebuildPageAnnotationDOM(pageIndex) {
        const pData = pagesData[pageIndex];
        if (!pData) return;
        pData.annoLayer.innerHTML = '';
        pData.annotations.forEach(anno => {
            renderAnnotationElement(anno);
        });
    }

    // Render Annotation DOM with Handles, Drag, and Content
    function renderAnnotationElement(anno) {
        const pData = pagesData[anno.pageIndex];
        if (!pData) return;

        const div = document.createElement('div');
        div.className = 'anno-item';
        div.id = `anno-${anno.id}`;
        div.style.left = `${anno.x}px`;
        div.style.top = `${anno.y}px`;
        div.style.width = `${anno.width}px`;
        div.style.height = `${anno.height}px`;

        // Content Wrapper
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'anno-content';

        if (anno.type === 'text') {
            const textDiv = document.createElement('div');
            textDiv.className = 'anno-text-content';
            textDiv.contentEditable = true;
            textDiv.spellcheck = false;
            textDiv.innerText = anno.content;
            textDiv.style.fontFamily = `"${anno.fontFamily || 'Arial'}", sans-serif`;
            textDiv.style.fontSize = `${(anno.fontSize || 28) * currentZoom}px`;
            textDiv.style.fontWeight = anno.bold ? 'bold' : 'normal';
            textDiv.style.fontStyle = anno.italic ? 'italic' : 'normal';
            textDiv.style.textAlign = anno.textAlign || 'left';
            textDiv.style.justifyContent = anno.textAlign === 'center' ? 'center' : (anno.textAlign === 'right' ? 'flex-end' : 'flex-start');
            textDiv.style.color = anno.color || '#000000';
            textDiv.style.background = anno.bgColor || 'transparent';
            textDiv.style.padding = '2px 4px';
            textDiv.style.lineHeight = '1.18';
            textDiv.style.display = 'flex';
            textDiv.style.alignItems = 'center';

            textDiv.oninput = () => {
                anno.content = textDiv.innerText;
                recordState();
            };

            contentWrapper.appendChild(textDiv);
        } else if (anno.type === 'image') {
            const img = document.createElement('img');
            img.src = anno.dataUrl;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            img.style.opacity = anno.opacity || 1.0;
            img.draggable = false;
            contentWrapper.appendChild(img);
        } else if (anno.type === 'shape') {
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '100%');
            svg.style.overflow = 'visible';

            renderSvgShape(svg, anno);
            contentWrapper.appendChild(svg);
        } else if (anno.type === 'symbol') {
            const symbolBox = document.createElement('div');
            symbolBox.style.width = '100%';
            symbolBox.style.height = '100%';
            symbolBox.style.display = 'flex';
            symbolBox.style.alignItems = 'center';
            symbolBox.style.justifyContent = 'center';
            symbolBox.style.userSelect = 'none';

            renderSymbolContent(symbolBox, anno);
            contentWrapper.appendChild(symbolBox);
        }

        div.appendChild(contentWrapper);

        // Resize Handles
        const handles = ['nw', 'ne', 'se', 'sw', 'n', 's', 'w', 'e'];
        handles.forEach(pos => {
            const h = document.createElement('div');
            h.className = `resize-handle handle-${pos}`;
            h.dataset.handle = pos;
            div.appendChild(h);
        });

        // Quick Actions (Delete, Duplicate)
        const quickBar = document.createElement('div');
        quickBar.className = 'anno-quick-actions';

        const dupBtn = document.createElement('button');
        dupBtn.className = 'quick-btn';
        dupBtn.title = 'Duplicate';
        dupBtn.innerHTML = '📑';
        dupBtn.onclick = (e) => {
            e.stopPropagation();
            const dup = JSON.parse(JSON.stringify(anno));
            dup.id = Date.now();
            dup.x += 20;
            dup.y += 20;
            addAnnotation(dup);
            selectAnnotation(dup);
        };

        const delBtn = document.createElement('button');
        delBtn.className = 'quick-btn danger';
        delBtn.title = 'Delete';
        delBtn.innerHTML = '🗑️';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            selectAnnotation(anno);
            deleteSelectedAnnotation();
        };

        quickBar.appendChild(dupBtn);
        quickBar.appendChild(delBtn);
        div.appendChild(quickBar);

        pData.annoLayer.appendChild(div);

        // Bind Selection & Drag / Resize Events
        bindAnnotationInteractions(div, anno);
    }

    function renderSvgShape(svg, anno) {
        svg.innerHTML = '';
        const sw = anno.strokeWidth || 2;
        const color = anno.strokeColor || '#ff0000';
        const fill = anno.fillColor || 'transparent';

        if (anno.shapeType === 'rectangle') {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', sw / 2);
            rect.setAttribute('y', sw / 2);
            rect.setAttribute('width', Math.max(1, anno.width - sw));
            rect.setAttribute('height', Math.max(1, anno.height - sw));
            rect.setAttribute('stroke', color);
            rect.setAttribute('stroke-width', sw);
            rect.setAttribute('fill', fill);
            svg.appendChild(rect);
        } else if (anno.shapeType === 'circle') {
            const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
            ellipse.setAttribute('cx', anno.width / 2);
            ellipse.setAttribute('cy', anno.height / 2);
            ellipse.setAttribute('rx', Math.max(1, (anno.width - sw) / 2));
            ellipse.setAttribute('ry', Math.max(1, (anno.height - sw) / 2));
            ellipse.setAttribute('stroke', color);
            ellipse.setAttribute('stroke-width', sw);
            ellipse.setAttribute('fill', fill);
            svg.appendChild(ellipse);
        } else if (anno.shapeType === 'line') {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', 0);
            line.setAttribute('y1', anno.height / 2);
            line.setAttribute('x2', anno.width);
            line.setAttribute('y2', anno.height / 2);
            line.setAttribute('stroke', color);
            line.setAttribute('stroke-width', sw);
            svg.appendChild(line);
        } else if (anno.shapeType === 'arrow') {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', 0);
            line.setAttribute('y1', anno.height / 2);
            line.setAttribute('x2', Math.max(0, anno.width - 12));
            line.setAttribute('y2', anno.height / 2);
            line.setAttribute('stroke', color);
            line.setAttribute('stroke-width', sw);

            const arrowHead = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const hx = anno.width;
            const hy = anno.height / 2;
            arrowHead.setAttribute('points', `${hx},${hy} ${hx - 12},${hy - 6} ${hx - 12},${hy + 6}`);
            arrowHead.setAttribute('fill', color);

            svg.appendChild(line);
            svg.appendChild(arrowHead);
        }
    }

    // Render Clean, Non-Clipping Vector SVG Stamps in DOM
    function renderSymbolContent(container, anno) {
        if (anno.symbolType === 'approved') {
            container.innerHTML = `
            <svg viewBox="0 0 240 80" width="100%" height="100%" style="overflow:visible;" xmlns="http://www.w3.org/2000/svg">
              <g transform="rotate(-6 120 40)">
                <rect x="15" y="12" width="210" height="56" rx="8" ry="8" fill="rgba(16, 185, 129, 0.08)" stroke="#10b981" stroke-width="4"/>
                <rect x="20" y="17" width="200" height="46" rx="6" ry="6" fill="none" stroke="#10b981" stroke-width="1.5" stroke-dasharray="5 3"/>
                <text x="120" y="47" fill="#10b981" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="24" letter-spacing="3" text-anchor="middle">APPROVED</text>
              </g>
            </svg>`;
        } else if (anno.symbolType === 'rejected') {
            container.innerHTML = `
            <svg viewBox="0 0 240 80" width="100%" height="100%" style="overflow:visible;" xmlns="http://www.w3.org/2000/svg">
              <g transform="rotate(-6 120 40)">
                <rect x="15" y="12" width="210" height="56" rx="8" ry="8" fill="rgba(239, 68, 68, 0.08)" stroke="#ef4444" stroke-width="4"/>
                <rect x="20" y="17" width="200" height="46" rx="6" ry="6" fill="none" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="5 3"/>
                <text x="120" y="47" fill="#ef4444" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="24" letter-spacing="3" text-anchor="middle">REJECTED</text>
              </g>
            </svg>`;
        } else if (anno.symbolType === 'confidential') {
            container.innerHTML = `
            <svg viewBox="0 0 260 80" width="100%" height="100%" style="overflow:visible;" xmlns="http://www.w3.org/2000/svg">
              <g transform="rotate(-5 130 40)">
                <rect x="15" y="12" width="230" height="56" rx="8" ry="8" fill="rgba(245, 158, 11, 0.08)" stroke="#f59e0b" stroke-width="4"/>
                <rect x="20" y="17" width="220" height="46" rx="6" ry="6" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="5 3"/>
                <text x="130" y="47" fill="#f59e0b" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="21" letter-spacing="2.5" text-anchor="middle">CONFIDENTIAL</text>
              </g>
            </svg>`;
        } else if (anno.symbolType === 'checkmark') {
            container.innerHTML = `
            <svg viewBox="0 0 60 60" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <circle cx="30" cy="30" r="26" fill="#10b981"/>
              <polyline points="18,31 26,39 42,21" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`;
        } else if (anno.symbolType === 'cross') {
            container.innerHTML = `
            <svg viewBox="0 0 60 60" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <circle cx="30" cy="30" r="26" fill="#ef4444"/>
              <line x1="20" y1="20" x2="40" y2="40" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
              <line x1="40" y1="20" x2="20" y2="40" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
            </svg>`;
        } else if (anno.symbolType === 'star') {
            container.innerHTML = `
            <svg viewBox="0 0 60 60" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
              <polygon points="30,5 37,22 55,22 41,33 46,50 30,39 14,50 19,33 5,22 23,22" fill="#f59e0b" stroke="#d97706" stroke-width="2"/>
            </svg>`;
        }
    }

    // Helper: Generate Non-Clipping SVG string for PDF Export
    function getSymbolSvgString(anno) {
        if (anno.symbolType === 'approved') {
            return `<svg viewBox="0 0 240 80" width="${anno.width}" height="${anno.height}" xmlns="http://www.w3.org/2000/svg">
              <g transform="rotate(-6 120 40)">
                <rect x="15" y="12" width="210" height="56" rx="8" ry="8" fill="rgba(16, 185, 129, 0.08)" stroke="#10b981" stroke-width="4"/>
                <rect x="20" y="17" width="200" height="46" rx="6" ry="6" fill="none" stroke="#10b981" stroke-width="1.5" stroke-dasharray="5 3"/>
                <text x="120" y="47" fill="#10b981" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="24" letter-spacing="3" text-anchor="middle">APPROVED</text>
              </g>
            </svg>`;
        } else if (anno.symbolType === 'rejected') {
            return `<svg viewBox="0 0 240 80" width="${anno.width}" height="${anno.height}" xmlns="http://www.w3.org/2000/svg">
              <g transform="rotate(-6 120 40)">
                <rect x="15" y="12" width="210" height="56" rx="8" ry="8" fill="rgba(239, 68, 68, 0.08)" stroke="#ef4444" stroke-width="4"/>
                <rect x="20" y="17" width="200" height="46" rx="6" ry="6" fill="none" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="5 3"/>
                <text x="120" y="47" fill="#ef4444" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="24" letter-spacing="3" text-anchor="middle">REJECTED</text>
              </g>
            </svg>`;
        } else if (anno.symbolType === 'confidential') {
            return `<svg viewBox="0 0 260 80" width="${anno.width}" height="${anno.height}" xmlns="http://www.w3.org/2000/svg">
              <g transform="rotate(-5 130 40)">
                <rect x="15" y="12" width="230" height="56" rx="8" ry="8" fill="rgba(245, 158, 11, 0.08)" stroke="#f59e0b" stroke-width="4"/>
                <rect x="20" y="17" width="220" height="46" rx="6" ry="6" fill="none" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="5 3"/>
                <text x="130" y="47" fill="#f59e0b" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="21" letter-spacing="2.5" text-anchor="middle">CONFIDENTIAL</text>
              </g>
            </svg>`;
        } else if (anno.symbolType === 'checkmark') {
            return `<svg viewBox="0 0 60 60" width="${anno.width}" height="${anno.height}" xmlns="http://www.w3.org/2000/svg">
              <circle cx="30" cy="30" r="26" fill="#10b981"/>
              <polyline points="18,31 26,39 42,21" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`;
        } else if (anno.symbolType === 'cross') {
            return `<svg viewBox="0 0 60 60" width="${anno.width}" height="${anno.height}" xmlns="http://www.w3.org/2000/svg">
              <circle cx="30" cy="30" r="26" fill="#ef4444"/>
              <line x1="20" y1="20" x2="40" y2="40" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
              <line x1="40" y1="20" x2="20" y2="40" stroke="#ffffff" stroke-width="5" stroke-linecap="round"/>
            </svg>`;
        } else if (anno.symbolType === 'star') {
            return `<svg viewBox="0 0 60 60" width="${anno.width}" height="${anno.height}" xmlns="http://www.w3.org/2000/svg">
              <polygon points="30,5 37,22 55,22 41,33 46,50 30,39 14,50 19,33 5,22 23,22" fill="#f59e0b" stroke="#d97706" stroke-width="2"/>
            </svg>`;
        }
        return '';
    }

    // Bind Move and Resize Interactions on Item
    function bindAnnotationInteractions(div, anno) {
        div.addEventListener('mousedown', (e) => {
            if (activeTool !== 'select') return;
            selectAnnotation(anno);

            const handleEl = e.target.closest('.resize-handle');
            if (handleEl) {
                startHandleResize(e, handleEl.dataset.handle, div, anno);
            } else {
                startMove(e, div, anno);
            }
        });

        div.addEventListener('touchstart', (e) => {
            if (activeTool !== 'select' || e.touches.length !== 1) return;
            selectAnnotation(anno);
            const handleEl = e.target.closest('.resize-handle');
            if (handleEl) {
                startHandleResize(e.touches[0], handleEl.dataset.handle, div, anno);
            } else {
                startMove(e.touches[0], div, anno);
            }
        }, { passive: true });
    }

    function selectAnnotation(anno) {
        selectedAnnotation = anno;
        document.querySelectorAll('.anno-item').forEach(i => i.classList.remove('selected'));
        const domEl = document.getElementById(`anno-${anno.id}`);
        if (domEl) domEl.classList.add('selected');

        // Sync Context Bar
        ctxSelectionGroup.classList.remove('hidden');
        if (anno.type === 'text') {
            ctxTextGroup.classList.remove('hidden');
            ctxFontFamily.value = anno.fontFamily || 'Arial';
            syncFontSizeOption(anno.fontSize || 32);
            ctxBold.classList.toggle('active', !!anno.bold);
            ctxItalic.classList.toggle('active', !!anno.italic);

            const align = anno.textAlign || 'left';
            if (ctxAlignLeft) ctxAlignLeft.classList.toggle('active', align === 'left');
            if (ctxAlignCenter) ctxAlignCenter.classList.toggle('active', align === 'center');
            if (ctxAlignRight) ctxAlignRight.classList.toggle('active', align === 'right');

            ctxTextColor.value = anno.color || '#000000';
            ctxColorLabel.style.background = ctxTextColor.value;
            if (anno.bgColor && anno.bgColor !== 'transparent') {
                ctxBgColor.value = anno.bgColor;
                ctxBgColorLabel.style.background = anno.bgColor;
                ctxBgColorLabel.style.borderStyle = 'solid';
            } else {
                ctxBgColorLabel.style.background = 'transparent';
                ctxBgColorLabel.style.borderStyle = 'dashed';
            }
        } else if (anno.type === 'shape') {
            ctxShapeGroup.classList.remove('hidden');
            ctxShapeBorder.value = anno.strokeColor || '#ff0000';
            ctxShapeBorderLabel.style.background = ctxShapeBorder.value;
            if (anno.fillColor && anno.fillColor !== 'transparent') {
                ctxShapeFill.value = anno.fillColor;
                ctxShapeFillLabel.style.background = anno.fillColor;
                ctxShapeFillLabel.style.borderStyle = 'solid';
            } else {
                ctxShapeFillLabel.style.background = 'transparent';
                ctxShapeFillLabel.style.borderStyle = 'dashed';
            }
            ctxShapeStrokeWidth.value = String(anno.strokeWidth || 2);
        }
    }

    function deselectAnnotation() {
        selectedAnnotation = null;
        document.querySelectorAll('.anno-item').forEach(i => i.classList.remove('selected'));
        ctxSelectionGroup.classList.add('hidden');
    }

    function updateSelectedElementDOM() {
        if (!selectedAnnotation) return;
        const div = document.getElementById(`anno-${selectedAnnotation.id}`);
        if (!div) return;

        div.style.left = `${selectedAnnotation.x}px`;
        div.style.top = `${selectedAnnotation.y}px`;
        div.style.width = `${selectedAnnotation.width}px`;
        div.style.height = `${selectedAnnotation.height}px`;

        if (selectedAnnotation.type === 'text') {
            const textDiv = div.querySelector('.anno-text-content');
            if (textDiv) {
                textDiv.style.fontFamily = `"${selectedAnnotation.fontFamily || 'Arial'}", sans-serif`;
                textDiv.style.fontSize = `${(selectedAnnotation.fontSize || 28) * currentZoom}px`;
                textDiv.style.fontWeight = selectedAnnotation.bold ? 'bold' : 'normal';
                textDiv.style.fontStyle = selectedAnnotation.italic ? 'italic' : 'normal';
                textDiv.style.textAlign = selectedAnnotation.textAlign || 'left';
                textDiv.style.justifyContent = selectedAnnotation.textAlign === 'center' ? 'center' : (selectedAnnotation.textAlign === 'right' ? 'flex-end' : 'flex-start');
                textDiv.style.color = selectedAnnotation.color || '#000000';
                textDiv.style.background = selectedAnnotation.bgColor || 'transparent';
            }
        } else if (selectedAnnotation.type === 'shape') {
            const svg = div.querySelector('svg');
            if (svg) renderSvgShape(svg, selectedAnnotation);
        }
    }

    // Drag / Move Handler
    function startMove(e, div, anno) {
        if (e.target.closest('.anno-text-content') && document.activeElement === e.target) return;
        let startClientX = e.clientX;
        let startClientY = e.clientY;
        let startX = anno.x;
        let startY = anno.y;

        const onMove = (me) => {
            const cx = me.touches ? me.touches[0].clientX : me.clientX;
            const cy = me.touches ? me.touches[0].clientY : me.clientY;
            const dx = cx - startClientX;
            const dy = cy - startClientY;

            anno.x = Math.max(0, startX + dx);
            anno.y = Math.max(0, startY + dy);
            div.style.left = `${anno.x}px`;
            div.style.top = `${anno.y}px`;
        };

        const onEnd = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onEnd);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onEnd);
            recordState();
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchmove', onMove, { passive: true });
        window.addEventListener('touchend', onEnd);
    }

    // Resize Handles Handler
    function startHandleResize(e, handle, div, anno) {
        if (e.stopPropagation) e.stopPropagation();
        const startX = e.clientX;
        const startY = e.clientY;
        const initialX = anno.x;
        const initialY = anno.y;
        const initialW = anno.width;
        const initialH = anno.height;
        const aspect = anno.aspectRatio || (initialW / initialH);

        const onResize = (me) => {
            const cx = me.touches ? me.touches[0].clientX : me.clientX;
            const cy = me.touches ? me.touches[0].clientY : me.clientY;
            const dx = cx - startX;
            const dy = cy - startY;

            let newW = initialW;
            let newH = initialH;
            let newX = initialX;
            let newY = initialY;

            if (handle.includes('e')) newW = Math.max(30, initialW + dx);
            if (handle.includes('s')) newH = Math.max(20, initialH + dy);
            if (handle.includes('w')) {
                newW = Math.max(30, initialW - dx);
                newX = initialX + (initialW - newW);
            }
            if (handle.includes('n')) {
                newH = Math.max(20, initialH - dy);
                newY = initialY + (initialH - newH);
            }

            // Maintain aspect ratio for image and symbols
            if (anno.type === 'image' || anno.type === 'symbol') {
                if (handle === 'se' || handle === 'nw' || handle === 'ne' || handle === 'sw') {
                    newH = newW / aspect;
                }
            }

            anno.width = newW;
            anno.height = newH;
            anno.x = newX;
            anno.y = newY;

            div.style.width = `${newW}px`;
            div.style.height = `${newH}px`;
            div.style.left = `${newX}px`;
            div.style.top = `${newY}px`;

            if (anno.type === 'shape') {
                const svg = div.querySelector('svg');
                if (svg) renderSvgShape(svg, anno);
            }
        };

        const onEnd = () => {
            window.removeEventListener('mousemove', onResize);
            window.removeEventListener('mouseup', onEnd);
            window.removeEventListener('touchmove', onResize);
            window.removeEventListener('touchend', onEnd);
            recordState();
        };

        window.addEventListener('mousemove', onResize);
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchmove', onResize, { passive: true });
        window.addEventListener('touchend', onEnd);
    }

    // Deselect on Click on document background
    documentViewport.addEventListener('mousedown', (e) => {
        if (!e.target.closest('.anno-item') && !e.target.closest('.context-bar') && !e.target.closest('.editor-topbar')) {
            deselectAnnotation();
        }
    });

    // Keyboard Shortcuts (Delete, Undo, Redo, Quick Tools)
    window.addEventListener('keydown', (e) => {
        if (e.target.isContentEditable || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
            return;
        }

        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedAnnotation) {
                e.preventDefault();
                deleteSelectedAnnotation();
            }
        } else if (e.key === 'Escape') {
            deselectAnnotation();
            setTool('select');
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            if (e.shiftKey) redo();
            else undo();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            redo();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
            e.preventDefault();
            if (selectedAnnotation) {
                const dup = JSON.parse(JSON.stringify(selectedAnnotation));
                dup.id = Date.now();
                dup.x += 20;
                dup.y += 20;
                addAnnotation(dup);
                selectAnnotation(dup);
            }
        } else if (e.key.toLowerCase() === 'v') {
            setTool('select');
        } else if (e.key.toLowerCase() === 'e') {
            setTool('edit-text');
        } else if (e.key.toLowerCase() === 't') {
            setTool('text');
        } else if (e.key.toLowerCase() === 'w') {
            setTool('whiteout');
        } else if (e.key.toLowerCase() === 'p') {
            setTool('pen');
        } else if (e.key.toLowerCase() === 'h') {
            setTool('highlighter');
        }
    });

    // History: Undo & Redo
    function recordState() {
        const snapshot = pagesData.map(p => ({
            annotations: JSON.parse(JSON.stringify(p.annotations)),
            drawings: JSON.parse(JSON.stringify(p.drawings))
        }));

        historyStack.push(snapshot);
        if (historyStack.length > 30) historyStack.shift();
        redoStack = [];
        updateUndoRedoUI();
    }

    function undo() {
        if (historyStack.length < 2) return;
        const current = historyStack.pop();
        redoStack.push(current);
        const previous = historyStack[historyStack.length - 1];
        restoreSnapshot(previous);
    }

    function redo() {
        if (redoStack.length === 0) return;
        const next = redoStack.pop();
        historyStack.push(next);
        restoreSnapshot(next);
    }

    function restoreSnapshot(snapshot) {
        deselectAnnotation();
        snapshot.forEach((pageState, pageIndex) => {
            if (pagesData[pageIndex]) {
                pagesData[pageIndex].annotations = JSON.parse(JSON.stringify(pageState.annotations));
                pagesData[pageIndex].drawings = JSON.parse(JSON.stringify(pageState.drawings));
                rebuildPageAnnotationDOM(pageIndex);
                redrawPageDrawings(pageIndex);
            }
        });
        updateUndoRedoUI();
    }

    function updateUndoRedoUI() {
        if (btnUndo) btnUndo.disabled = historyStack.length <= 1;
        if (btnRedo) btnRedo.disabled = redoStack.length === 0;
    }

    if (btnUndo) btnUndo.onclick = undo;
    if (btnRedo) btnRedo.onclick = redo;

    // Zoom Controls
    if (btnZoomIn) {
        btnZoomIn.onclick = () => {
            if (currentZoom < 2.5) {
                currentZoom = Math.min(2.5, currentZoom + 0.15);
                renderAllPages();
            }
        };
    }

    if (btnZoomOut) {
        btnZoomOut.onclick = () => {
            if (currentZoom > 0.4) {
                currentZoom = Math.max(0.4, currentZoom - 0.15);
                renderAllPages();
            }
        };
    }

    if (btnZoomFit) {
        btnZoomFit.onclick = () => {
            if (!pagesData[0]) return;
            const availableWidth = Math.max(400, documentViewport.clientWidth - 100);
            currentZoom = availableWidth / pagesData[0].unscaledViewport.width;
            renderAllPages();
        };
    }

    if (btnToggleSidebar) {
        btnToggleSidebar.onclick = () => {
            thumbnailsSidebar.classList.toggle('collapsed');
        };
    }

    // Switch PDF / Reset
    if (btnSwitchPdf) {
        btnSwitchPdf.onclick = () => {
            currentPdfFile = null;
            pdfBytes = null;
            pdfJsDoc = null;
            pagesData = [];
            historyStack = [];
            redoStack = [];
            documentViewport.innerHTML = '';
            thumbnailsSidebar.innerHTML = '';
            editorRoot.classList.add('hidden');
            const toolHeader = document.getElementById('tool-header');
            const toolFooter = document.getElementById('tool-footer');
            const appContainer = document.querySelector('.app-container');

            const dropZoneMain = document.getElementById('drop-zone-main');
            if (dropZoneMain) dropZoneMain.classList.remove('hidden');
            dropZone.classList.remove('hidden');
            if (toolHeader) toolHeader.classList.remove('hidden');
            if (toolFooter) toolFooter.classList.remove('hidden');
            if (appContainer) appContainer.classList.remove('editing-active');
            fileInput.value = '';
        };
    }

    // Helper: Hex color to RGB object
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255
        } : { r: 0, g: 0, b: 0 };
    }

    // 100% Client-Side PDF Baking via PDF-Lib
    btnSavePdf.onclick = async () => {
        if (!currentPdfFile && !pdfBytes) return;

        btnSavePdf.disabled = true;
        btnSavePdf.innerHTML = '<span class="spinner" style="width:16px; height:16px; border:2px solid #fff; border-top-color:transparent; border-radius:50%; display:inline-block; animation: spin 0.8s linear infinite; margin-right:8px; vertical-align:middle;"></span> Saving PDF...';

        try {
            // Wait for all certificate web fonts to be completely ready
            if (document.fonts && document.fonts.ready) {
                await document.fonts.ready;
            }

            const { PDFDocument, rgb } = window.PDFLib;
            const freshBuffer = currentPdfFile ? await currentPdfFile.arrayBuffer() : pdfBytes.slice(0).buffer;
            const pdfDoc = await PDFDocument.load(freshBuffer);
            const pages = pdfDoc.getPages();

            for (let i = 0; i < pages.length; i++) {
                const page = pages[i];
                const pData = pagesData[i];
                if (!pData) continue;

                const { width: pdfWidth, height: pdfHeight } = page.getSize();
                const scaleX = pdfWidth / pData.viewport.width;
                const scaleY = pdfHeight / pData.viewport.height;

                // 1. Bake Placed Elements (Text, Image, Shapes, Whiteout, Symbols)
                for (const el of pData.annotations) {
                    const pdfX = el.x * scaleX;
                    const pdfY = pdfHeight - ((el.y + el.height) * scaleY);
                    const pdfW = el.width * scaleX;
                    const pdfH = el.height * scaleY;

                    if (el.type === 'text') {
                        // Render replacement text at 4x resolution (380+ DPI print quality)
                        // matching the exact visual position, font, background, and alignment
                        const hiRes = 4;
                        const textCanvas = document.createElement('canvas');
                        textCanvas.width = Math.round(el.width * hiRes);
                        textCanvas.height = Math.round(el.height * hiRes);
                        const tCtx = textCanvas.getContext('2d');
                        tCtx.scale(hiRes, hiRes);

                        if (el.bgColor && el.bgColor !== 'transparent') {
                            tCtx.fillStyle = el.bgColor;
                            tCtx.fillRect(0, 0, el.width, el.height);
                        }

                        const fontWeight = el.bold ? 'bold ' : 'normal ';
                        const fontStyle = el.italic ? 'italic ' : 'normal ';
                        const fontFam = el.fontFamily || 'Arial';
                        const canvasFontSize = (el.fontSize || 28) * currentZoom;

                        tCtx.font = `${fontWeight}${fontStyle}${canvasFontSize}px "${fontFam}", sans-serif`;
                        tCtx.fillStyle = el.color || '#000000';

                        const textAlign = el.textAlign || 'left';
                        tCtx.textAlign = textAlign;

                        let textX = 4;
                        if (textAlign === 'center') textX = el.width / 2;
                        else if (textAlign === 'right') textX = el.width - 4;

                        const lines = (el.content || '').split('\n');
                        const lineHeight = canvasFontSize * 1.2;
                        const totalBlockHeight = lines.length * lineHeight;
                        // Vertically center text in the box matching DOM textDiv (align-items: center)
                        const startY = ((el.height - totalBlockHeight) / 2) + (lineHeight * 0.78);
                        tCtx.textBaseline = 'alphabetic';

                        lines.forEach((line, idx) => {
                            tCtx.fillText(line, textX, startY + (idx * lineHeight));
                        });

                        const textDataUrl = textCanvas.toDataURL('image/png');
                        const textBytes = await (await fetch(textDataUrl)).arrayBuffer();
                        const textImg = await pdfDoc.embedPng(textBytes);

                        page.drawImage(textImg, {
                            x: pdfX,
                            y: pdfY,
                            width: pdfW,
                            height: pdfH
                        });
                    } else if (el.type === 'image') {
                        const imgBytes = await (await fetch(el.dataUrl)).arrayBuffer();
                        let embeddedImage = null;
                        if (el.dataUrl.includes('image/jpeg') || el.dataUrl.includes('image/jpg')) {
                            embeddedImage = await pdfDoc.embedJpg(imgBytes);
                        } else {
                            embeddedImage = await pdfDoc.embedPng(imgBytes);
                        }

                        page.drawImage(embeddedImage, {
                            x: pdfX,
                            y: pdfY,
                            width: pdfW,
                            height: pdfH,
                            opacity: el.opacity || 1.0
                        });
                    } else if (el.type === 'shape') {
                        const strokeRgb = hexToRgb(el.strokeColor || '#ff0000');
                        const hasFill = el.fillColor && el.fillColor !== 'transparent';
                        const fillRgb = hasFill ? hexToRgb(el.fillColor) : null;
                        const borderWidth = (el.strokeWidth || 1) * scaleX;

                        if (el.shapeType === 'rectangle') {
                            page.drawRectangle({
                                x: pdfX,
                                y: pdfY,
                                width: pdfW,
                                height: pdfH,
                                borderColor: rgb(strokeRgb.r, strokeRgb.g, strokeRgb.b),
                                borderWidth: borderWidth,
                                color: fillRgb ? rgb(fillRgb.r, fillRgb.g, fillRgb.b) : undefined
                            });
                        } else if (el.shapeType === 'circle') {
                            page.drawEllipse({
                                x: pdfX + pdfW / 2,
                                y: pdfY + pdfH / 2,
                                xScale: pdfW / 2,
                                yScale: pdfH / 2,
                                borderColor: rgb(strokeRgb.r, strokeRgb.g, strokeRgb.b),
                                borderWidth: borderWidth,
                                color: fillRgb ? rgb(fillRgb.r, fillRgb.g, fillRgb.b) : undefined
                            });
                        } else if (el.shapeType === 'line' || el.shapeType === 'arrow') {
                            page.drawLine({
                                start: { x: pdfX, y: pdfY + pdfH / 2 },
                                end: { x: pdfX + pdfW, y: pdfY + pdfH / 2 },
                                color: rgb(strokeRgb.r, strokeRgb.g, strokeRgb.b),
                                thickness: borderWidth
                            });

                            if (el.shapeType === 'arrow') {
                                const ah = 10 * scaleX;
                                page.drawLine({
                                    start: { x: pdfX + pdfW - ah, y: pdfY + pdfH / 2 + ah / 2 },
                                    end: { x: pdfX + pdfW, y: pdfY + pdfH / 2 },
                                    color: rgb(strokeRgb.r, strokeRgb.g, strokeRgb.b),
                                    thickness: borderWidth
                                });
                                page.drawLine({
                                    start: { x: pdfX + pdfW - ah, y: pdfY + pdfH / 2 - ah / 2 },
                                    end: { x: pdfX + pdfW, y: pdfY + pdfH / 2 },
                                    color: rgb(strokeRgb.r, strokeRgb.g, strokeRgb.b),
                                    thickness: borderWidth
                                });
                            }
                        }
                    } else if (el.type === 'symbol') {
                        // High resolution SVG rasterization with padded viewBox ensuring zero clipping
                        const symSvgMarkup = getSymbolSvgString(el);
                        const symCanvas = document.createElement('canvas');
                        const hiResScale = 3;
                        symCanvas.width = Math.round(el.width * hiResScale);
                        symCanvas.height = Math.round(el.height * hiResScale);
                        const sCtx = symCanvas.getContext('2d');

                        await new Promise((resolve) => {
                            const svgImg = new Image();
                            const blob = new Blob([symSvgMarkup], { type: 'image/svg+xml;charset=utf-8' });
                            const url = URL.createObjectURL(blob);
                            svgImg.onload = () => {
                                sCtx.drawImage(svgImg, 0, 0, symCanvas.width, symCanvas.height);
                                URL.revokeObjectURL(url);
                                resolve();
                            };
                            svgImg.onerror = () => {
                                URL.revokeObjectURL(url);
                                resolve();
                            };
                            svgImg.src = url;
                        });

                        const symData = symCanvas.toDataURL('image/png');
                        const symBytes = await (await fetch(symData)).arrayBuffer();
                        const symImg = await pdfDoc.embedPng(symBytes);
                        page.drawImage(symImg, {
                            x: pdfX,
                            y: pdfY,
                            width: pdfW,
                            height: pdfH
                        });
                    }
                }

                // 2. Bake Freehand Drawings (High-Res Render)
                if (pData.drawings && pData.drawings.length > 0) {
                    const bakeCanvas = document.createElement('canvas');
                    const hiRes = 3;
                    bakeCanvas.width = pData.viewport.width * hiRes;
                    bakeCanvas.height = pData.viewport.height * hiRes;
                    const bCtx = bakeCanvas.getContext('2d');
                    bCtx.scale(hiRes, hiRes);

                    pData.drawings.forEach(stroke => {
                        if (!stroke.points || stroke.points.length < 2) return;
                        bCtx.save();
                        bCtx.beginPath();
                        bCtx.lineCap = 'round';
                        bCtx.lineJoin = 'round';
                        bCtx.lineWidth = stroke.width;
                        bCtx.strokeStyle = stroke.color;
                        bCtx.globalAlpha = stroke.opacity;

                        bCtx.moveTo(stroke.points[0].x, stroke.points[0].y);
                        for (let ptIdx = 1; ptIdx < stroke.points.length; ptIdx++) {
                            bCtx.lineTo(stroke.points[ptIdx].x, stroke.points[ptIdx].y);
                        }
                        bCtx.stroke();
                        bCtx.restore();
                    });

                    const drawData = bakeCanvas.toDataURL('image/png');
                    const drawBytes = await (await fetch(drawData)).arrayBuffer();
                    const drawImg = await pdfDoc.embedPng(drawBytes);

                    page.drawImage(drawImg, {
                        x: 0,
                        y: 0,
                        width: pdfWidth,
                        height: pdfHeight
                    });
                }
            }

            pdfDoc.setProducer('PDFPals');
            pdfDoc.setCreator('PDFPals');
            const savedBytes = await pdfDoc.save();
            const blob = new Blob([savedBytes], { type: 'application/pdf' });
            const originalName = currentPdfFile ? currentPdfFile.name : 'document.pdf';
            const exportName = originalName.replace(/\.pdf$/i, '_edited.pdf');

            await MobileBridge.saveFile(blob, exportName);
        } catch (err) {
            console.error('Error baking PDF:', err);
            alert('Failed to save edited PDF: ' + err.message);
        } finally {
            btnSavePdf.disabled = false;
            btnSavePdf.innerHTML = 'Save & Download ➔';
        }
    };
});
