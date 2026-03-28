import * as pdfjsLib from '../vendor/pdfjs-dist/build/pdf.mjs';

const workerSrc = new URL('../vendor/pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;
pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.browse-btn');
const workspace = document.getElementById('workspace');
const redactionContainer = document.getElementById('redaction-container');
const clearBtn = document.getElementById('clear-redactions');
const applyBtn = document.getElementById('apply-redactions');
const changePdfBtn = document.getElementById('change-pdf-btn');
const applyAllCheckbox = document.getElementById('apply-all-checkbox');

let pdfBytes = null;
let pdfDoc = null;
let redactions = []; // Array of { pageIndex, x, y, width, height }

// Drag and drop setup
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

// Browse behavior - native label handles it, but let's be safe
//  

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
});

async function handleFile(file) {
    if (file.type !== 'application/pdf') {
        alert('Please select a PDF file.');
        return;
    }
    const buffer = await file.arrayBuffer();
    pdfBytes = new Uint8Array(buffer.slice(0)); // Clone buffer to prevent detachment

    dropZone.classList.add('hidden');
    workspace.classList.remove('hidden');

    renderPDF();
}

async function renderPDF() {
    redactionContainer.innerHTML = '';
    // Deep slice to prevent detachment by PDF.js
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
    pdfDoc = await loadingTask.promise;

    for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 1.0 });

        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'page-wrapper';
        pageWrapper.dataset.pageIndex = i - 1;

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        await page.render(renderContext).promise;

        const overlay = document.createElement('div');
        overlay.className = 'redact-overlay';

        setupRedactionEvents(overlay, i - 1, viewport);

        pageWrapper.appendChild(canvas);
        pageWrapper.appendChild(overlay);
        redactionContainer.appendChild(pageWrapper);
    }
}

function setupRedactionEvents(overlay, pageIndex, viewport) {
    let isDrawing = false;
    let startX, startY;
    let currentRectNode = null;

    overlay.addEventListener('mousedown', (e) => startRedaction(e));
    overlay.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        startRedaction({ clientX: touch.clientX, clientY: touch.clientY, target: e.target });
        e.preventDefault();
    });

    function startRedaction(e) {
        if (e.target.closest('.redact-close')) return;

        isDrawing = true;
        const rect = overlay.getBoundingClientRect();
        startX = e.clientX - rect.left;
        startY = e.clientY - rect.top;

        currentRectNode = document.createElement('div');
        currentRectNode.className = 'redaction-rect';
        currentRectNode.style.left = startX + 'px';
        currentRectNode.style.top = startY + 'px';

        const closeBtn = document.createElement('div');
        closeBtn.className = 'redact-close';
        closeBtn.innerHTML = '×';
        currentRectNode.appendChild(closeBtn);

        overlay.appendChild(currentRectNode);

        // Bind global listeners to capture release outside overlay
        window.addEventListener('mousemove', moveRedactionGlobal);
        window.addEventListener('mouseup', endRedactionGlobal);
        window.addEventListener('touchmove', touchMoveGlobal, { passive: false });
        window.addEventListener('touchend', endRedactionGlobal);
    }

    function moveRedactionGlobal(e) {
        if (!isDrawing) return;
        const rect = overlay.getBoundingClientRect();
        
        // Use clientX/Y to handle scrolls correctly relative to the viewport-fixed rect
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const width = currentX - startX;
        const height = currentY - startY;

        // Apply clamping and absolute positioning
        currentRectNode.style.width = Math.abs(width) + 'px';
        currentRectNode.style.height = Math.abs(height) + 'px';
        currentRectNode.style.left = Math.min(startX, currentX) + 'px';
        currentRectNode.style.top = Math.min(startY, currentY) + 'px';
    }

    function touchMoveGlobal(e) {
        if (!isDrawing) return;
        const touch = e.touches[0];
        moveRedactionGlobal({ clientX: touch.clientX, clientY: touch.clientY });
        e.preventDefault();
    }

    function endRedactionGlobal() {
        if (!isDrawing) return;
        isDrawing = false;

        window.removeEventListener('mousemove', moveRedactionGlobal);
        window.removeEventListener('mouseup', endRedactionGlobal);
        window.removeEventListener('touchmove', touchMoveGlobal);
        window.removeEventListener('touchend', endRedactionGlobal);

        const rect = currentRectNode.getBoundingClientRect();
        const overlayRect = overlay.getBoundingClientRect();

        if (rect.width < 5 || rect.height < 5) {
            currentRectNode.remove();
            return;
        }

        // Crucial: Calculate scale factor between canvas internal and screen size
        const scaleFactor = viewport.width / overlayRect.width;

        const redaction = {
            pageIndex: pageIndex,
            x: (Math.min(startX, (rect.left - overlayRect.left + rect.width))) / 1, // Placeholder for logic below
            y: 0, 
            width: 0,
            height: 0
        };
        
        // Accurate coordinates for PDF-Lib
        const localLeft = rect.left - overlayRect.left;
        const localTop = rect.top - overlayRect.top;
        
        redaction.x = (localLeft * scaleFactor);
        redaction.width = (rect.width * scaleFactor);
        redaction.height = (rect.height * scaleFactor);
        // PDF-Lib uses bottom-up coordinates
        redaction.y = (viewport.height - ((localTop + rect.height) * scaleFactor));

        redaction.node = currentRectNode;
        redactions.push(redaction);

        const closeBtn = currentRectNode.querySelector('.redact-close');
        closeBtn.addEventListener('mousedown', (ev) => ev.stopPropagation());
        closeBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            redaction.node.remove();
            redactions = redactions.filter(r => r !== redaction);
        });
    }
}

