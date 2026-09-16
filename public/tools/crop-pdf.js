import * as pdfjsLib from '../vendor/pdfjs-dist/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '../vendor/pdfjs-dist/build/pdf.worker.mjs';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.browse-btn');
const workspace = document.getElementById('workspace');
const cropContainer = document.getElementById('crop-container');
const applyBtn = document.getElementById('apply-crop');
const changePdfBtn = document.getElementById('change-pdf-btn');
const autoCropBtn = document.getElementById('auto-crop');

let pdfBytes = null;
let currentCrop = { x: 50, y: 50, width: 400, height: 500 }; // Pixels on UI
let pageViewport = null;

// File Handling
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', e => {
    if (e.target.files.length) handleFile(e.target.files[0]);
});

async function handleFile(file) {
    if (file.type !== 'application/pdf') return alert('Please select a PDF');
    const buffer = await file.arrayBuffer();
    pdfBytes = new Uint8Array(buffer.slice(0)); // Clone buffer to prevent detachment
    dropZone.classList.add('hidden');
    workspace.classList.remove('hidden');
    renderFirstPage();
}

async function renderFirstPage() {
    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    pageViewport = page.getViewport({ scale: 1.0 });

    const canvas = document.createElement('canvas');
    canvas.width = pageViewport.width;
    canvas.height = pageViewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: pageViewport }).promise;

    cropContainer.innerHTML = '';
    cropContainer.style.width = `${pageViewport.width}px`;
    cropContainer.style.height = `${pageViewport.height}px`;
    cropContainer.appendChild(canvas);

    // Default crop box: 5% inset from margins
    const marginX = Math.round(pageViewport.width * 0.05);
    const marginY = Math.round(pageViewport.height * 0.05);
    currentCrop = {
        x: marginX,
        y: marginY,
        width: Math.round(pageViewport.width * 0.9),
        height: Math.round(pageViewport.height * 0.9)
    };

    // Create Crop Box
    const box = document.createElement('div');
    box.className = 'crop-box';
    updateBoxStyle(box);

    // 8 Handles (4 corners + 4 edges)
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(pos => {
        const h = document.createElement('div');
        h.className = `crop-handle handle-${pos}`;
        box.appendChild(h);
        setupResize(h, pos, box);
    });

    setupDrag(box);
    setupCanvasDrawSelection(box);
    cropContainer.appendChild(box);
}

function updateBoxStyle(box) {
    box.style.left = currentCrop.x + 'px';
    box.style.top = currentCrop.y + 'px';
    box.style.width = currentCrop.width + 'px';
    box.style.height = currentCrop.height + 'px';
}

// Click and drag anywhere on the document to draw a new crop rectangle
function setupCanvasDrawSelection(box) {
    const onStart = (clientX, clientY, e) => {
        if (e.target.closest('.crop-box')) return;
        e.preventDefault();

        const rect = cropContainer.getBoundingClientRect();
        const startX = Math.max(0, Math.min(pageViewport.width, clientX - rect.left));
        const startY = Math.max(0, Math.min(pageViewport.height, clientY - rect.top));

        currentCrop.x = startX;
        currentCrop.y = startY;
        currentCrop.width = 10;
        currentCrop.height = 10;
        updateBoxStyle(box);

        const onMove = (me) => {
            const cx = me.touches ? me.touches[0].clientX : me.clientX;
            const cy = me.touches ? me.touches[0].clientY : me.clientY;
            const curX = Math.max(0, Math.min(pageViewport.width, cx - rect.left));
            const curY = Math.max(0, Math.min(pageViewport.height, cy - rect.top));

            const minX = Math.min(startX, curX);
            const minY = Math.min(startY, curY);
            const maxX = Math.max(startX, curX);
            const maxY = Math.max(startY, curY);

            currentCrop.x = minX;
            currentCrop.y = minY;
            currentCrop.width = Math.max(20, maxX - minX);
            currentCrop.height = Math.max(20, maxY - minY);
            updateBoxStyle(box);
        };

        const onEnd = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onEnd);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onEnd);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onEnd);
    };

    cropContainer.addEventListener('mousedown', (e) => onStart(e.clientX, e.clientY, e));
    cropContainer.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length > 0) {
            onStart(e.touches[0].clientX, e.touches[0].clientY, e);
        }
    }, { passive: false });
}

// Drag existing box to reposition
function setupDrag(box) {
    const startDrag = (clientX, clientY, e) => {
        if (e.target.closest('.crop-handle')) return;
        e.preventDefault();
        e.stopPropagation();

        const startX = clientX;
        const startY = clientY;
        const originX = currentCrop.x;
        const originY = currentCrop.y;

        const onMove = (me) => {
            const cx = me.touches ? me.touches[0].clientX : me.clientX;
            const cy = me.touches ? me.touches[0].clientY : me.clientY;
            const dx = cx - startX;
            const dy = cy - startY;

            const maxX = pageViewport.width - currentCrop.width;
            const maxY = pageViewport.height - currentCrop.height;

            currentCrop.x = Math.max(0, Math.min(maxX, originX + dx));
            currentCrop.y = Math.max(0, Math.min(maxY, originY + dy));
            updateBoxStyle(box);
        };

        const onEnd = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onEnd);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onEnd);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onEnd);
    };

    box.addEventListener('mousedown', (e) => startDrag(e.clientX, e.clientY, e));
    box.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length > 0) {
            startDrag(e.touches[0].clientX, e.touches[0].clientY, e);
        }
    }, { passive: false });
}

