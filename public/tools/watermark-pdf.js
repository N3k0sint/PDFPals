import * as pdfjsLib from '../vendor/pdfjs-dist/build/pdf.mjs';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '../vendor/pdfjs-dist/build/pdf.worker.mjs';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.browse-btn');
const fileNameDisplay = document.getElementById('file-name');

// Canvas and Stage Elements
const pdfCanvas = document.getElementById('pdf-canvas');
const watermarkCanvas = document.getElementById('watermark-canvas');
const prevPageBtn = document.getElementById('prev-page-btn');
const nextPageBtn = document.getElementById('next-page-btn');
const pageNumIndicator = document.getElementById('page-num-indicator');

// Settings Elements
const wmText = document.getElementById('wm-text');
const wmFont = document.getElementById('wm-font');
const wmSize = document.getElementById('wm-size');
const btnBold = document.getElementById('btn-bold');
const btnItalic = document.getElementById('btn-italic');
const wmColor = document.getElementById('wm-color');
const colorBar = document.getElementById('color-bar');
const wmMosaic = document.getElementById('wm-mosaic');
const wmOpacity = document.getElementById('wm-opacity');
const wmRotation = document.getElementById('wm-rotation');
const gridBtns = document.querySelectorAll('.grid-btn');
const applyBtn = document.getElementById('apply-btn');
const changePdfBtn = document.getElementById('change-pdf-btn');
const workspace = document.getElementById('workspace');

// Tabs
const tabText = document.getElementById('tab-text');
const tabImage = document.getElementById('tab-image');
const textSettings = document.getElementById('text-settings');
const imageSettings = document.getElementById('image-settings');
const wmImgScale = document.getElementById('wm-img-scale');
const wmImgScaleSlider = document.getElementById('wm-img-scale-slider');

// Image Watermark
const wmImageInput = document.getElementById('wm-image-input');
const wmImagePreview = document.getElementById('wm-image-preview');
const wmImgTag = document.getElementById('wm-img-tag');
const removeImgBtn = document.getElementById('remove-img-btn');

// State
let currentPdfFile = null;
let pdfBytes = null;
let pdfJsDoc = null;
let currentPageNum = 1;
let totalPages = 1;
let currentPos = 'middle-center';
let customPosRatio = null; // { xRatio, yRatio } for custom placement
let isDragging = false;
let activeMode = 'text'; // 'text' or 'image'
let isBold = true;
let isItalic = false;
let wmImageBytes = null;
let wmImageType = null; // 'png' or 'jpg'
let wmImageElement = null;
let renderedPageViewport = null;

// Tab Switching
tabText.addEventListener('click', () => {
    tabText.classList.add('active');
    tabImage.classList.remove('active');
    textSettings.classList.remove('hidden');
    imageSettings.classList.add('hidden');
    activeMode = 'text';
    renderWatermarkPreview();
});

tabImage.addEventListener('click', () => {
    tabImage.classList.add('active');
    tabText.classList.remove('active');
    imageSettings.classList.remove('hidden');
    textSettings.classList.add('hidden');
    activeMode = 'image';
    renderWatermarkPreview();
});

// Image Scale Slider Sync
wmImgScaleSlider.addEventListener('input', (e) => {
    wmImgScale.value = e.target.value;
    renderWatermarkPreview();
});

wmImgScale.addEventListener('input', (e) => {
    wmImgScaleSlider.value = e.target.value;
    renderWatermarkPreview();
});

// Image Input Handling
wmImageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
        alert('Please select a PNG or JPG image.');
        return;
    }

    wmImageType = file.type === 'image/png' ? 'png' : 'jpg';
    const buffer = await file.arrayBuffer();
    wmImageBytes = new Uint8Array(buffer);

    const blobUrl = URL.createObjectURL(file);
    wmImgTag.src = blobUrl;
    wmImagePreview.classList.remove('hidden');

    wmImageElement = new Image();
    wmImageElement.onload = () => {
        renderWatermarkPreview();
    };
    wmImageElement.src = blobUrl;
});

removeImgBtn.addEventListener('click', () => {
    wmImageBytes = null;
    wmImageType = null;
    wmImageElement = null;
    wmImgTag.src = '';
    wmImagePreview.classList.add('hidden');
    wmImageInput.value = '';
    renderWatermarkPreview();
});

