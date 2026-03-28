import * as pdfjsLib from '../vendor/pdfjs-dist/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '../vendor/pdfjs-dist/build/pdf.worker.mjs';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.browse-btn');
const workspace = document.getElementById('workspace');
const cropContainer = document.getElementById('crop-container');
const applyBtn = document.getElementById('apply-crop');
const changePdfBtn = document.getElementById('change-pdf-btn');

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
    cropContainer.appendChild(canvas);

    // Create Crop Box
    const box = document.createElement('div');
    box.className = 'crop-box';
    updateBoxStyle(box);

    // Handles
    ['nw', 'ne', 'sw', 'se'].forEach(pos => {
        const h = document.createElement('div');
        h.className = `crop-handle handle-${pos}`;
        box.appendChild(h);
        setupResize(h, pos, box);
    });

    setupDrag(box);
    cropContainer.appendChild(box);
}

function updateBoxStyle(box) {
    box.style.left = currentCrop.x + 'px';
    box.style.top = currentCrop.y + 'px';
    box.style.width = currentCrop.width + 'px';
    box.style.height = currentCrop.height + 'px';
}

function setupDrag(box) {
    let isMoving = false, offset = { x: 0, y: 0 };
    box.onmousedown = e => {
        if (e.target !== box) return;
        isMoving = true;
        offset = { x: e.clientX - box.offsetLeft, y: e.clientY - box.offsetTop };
        document.onmousemove = ev => {
            if (!isMoving) return;
            currentCrop.x = Math.max(0, Math.min(ev.clientX - offset.x, pageViewport.width - currentCrop.width));
            currentCrop.y = Math.max(0, Math.min(ev.clientY - offset.y, pageViewport.height - currentCrop.height));
            updateBoxStyle(box);
        };
        document.onmouseup = () => isMoving = false;
    };
}

function setupResize(handle, pos, box) {
    handle.onmousedown = e => {
        e.stopPropagation();
        const startX = e.clientX, startY = e.clientY;
        const startW = currentCrop.width, startH = currentCrop.height;
        const startX_box = currentCrop.x, startY_box = currentCrop.y;

        document.onmousemove = ev => {
            const dx = ev.clientX - startX, dy = ev.clientY - startY;
            if (pos.includes('e')) currentCrop.width = Math.max(20, startW + dx);
            if (pos.includes('s')) currentCrop.height = Math.max(20, startH + dy);
            if (pos.includes('w')) {
                const newW = Math.max(20, startW - dx);
                currentCrop.x = startX_box + (startW - newW);
                currentCrop.width = newW;
            }
            if (pos.includes('n')) {
                const newH = Math.max(20, startH - dy);
                currentCrop.y = startY_box + (startH - newH);
                currentCrop.height = newH;
            }
            updateBoxStyle(box);
        };
        document.onmouseup = () => document.onmousemove = null;
    };
}

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

            page.setCropBox(
                currentCrop.x * scaleX,
                (pageViewport.height - (currentCrop.y + currentCrop.height)) * scaleY,
                currentCrop.width * scaleX,
                currentCrop.height * scaleY
            );
        });
        libDoc.setProducer('PDFPals');
        libDoc.setCreator('PDFPals');
        const out = await libDoc.save();
        const blob = new Blob([out], { type: 'application/pdf' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'cropped.pdf';
        a.click();
    } catch (e) { alert('Error: ' + e.message); }
    finally { applyBtn.disabled = false; applyBtn.textContent = 'Crop & Download ➔'; }
};

if (changePdfBtn) {
    changePdfBtn.onclick = () => {
        pdfBytes = null;
        dropZone.classList.remove('hidden');
        workspace.classList.add('hidden');
        fileInput.value = '';
    };
}

browseBtn.addEventListener('click', () => fileInput.click());

