import * as pdfjsLib from '../vendor/pdfjs-dist/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '../vendor/pdfjs-dist/build/pdf.worker.mjs';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.browse-btn');
const workspace = document.getElementById('workspace');
const thumbGrid = document.getElementById('thumbnails-grid');
const applyBtn = document.getElementById('apply-pn');
const changePdfBtn = document.getElementById('change-pdf-btn');

// Settings
const pnFrom = document.getElementById('pn-from');
const pnTo = document.getElementById('pn-to');
const pnStart = document.getElementById('pn-start');
const pnFormat = document.getElementById('pn-format');
const pnSize = document.getElementById('pn-size');
const posPicker = document.getElementById('position-picker');

let pdfBytes = null;
let pageCount = 0;
let currentPos = 'bottom-left';
let currentMode = 'single';

// Position Mapping for Dot placement (relative %)
const posMap = {
    'top-left': { top: '5%', left: '5%' },
    'top-center': { top: '5%', left: '50%', transform: 'translateX(-50%)' },
    'top-right': { top: '5%', right: '5%' },
    'middle-left': { top: '50%', left: '5%', transform: 'translateY(-50%)' },
    'middle-center': { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
    'middle-right': { top: '50%', right: '5%', transform: 'translateY(-50%)' },
    'bottom-left': { bottom: '5%', left: '5%' },
    'bottom-center': { bottom: '5%', left: '50%', transform: 'translateX(-50%)' },
    'bottom-right': { bottom: '5%', right: '5%' }
};

// Drag and drop
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
    pdfBytes = new Uint8Array(buffer.slice(0)); // Clone buffer

    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
    const pdf = await loadingTask.promise;
    pageCount = pdf.numPages;

    pnFrom.value = 1;
    pnTo.value = pageCount;
    pnTo.max = pageCount;

    dropZone.classList.add('hidden');
    workspace.classList.remove('hidden');

    renderThumbnails(pdf);
}

async function renderThumbnails(pdf) {
    thumbGrid.innerHTML = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.3 });

        const wrapper = document.createElement('div');
        wrapper.className = 'thumbnail-wrapper';

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

        const label = document.createElement('div');
        label.className = 'page-label';
        label.textContent = i;

        const dot = document.createElement('div');
        dot.className = 'placement-dot';
        updateDotPosition(dot, i);

        wrapper.appendChild(canvas);
        wrapper.appendChild(label);
        wrapper.appendChild(dot);
        thumbGrid.appendChild(wrapper);
    }
}

function updateDotPosition(dot, pageNum) {
    // Reset styles
    dot.style.top = ''; dot.style.bottom = ''; dot.style.left = ''; dot.style.right = ''; dot.style.transform = '';

    let pos = currentPos;
    if (currentMode === 'facing' && pageNum % 2 === 0) {
        // Swap horizontal position for even pages
        if (pos.includes('left')) pos = pos.replace('left', 'right');
        else if (pos.includes('right')) pos = pos.replace('right', 'left');
    }

    const styles = posMap[pos];
    Object.assign(dot.style, styles);
}

// Position Picker Logic
posPicker.addEventListener('click', e => {
    const cell = e.target.closest('.pos-cell');
    if (!cell) return;

    document.querySelectorAll('.pos-cell').forEach(c => c.classList.remove('active'));
    cell.classList.add('active');
    currentPos = cell.dataset.pos;

    // Refresh all dots
    document.querySelectorAll('.placement-dot').forEach((dot, idx) => {
        updateDotPosition(dot, idx + 1);
    });
});

// Mode Toggle Logic
document.querySelectorAll('input[name="page-mode"]').forEach(radio => {
    radio.addEventListener('change', e => {
        currentMode = e.target.value;
        
        // UI Feedback
        document.querySelectorAll('.radio-item').forEach(label => {
            if (label.dataset.mode === currentMode) label.classList.add('active');
            else label.classList.remove('active');
        });

        document.querySelectorAll('.placement-dot').forEach((dot, idx) => {
            updateDotPosition(dot, idx + 1);
        });
    });
});

// Make labels clickable to trigger radio change
document.querySelectorAll('.radio-item').forEach(label => {
    label.addEventListener('click', () => {
        const radio = label.querySelector('input');
        if (radio) radio.click();
    });
});

applyBtn.onclick = async () => {
    applyBtn.disabled = true;
    applyBtn.textContent = 'Processing...';

    try {
        const pdfDoc = await window.PDFLib.PDFDocument.load(pdfBytes.slice(0));
        const { rgb, StandardFonts } = window.PDFLib;
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

        const pages = pdfDoc.getPages();
        const startPage = parseInt(pnFrom.value) - 1;
        const endPage = parseInt(pnTo.value) - 1;
        const startNum = parseInt(pnStart.value) || 1;
        const fontSize = parseInt(pnSize.value) || 12;

        pages.forEach((page, index) => {
            if (index < startPage || index > endPage) return;

            const { width, height } = page.getSize();
            const n = startNum + (index - startPage);
            const m = pageCount;

            let text = '';
            const format = pnFormat.value;
            if (format === 'simple') text = `${n}`;
            else if (format === 'page-n') text = `Page ${n}`;
            else if (format === 'n-of-m') text = `Page ${n} of ${m}`;

            const textWidth = font.widthOfTextAtSize(text, fontSize);
            const textHeight = font.heightAtSize(fontSize);

            let pos = currentPos;
            if (currentMode === 'facing' && (index + 1) % 2 === 0) {
                if (pos.includes('left')) pos = pos.replace('left', 'right');
                else if (pos.includes('right')) pos = pos.replace('right', 'left');
            }

            let x = 0, y = 0;
            const margin = 30;

            // X calculation
            if (pos.includes('center')) x = (width - textWidth) / 2;
            else if (pos.includes('left')) x = margin;
            else if (pos.includes('right')) x = width - textWidth - margin;

            // Y calculation
            if (pos.includes('top')) y = height - textHeight - margin;
            else if (pos.includes('middle')) y = (height - textHeight) / 2;
            else if (pos.includes('bottom')) y = margin;

            page.drawText(text, {
                x, y,
                size: fontSize,
                font,
                color: rgb(0.1, 0.1, 0.1)
            });
        });

        pdfDoc.setProducer('PDFPals');
        pdfDoc.setCreator('PDFPals');
        const out = await pdfDoc.save();
        const blob = new Blob([out], { type: 'application/pdf' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'numbered_document.pdf';
        a.click();
    } catch (e) { alert('Error: ' + e.message); }
    finally { applyBtn.disabled = false; applyBtn.textContent = 'Add page numbers ➔'; }
}

browseBtn.addEventListener('click', () => fileInput.click());

if (changePdfBtn) {
    changePdfBtn.onclick = () => {
        pdfBytes = null;
        pageCount = 0;
        thumbGrid.innerHTML = '';
        dropZone.classList.remove('hidden');
        workspace.classList.add('hidden');
        fileInput.value = '';
    };
}