// Bold & Italic Toggles
if (btnBold) {
    btnBold.addEventListener('click', () => {
        isBold = !isBold;
        btnBold.classList.toggle('active', isBold);
        renderWatermarkPreview();
    });
}

if (btnItalic) {
    btnItalic.addEventListener('click', () => {
        isItalic = !isItalic;
        btnItalic.classList.toggle('active', isItalic);
        renderWatermarkPreview();
    });
}

// Color Picker
wmColor.addEventListener('input', () => {
    if (colorBar) colorBar.style.background = wmColor.value;
    renderWatermarkPreview();
});

// Text & Style Inputs Live Preview
wmText.addEventListener('input', renderWatermarkPreview);
wmFont.addEventListener('change', renderWatermarkPreview);
wmSize.addEventListener('input', renderWatermarkPreview);
wmOpacity.addEventListener('input', renderWatermarkPreview);
wmRotation.addEventListener('input', renderWatermarkPreview);
wmMosaic.addEventListener('change', renderWatermarkPreview);

// Position Grid Buttons
gridBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        gridBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPos = btn.dataset.pos;
        customPosRatio = null; // Clear custom drag position
        renderWatermarkPreview();
    });
});

// Interactive Click / Drag to Position Watermark Anywhere
function handleCanvasPointer(e) {
    if (!watermarkCanvas || !renderedPageViewport) return;
    const rect = watermarkCanvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const xRatio = Math.max(0.02, Math.min(0.98, clickX / rect.width));
    const yRatio = Math.max(0.02, Math.min(0.98, clickY / rect.height));

    customPosRatio = { xRatio, yRatio };
    gridBtns.forEach(b => b.classList.remove('active'));
    renderWatermarkPreview();
}

if (watermarkCanvas) {
    watermarkCanvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        handleCanvasPointer(e);
    });

    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            handleCanvasPointer(e);
        }
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
    });

    watermarkCanvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            isDragging = true;
            handleCanvasPointer(e.touches[0]);
        }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
        if (isDragging && e.touches.length === 1) {
            handleCanvasPointer(e.touches[0]);
        }
    }, { passive: true });

    window.addEventListener('touchend', () => {
        isDragging = false;
    });
}

// Drag & Drop
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
});

browseBtn.addEventListener('click', () => fileInput.click());

if (window.WorkflowBridge) {
    window.WorkflowBridge.checkIncomingPipeline(handleFile);
}

// Load & Preview PDF
async function handleFile(file) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        alert('Please select a valid PDF file.');
        return;
    }
    currentPdfFile = file;
    const buffer = await file.arrayBuffer();
    pdfBytes = new Uint8Array(buffer);

    fileNameDisplay.textContent = file.name;
    dropZone.classList.add('hidden');
    workspace.classList.remove('hidden');

    try {
        // Pass a copy so PDF.js worker transferable cannot detach our main buffer
        pdfJsDoc = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
        totalPages = pdfJsDoc.numPages;
        currentPageNum = 1;
        await renderCurrentPdfPage();
    } catch (err) {
        console.error('Error loading PDF with PDF.js:', err);
        alert('Failed to preview PDF: ' + (err.message || 'Corrupted file'));
    }
}

// Render Page on Canvas
async function renderCurrentPdfPage() {
    if (!pdfJsDoc) return;

    try {
        const page = await pdfJsDoc.getPage(currentPageNum);
        const docSection = document.getElementById('document-section');
        const availableWidth = Math.max(300, (docSection ? docSection.clientWidth : 700) - 80);

        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const targetScale = Math.max(0.8, Math.min(2.0, availableWidth / unscaledViewport.width));
        const viewport = page.getViewport({ scale: targetScale });
        renderedPageViewport = viewport;

        pdfCanvas.width = viewport.width;
        pdfCanvas.height = viewport.height;
        watermarkCanvas.width = viewport.width;
        watermarkCanvas.height = viewport.height;

        const ctx = pdfCanvas.getContext('2d');
        ctx.clearRect(0, 0, pdfCanvas.width, pdfCanvas.height);

        await page.render({
            canvasContext: ctx,
            viewport: viewport
        }).promise;

        updatePagination();
        renderWatermarkPreview();
    } catch (err) {
        console.error('Render page error:', err);
    }
}

function updatePagination() {
    pageNumIndicator.textContent = `Page ${currentPageNum} / ${totalPages}`;
    prevPageBtn.disabled = currentPageNum <= 1;
    nextPageBtn.disabled = currentPageNum >= totalPages;
}