// Resize box with 8-direction handles
function setupResize(handle, pos, box) {
    const startResize = (clientX, clientY, e) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = clientX;
        const startY = clientY;
        const origX = currentCrop.x;
        const origY = currentCrop.y;
        const origW = currentCrop.width;
        const origH = currentCrop.height;

        const onMove = (me) => {
            const cx = me.touches ? me.touches[0].clientX : me.clientX;
            const cy = me.touches ? me.touches[0].clientY : me.clientY;
            const dx = cx - startX;
            const dy = cy - startY;

            let newX = origX;
            let newY = origY;
            let newW = origW;
            let newH = origH;

            // East (right)
            if (pos.includes('e')) {
                newW = Math.max(20, Math.min(pageViewport.width - origX, origW + dx));
            }
            // West (left)
            if (pos.includes('w')) {
                const maxLeft = origX + origW - 20;
                newX = Math.max(0, Math.min(maxLeft, origX + dx));
                newW = (origX + origW) - newX;
            }
            // South (bottom)
            if (pos.includes('s')) {
                newH = Math.max(20, Math.min(pageViewport.height - origY, origH + dy));
            }
            // North (top)
            if (pos.includes('n')) {
                const maxTop = origY + origH - 20;
                newY = Math.max(0, Math.min(maxTop, origY + dy));
                newH = (origY + origH) - newY;
            }

            currentCrop.x = newX;
            currentCrop.y = newY;
            currentCrop.width = newW;
            currentCrop.height = newH;
            updateBoxStyle(box);
        };

        const onEnd = () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onEnd);
            window.removeEventListener('touchmove', onMove);
            window.removeEventListener('touchend', onEnd);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onEnd);
    };

    handle.addEventListener('mousedown', (e) => startResize(e.clientX, e.clientY, e));
    handle.addEventListener('touchstart', (e) => {
        if (e.touches && e.touches.length > 0) {
            startResize(e.touches[0].clientX, e.touches[0].clientY, e);
        }
    }, { passive: false });
}

// Automated Content Detection
if (autoCropBtn) {
    autoCropBtn.onclick = () => {
        const canvas = cropContainer.querySelector('canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;

        let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;

        for (let y = 0; y < canvas.height; y += 2) {
            for (let x = 0; x < canvas.width; x += 2) {
                const idx = (y * canvas.width + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];
                const a = data[idx + 3];

                // If pixel has content (not white background or transparent)
                if (a > 50 && (r < 240 || g < 240 || b < 240)) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
        }

        if (maxX > minX && maxY > minY) {
            const pad = 20;
            const x = Math.max(0, minX - pad);
            const y = Math.max(0, minY - pad);
            const w = Math.min(canvas.width - x, (maxX - minX) + pad * 2);
            const h = Math.min(canvas.height - y, (maxY - minY) + pad * 2);

            currentCrop.x = x;
            currentCrop.y = y;
            currentCrop.width = w;
            currentCrop.height = h;

            const box = cropContainer.querySelector('.crop-box');
            if (box) updateBoxStyle(box);
        } else {
            alert('No distinct content detected to auto-crop.');
        }
    };
}

// Execute Crop
applyBtn.onclick = async () => {
    applyBtn.disabled = true;
    applyBtn.textContent = 'Cropping...';
    try {
        const libDoc = await window.PDFLib.PDFDocument.load(pdfBytes.slice(0));
        libDoc.getPages().forEach(page => {
            const { width, height } = page.getSize();
            // Convert UI pixels to PDF points
            const scaleX = width / pageViewport.width;
            const scaleY = height / pageViewport.height;

            const pdfX = currentCrop.x * scaleX;
            const pdfY = (pageViewport.height - (currentCrop.y + currentCrop.height)) * scaleY;
            const pdfW = currentCrop.width * scaleX;
            const pdfH = currentCrop.height * scaleY;

            // Set both CropBox and MediaBox for universal reader support
            page.setCropBox(pdfX, pdfY, pdfW, pdfH);
            page.setMediaBox(pdfX, pdfY, pdfW, pdfH);
        });

        libDoc.setProducer('PDFPals');
        libDoc.setCreator('PDFPals');
        const out = await libDoc.save();
        const blob = new Blob([out], { type: 'application/pdf' });

        if (typeof MobileBridge !== 'undefined') {
            await MobileBridge.saveFile(blob, 'cropped_document.pdf');
        } else {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'cropped_document.pdf';
            a.click();
        }
    } catch (e) {
        console.error(e);
        alert('Error: ' + e.message);
    } finally {
        applyBtn.disabled = false;
        applyBtn.textContent = 'Execute Crop ➔';
    }
};

if (changePdfBtn) {
    changePdfBtn.onclick = () => {
        pdfBytes = null;
        cropContainer.innerHTML = '';
        dropZone.classList.remove('hidden');
        workspace.classList.add('hidden');
        fileInput.value = '';
    };
}

browseBtn.addEventListener('click', () => fileInput.click());