clearBtn.addEventListener('click', () => {
    redactions = [];
    document.querySelectorAll('.redaction-rect').forEach(r => r.remove());
});

applyBtn.addEventListener('click', async () => {
    console.log('Current redactions:', redactions);
    if (redactions.length === 0) {
        alert('Please select areas to redact first.');
        return;
    }

    applyBtn.disabled = true;
    applyBtn.textContent = 'Redacting...';

    try {
        if (!pdfBytes || pdfBytes.length < 5) {
            throw new Error('PDF data is missing or too short.');
        }

        // Use deep slice to ensure no detachment issues
        const pdfDocRedact = await window.PDFLib.PDFDocument.load(pdfBytes.slice(0));
        const pages = pdfDocRedact.getPages();

        redactions.forEach(r => {
            if (applyAllCheckbox && applyAllCheckbox.checked) {
                pages.forEach(page => {
                    page.drawRectangle({
                        x: r.x,
                        y: r.y,
                        width: r.width,
                        height: r.height,
                        color: window.PDFLib.rgb(0, 0, 0),
                    });
                });
            } else {
                const page = pages[r.pageIndex];
                page.drawRectangle({
                    x: r.x,
                    y: r.y,
                    width: r.width,
                    height: r.height,
                    color: window.PDFLib.rgb(0, 0, 0),
                });
            }
        });

        pdfDocRedact.setProducer('PDFPals');
        pdfDocRedact.setCreator('PDFPals');
        const outBytes = await pdfDocRedact.save();
        const blob = new Blob([outBytes], { type: 'application/pdf' });
        await MobileBridge.saveFile(blob, 'redacted_document.pdf');
    } catch (e) {
        console.error('Redaction failed:', e);
        alert('Failed to redact PDF: ' + e.message);
    } finally {
        applyBtn.disabled = false;
        applyBtn.textContent = 'Redact & Download ➔';
    }
});

if (changePdfBtn) {
    changePdfBtn.onclick = () => {
        pdfBytes = null;
        redactions = [];
        redactionContainer.innerHTML = '';
        dropZone.classList.remove('hidden');
        workspace.classList.add('hidden');
        fileInput.value = '';
    };
}


browseBtn.addEventListener('click', () => fileInput.click());