prevPageBtn.addEventListener('click', async () => {
    if (currentPageNum > 1) {
        currentPageNum--;
        await renderCurrentPdfPage();
    }
});

nextPageBtn.addEventListener('click', async () => {
    if (currentPageNum < totalPages) {
        currentPageNum++;
        await renderCurrentPdfPage();
    }
});

// Calculate watermark center (cx, cy) and dimensions (w, h) in PDF points
function getWatermarkLayout(pageWidth, pageHeight, isImageMode, imgNaturalWidth, imgNaturalHeight, customTextWidth, customTextHeight) {
    let w = 0;
    let h = 0;

    if (isImageMode) {
        const scaleVal = (parseInt(wmImgScale.value) || 50) / 100;
        const maxTargetW = pageWidth * 0.8;
        const maxTargetH = pageHeight * 0.8;
        const aspect = (imgNaturalWidth && imgNaturalHeight) ? (imgNaturalWidth / imgNaturalHeight) : 1;

        w = maxTargetW * scaleVal;
        h = w / aspect;
        if (h > maxTargetH * scaleVal) {
            h = maxTargetH * scaleVal;
            w = h * aspect;
        }
    } else {
        const fontSize = parseFloat(wmSize.value) || 48;
        w = customTextWidth || ((wmText.value || 'CONFIDENTIAL').length * fontSize * 0.55);
        h = customTextHeight || fontSize;
    }

    let cx = pageWidth / 2;
    let cy = pageHeight / 2;

    if (customPosRatio) {
        cx = pageWidth * customPosRatio.xRatio;
        cy = pageHeight * (1 - customPosRatio.yRatio);
    } else {
        const margin = 50;
        if (currentPos.includes('left')) {
            cx = margin + w / 2;
        } else if (currentPos.includes('right')) {
            cx = pageWidth - margin - w / 2;
        } else {
            cx = pageWidth / 2;
        }

        if (currentPos.includes('top')) {
            cy = pageHeight - margin - h / 2;
        } else if (currentPos.includes('bottom')) {
            cy = margin + h / 2;
        } else {
            cy = pageHeight / 2;
        }
    }

    return { cx, cy, w, h };
}

// Render Real-Time Watermark Overlay
function renderWatermarkPreview() {
    if (!watermarkCanvas || !renderedPageViewport) return;

    const ctx = watermarkCanvas.getContext('2d');
    const canvasW = watermarkCanvas.width;
    const canvasH = watermarkCanvas.height;
    ctx.clearRect(0, 0, canvasW, canvasH);

    const scale = renderedPageViewport.scale;
    const pageWidth = canvasW / scale;
    const pageHeight = canvasH / scale;

    const opacity = parseFloat(wmOpacity.value) || 0.5;
    const rot = parseFloat(wmRotation.value) || 0;
    const rotRad = -(rot * Math.PI / 180); // PDF-Lib rotates counter-clockwise; Canvas Y is down
    const isMosaic = wmMosaic.checked;

    if (activeMode === 'text') {
        const text = wmText.value || '';
        if (!text.trim()) return;

        const fontSizePt = parseFloat(wmSize.value) || 48;
        const fontSizePx = fontSizePt * scale;
        const fontName = wmFont.value || 'Arial';
        const color = wmColor.value || '#FF0000';

        ctx.font = `${isItalic ? 'italic ' : ''}${isBold ? 'bold ' : ''}${fontSizePx}px ${fontName}, sans-serif`;
        ctx.fillStyle = color;
        ctx.globalAlpha = opacity;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const metrics = ctx.measureText(text);
        const textWidthPt = metrics.width / scale;
        const textHeightPt = fontSizePt;

        const { cx, cy } = getWatermarkLayout(pageWidth, pageHeight, false, 0, 0, textWidthPt, textHeightPt);

        if (isMosaic) {
            const cols = [pageWidth * 0.25, pageWidth * 0.5, pageWidth * 0.75];
            const rows = [pageHeight * 0.2, pageHeight * 0.5, pageHeight * 0.8];
            for (const cX of cols) {
                for (const cY of rows) {
                    ctx.save();
                    ctx.translate(cX * scale, (pageHeight - cY) * scale);
                    ctx.rotate(rotRad);
                    ctx.fillText(text, 0, 0);
                    ctx.restore();
                }
            }
        } else {
            ctx.save();
            ctx.translate(cx * scale, (pageHeight - cy) * scale);
            ctx.rotate(rotRad);
            ctx.fillText(text, 0, 0);
            ctx.restore();
        }
    } else if (activeMode === 'image' && wmImageElement && wmImageElement.complete && wmImageElement.naturalWidth) {
        const { cx, cy, w, h } = getWatermarkLayout(
            pageWidth,
            pageHeight,
            true,
            wmImageElement.naturalWidth,
            wmImageElement.naturalHeight
        );

        const drawW = w * scale;
        const drawH = h * scale;
        ctx.globalAlpha = opacity;

        if (isMosaic) {
            const cols = [pageWidth * 0.25, pageWidth * 0.5, pageWidth * 0.75];
            const rows = [pageHeight * 0.2, pageHeight * 0.5, pageHeight * 0.8];
            for (const cX of cols) {
                for (const cY of rows) {
                    ctx.save();
                    ctx.translate(cX * scale, (pageHeight - cY) * scale);
                    ctx.rotate(rotRad);
                    ctx.drawImage(wmImageElement, -drawW / 2, -drawH / 2, drawW, drawH);
                    ctx.restore();
                }
            }
        } else {
            ctx.save();
            ctx.translate(cx * scale, (pageHeight - cy) * scale);
            ctx.rotate(rotRad);
            ctx.drawImage(wmImageElement, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();
        }
    }
}

// Reset / Switch PDF
if (changePdfBtn) {
    changePdfBtn.onclick = () => {
        currentPdfFile = null;
        pdfBytes = null;
        pdfJsDoc = null;
        currentPageNum = 1;
        totalPages = 1;
        currentPos = 'middle-center';
        customPosRatio = null;
        gridBtns.forEach(b => {
            b.classList.toggle('active', b.dataset.pos === 'middle-center');
        });
        dropZone.classList.remove('hidden');
        workspace.classList.add('hidden');
        fileInput.value = '';
    };
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255
    } : { r: 0, g: 0, b: 0 };
}

// Apply Watermark & Export via PDF-Lib
applyBtn.addEventListener('click', async () => {
    if (!currentPdfFile && !pdfBytes) return;
    if (activeMode === 'image' && !wmImageBytes) {
        alert('Please select a watermark image first.');
        return;
    }

    applyBtn.disabled = true;
    applyBtn.textContent = 'Processing...';

    try {
        const opacityStr = wmOpacity.value;
        const opacity = (opacityStr && !isNaN(Number(opacityStr))) ? Number(opacityStr) : 0.5;

        const rotStr = wmRotation.value;
        const rot = (rotStr && !isNaN(Number(rotStr))) ? Number(rotStr) : 0;
        const rad = rot * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const isMosaic = wmMosaic.checked;

        const freshBuffer = currentPdfFile ? await currentPdfFile.arrayBuffer() : pdfBytes.slice().buffer;
        const pdfDoc = await window.PDFLib.PDFDocument.load(freshBuffer);
        const pages = pdfDoc.getPages();
        const { StandardFonts, rgb, degrees } = window.PDFLib;

        let wmImage = null;
        if (activeMode === 'image') {
            wmImage = wmImageType === 'png'
                ? await pdfDoc.embedPng(wmImageBytes)
                : await pdfDoc.embedJpg(wmImageBytes);
        }

        // Font matching
        const fontName = wmFont.value || 'Arial';
        let selectedStandardFont = StandardFonts.Helvetica;
        if (fontName.includes('Courier')) {
            selectedStandardFont = (isBold && isItalic) ? StandardFonts.CourierBoldOblique
                : isBold ? StandardFonts.CourierBold
                : isItalic ? StandardFonts.CourierOblique
                : StandardFonts.Courier;
        } else if (fontName.includes('Times')) {
            selectedStandardFont = (isBold && isItalic) ? StandardFonts.TimesRomanBoldItalic
                : isBold ? StandardFonts.TimesRomanBold
                : isItalic ? StandardFonts.TimesRomanItalic
                : StandardFonts.TimesRoman;
        } else {
            selectedStandardFont = (isBold && isItalic) ? StandardFonts.HelveticaBoldOblique
                : isBold ? StandardFonts.HelveticaBold
                : isItalic ? StandardFonts.HelveticaOblique
                : StandardFonts.Helvetica;
        }
        const font = await pdfDoc.embedFont(selectedStandardFont);

        for (const page of pages) {
            const { width: pageWidth, height: pageHeight } = page.getSize();

            if (activeMode === 'text') {
                const textToDraw = String(wmText.value || ' ');
                const fontSizeStr = wmSize.value;
                const fontSize = (fontSizeStr && !isNaN(Number(fontSizeStr))) ? Number(fontSizeStr) : 48;
                const colorInput = wmColor.value;
                const rgbColor = hexToRgb(colorInput);
                const textWidth = font.widthOfTextAtSize(textToDraw, fontSize);
                const textHeight = fontSize;

                const { cx, cy } = getWatermarkLayout(pageWidth, pageHeight, false, 0, 0, textWidth, textHeight);

                // In standard fonts, visual vertical middle is approximately 0.35 * fontSize above the baseline
                const baselineOffset = fontSize * 0.35;
                const drawTextAtCenter = (centerPdfX, centerPdfY) => {
                    // Position baseline origin so rotated text centers at (centerPdfX, centerPdfY)
                    const x = centerPdfX - (textWidth / 2) * cos + baselineOffset * sin;
                    const y = centerPdfY - (textWidth / 2) * sin - baselineOffset * cos;
                    page.drawText(textToDraw, {
                        size: fontSize,
                        font: font,
                        color: rgb(rgbColor.r, rgbColor.g, rgbColor.b),
                        opacity: opacity,
                        rotate: degrees(rot),
                        x: Number(x),
                        y: Number(y),
                    });
                };

                if (isMosaic) {
                    const cols = [pageWidth * 0.25, pageWidth * 0.5, pageWidth * 0.75];
                    const rows = [pageHeight * 0.2, pageHeight * 0.5, pageHeight * 0.8];
                    for (const cX of cols) {
                        for (const cY of rows) {
                            drawTextAtCenter(cX, cY);
                        }
                    }
                } else {
                    drawTextAtCenter(cx, cy);
                }
            } else if (activeMode === 'image' && wmImage) {
                const { cx, cy, w, h } = getWatermarkLayout(
                    pageWidth,
                    pageHeight,
                    true,
                    wmImage.width,
                    wmImage.height
                );

                const drawProps = {
                    width: w,
                    height: h,
                    opacity: opacity,
                    rotate: degrees(rot),
                };

                const drawImageAtCenter = (centerPdfX, centerPdfY) => {
                    // Position bottom-left (x, y) so rotated image centers at (centerPdfX, centerPdfY)
                    const x = centerPdfX - (w / 2) * cos + (h / 2) * sin;
                    const y = centerPdfY - (w / 2) * sin - (h / 2) * cos;
                    page.drawImage(wmImage, { ...drawProps, x: Number(x), y: Number(y) });
                };

                if (isMosaic) {
                    const cols = [pageWidth * 0.25, pageWidth * 0.5, pageWidth * 0.75];
                    const rows = [pageHeight * 0.2, pageHeight * 0.5, pageHeight * 0.8];
                    for (const cX of cols) {
                        for (const cY of rows) {
                            drawImageAtCenter(cX, cY);
                        }
                    }
                } else {
                    drawImageAtCenter(cx, cy);
                }
            }
        }

        // Flatten form annotations if option is checked
        const flattenToggle = document.getElementById('flatten-watermark-toggle');
        if (flattenToggle && flattenToggle.checked) {
            try {
                const form = pdfDoc.getForm();
                form.flatten();
            } catch (e) {
                // Non-form documents are already vector embedded
            }
        }

        pdfDoc.setProducer('PDFPals');
        pdfDoc.setCreator('PDFPals');
        const outBytes = await pdfDoc.save();
        const blob = new Blob([outBytes], { type: 'application/pdf' });
        const fileName = fileNameDisplay.textContent.replace('.pdf', '_watermarked.pdf');
        await MobileBridge.saveFile(blob, fileName);

        if (window.WorkflowBridge) {
            const nextActionContainer = document.getElementById('next-action-container');
            window.WorkflowBridge.renderNextActionBar(nextActionContainer, blob, fileName);
        }
    } catch (e) {
        console.error("WATERMARK ERROR DETAILS:", e);
        alert(`Failed to apply watermark. Error: ${e.message}`);
    } finally {
        applyBtn.disabled = false;
        applyBtn.textContent = 'Apply Watermark ➔';
    }
});
