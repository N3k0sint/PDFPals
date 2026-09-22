import * as pdfjsLib from '../vendor/pdfjs-dist/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '../vendor/pdfjs-dist/build/pdf.worker.mjs';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.browse-btn');
const workspace = document.getElementById('workspace');
const batchWorkspace = document.getElementById('batch-workspace');
const thumbGrid = document.getElementById('thumbnails-grid');
const applyBtn = document.getElementById('apply-pn');
const changePdfBtn = document.getElementById('change-pdf-btn');
const pipelineNext = document.getElementById('pipeline-next-container');

// Settings Single
const pnFrom = document.getElementById('pn-from');
const pnTo = document.getElementById('pn-to');
const pnStart = document.getElementById('pn-start');
const pnFormat = document.getElementById('pn-format');
const pnSize = document.getElementById('pn-size');
const posPicker = document.getElementById('position-picker');

// Batch Elements
const batchTitle = document.getElementById('batch-title');
const batchList = document.getElementById('batch-list');
const batchAddBtn = document.getElementById('batch-add-btn');
const batchResetBtn = document.getElementById('batch-reset-btn');
const batchPosPicker = document.getElementById('batch-position-picker');
const batchFormat = document.getElementById('batch-pn-format');
const batchSize = document.getElementById('batch-pn-size');
const batchApplyBtn = document.getElementById('batch-apply-pn');

let singleFile = null;
let singleBytes = null;
let pageCount = 0;
let currentPos = 'bottom-left';
let currentMode = 'single';
let batchPos = 'bottom-center';
let batchFiles = []; // Array of { file, name, size, bytes, pageCount }

function formatBytes(bytes, decimals = 1) {
    if (!+bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Position Mapping for Dot placement
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
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (dropped.length > 0) handleIncomingFiles(dropped);
});

browseBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', e => {
    const selected = Array.from(e.target.files);
    if (selected.length > 0) handleIncomingFiles(selected);
});

if (window.WorkflowBridge) {
    window.WorkflowBridge.checkIncomingPipeline((incomingFile) => {
        handleIncomingFiles([incomingFile]);
    });
}

function handleIncomingFiles(files) {
    if (pipelineNext) pipelineNext.innerHTML = '';

    if (files.length === 1 && batchFiles.length === 0) {
        handleSingleFile(files[0]);
    } else {
        handleBatchFiles(files);
    }
}

async function handleSingleFile(file) {
    singleFile = file;
    const buffer = await file.arrayBuffer();
    singleBytes = new Uint8Array(buffer);

    const loadingTask = pdfjsLib.getDocument({ data: singleBytes.slice(0) });
    const pdf = await loadingTask.promise;
    pageCount = pdf.numPages;

    pnFrom.value = 1;
    pnTo.value = pageCount;
    pnTo.max = pageCount;

    dropZone.classList.add('hidden');
    batchWorkspace.classList.add('hidden');
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
        label.style.marginTop = '6px';
        label.style.fontWeight = '600';
        label.textContent = `Page ${i}`;

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
    dot.style.top = ''; dot.style.bottom = ''; dot.style.left = ''; dot.style.right = ''; dot.style.transform = '';

    let pos = currentPos;
    if (currentMode === 'facing' && pageNum % 2 === 0) {
        if (pos.includes('left')) pos = pos.replace('left', 'right');
        else if (pos.includes('right')) pos = pos.replace('right', 'left');
    }

    const styles = posMap[pos];
    Object.assign(dot.style, styles);
}

// Position Picker Single
posPicker.addEventListener('click', e => {
    const cell = e.target.closest('.pos-cell');
    if (!cell) return;

    posPicker.querySelectorAll('.pos-cell').forEach(c => c.classList.remove('active'));
    cell.classList.add('active');
    currentPos = cell.dataset.pos;

    document.querySelectorAll('.placement-dot').forEach((dot, idx) => {
        updateDotPosition(dot, idx + 1);
    });
});

// Position Picker Batch
batchPosPicker.addEventListener('click', e => {
    const cell = e.target.closest('.pos-cell');
    if (!cell) return;

    batchPosPicker.querySelectorAll('.pos-cell').forEach(c => c.classList.remove('active'));
    cell.classList.add('active');
    batchPos = cell.dataset.pos;
});

// Mode Toggle
document.querySelectorAll('input[name="page-mode"]').forEach(radio => {
    radio.addEventListener('change', e => {
        currentMode = e.target.value;
        document.querySelectorAll('.radio-item').forEach(label => {
            if (label.dataset.mode === currentMode) label.classList.add('active');
            else label.classList.remove('active');
        });
        document.querySelectorAll('.placement-dot').forEach((dot, idx) => {
            updateDotPosition(dot, idx + 1);
        });
    });
});

document.querySelectorAll('.radio-item').forEach(label => {
    label.addEventListener('click', () => {
        const radio = label.querySelector('input');
        if (radio) radio.click();
    });
});

// Stamping Helper function
async function stampPageNumbers(bytes, config) {
    const pdfDoc = await window.PDFLib.PDFDocument.load(bytes.slice(0));
    const { rgb, StandardFonts } = window.PDFLib;
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const pages = pdfDoc.getPages();
    const totalPages = pages.length;
    const startPage = (config.from != null ? config.from : 1) - 1;
    const endPage = (config.to != null ? config.to : totalPages) - 1;
    const startNum = config.startNum || 1;
    const fontSize = config.fontSize || 12;
    const format = config.format || 'simple';
    const pos = config.position || 'bottom-center';
    const isFacing = config.mode === 'facing';

    pages.forEach((page, index) => {
        if (index < startPage || index > endPage) return;

        const { width, height } = page.getSize();
        const n = startNum + (index - startPage);
        const m = totalPages;

        let text = '';
        if (format === 'simple') text = `${n}`;
        else if (format === 'page-n') text = `Page ${n}`;
        else if (format === 'n-of-m') text = `Page ${n} of ${m}`;

        const textWidth = font.widthOfTextAtSize(text, fontSize);
        const textHeight = font.heightAtSize(fontSize);

        let activePos = pos;
        if (isFacing && (index + 1) % 2 === 0) {
            if (activePos.includes('left')) activePos = activePos.replace('left', 'right');
            else if (activePos.includes('right')) activePos = activePos.replace('right', 'left');
        }

        let x = 0, y = 0;
        const margin = 30;

        if (activePos.includes('center')) x = (width - textWidth) / 2;
        else if (activePos.includes('left')) x = margin;
        else if (activePos.includes('right')) x = width - textWidth - margin;

        if (activePos.includes('top')) y = height - textHeight - margin;
        else if (activePos.includes('middle')) y = (height - textHeight) / 2;
        else if (activePos.includes('bottom')) y = margin;

        page.drawText(text, {
            x, y,
            size: fontSize,
            font,
            color: rgb(0.1, 0.1, 0.1)
        });
    });

    pdfDoc.setProducer('PDFPals');
    pdfDoc.setCreator('PDFPals');
    return await pdfDoc.save();
}

applyBtn.onclick = async () => {
    applyBtn.disabled = true;
    applyBtn.textContent = 'Stamping Numbers...';

    try {
        const out = await stampPageNumbers(singleBytes, {
            from: parseInt(pnFrom.value) || 1,
            to: parseInt(pnTo.value) || pageCount,
            startNum: parseInt(pnStart.value) || 1,
            fontSize: parseInt(pnSize.value) || 12,
            format: pnFormat.value,
            position: currentPos,
            mode: currentMode
        });

        const blob = new Blob([out], { type: 'application/pdf' });
        const outName = singleFile.name.replace(/\.pdf$/i, '_numbered.pdf');

        if (window.MobileBridge) {
            await window.MobileBridge.saveFile(blob, outName);
        } else {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = outName;
            a.click();
        }

        if (window.WorkflowBridge && pipelineNext) {
            window.WorkflowBridge.renderNextActionBar({
                container: pipelineNext,
                pdfBytes: out,
                fileName: outName
            });
        }
    } catch (e) {
        console.error(e);
        alert('Error stamping page numbers: ' + e.message);
    } finally {
        applyBtn.disabled = false;
        applyBtn.textContent = 'Generate Index ➔';
    }
};

changePdfBtn.onclick = () => {
    singleFile = null;
    singleBytes = null;
    pageCount = 0;
    thumbGrid.innerHTML = '';
    dropZone.classList.remove('hidden');
    workspace.classList.add('hidden');
    batchWorkspace.classList.add('hidden');
    fileInput.value = '';
    if (pipelineNext) pipelineNext.innerHTML = '';
};

// Batch Functions
async function handleBatchFiles(files) {
    dropZone.classList.add('hidden');
    workspace.classList.add('hidden');
    batchWorkspace.classList.remove('hidden');

    for (const file of files) {
        try {
            const buffer = await file.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            const doc = await window.PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
            batchFiles.push({
                file,
                name: file.name,
                size: file.size,
                bytes,
                pageCount: doc.getPageCount()
            });
        } catch (err) {
            console.warn('Batch parse error:', file.name, err);
        }
    }

    renderBatchUI();
}

function renderBatchUI() {
    batchTitle.textContent = `Batch Pagination (${batchFiles.length} files)`;
    batchList.innerHTML = '';

    batchFiles.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'batch-item';

        div.innerHTML = `
            <div style="display:flex; align-items:center; gap:0.8rem; min-width:0; flex:1;">
                <span style="font-size:1.4rem;">📄</span>
                <div style="min-width:0;">
                    <div style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${item.name}">${item.name}</div>
                    <div style="font-size:0.8rem; opacity:0.6;">${formatBytes(item.size)} • ${item.pageCount} page${item.pageCount === 1 ? '' : 's'}</div>
                </div>
            </div>
            <button type="button" class="btn secondary outline small remove-b-btn" style="border-radius:8px; color:#ef4444;" title="Remove">✕</button>
        `;

        div.querySelector('.remove-b-btn').onclick = () => {
            batchFiles.splice(idx, 1);
            if (batchFiles.length === 0) batchReset();
            else renderBatchUI();
        };

        batchList.appendChild(div);
    });
}

batchAddBtn.onclick = () => fileInput.click();

function batchReset() {
    batchFiles = [];
    batchList.innerHTML = '';
    dropZone.classList.remove('hidden');
    batchWorkspace.classList.add('hidden');
    workspace.classList.add('hidden');
    fileInput.value = '';
    if (pipelineNext) pipelineNext.innerHTML = '';
}

batchResetBtn.onclick = batchReset;

batchApplyBtn.onclick = async () => {
    if (batchFiles.length === 0) return alert("Batch queue is empty.");

    batchApplyBtn.disabled = true;
    batchApplyBtn.textContent = 'Stamping Batch...';

    try {
        if (!window.JSZip) throw new Error("JSZip is not available.");
        const zip = new window.JSZip();

        for (let i = 0; i < batchFiles.length; i++) {
            const item = batchFiles[i];
            batchApplyBtn.textContent = `Numbering [${i + 1}/${batchFiles.length}]...`;

            const numberedBytes = await stampPageNumbers(item.bytes, {
                from: 1,
                to: item.pageCount,
                startNum: 1,
                fontSize: parseInt(batchSize.value) || 11,
                format: batchFormat.value,
                position: batchPos,
                mode: 'single'
            });

            const outName = item.name.replace(/\.pdf$/i, '_numbered.pdf');
            zip.file(outName, numberedBytes);
        }

        batchApplyBtn.textContent = 'Packaging ZIP...';
        const zipBlob = await zip.generateAsync({ type: 'blob' });

        if (window.MobileBridge) {
            await window.MobileBridge.saveFile(zipBlob, 'numbered_documents.zip');
        } else {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(zipBlob);
            a.download = 'numbered_documents.zip';
            a.click();
        }

        alert(`Successfully paginated ${batchFiles.length} documents!`);
    } catch (err) {
        console.error(err);
        alert("Batch pagination error: " + err.message);
    } finally {
        batchApplyBtn.disabled = false;
        batchApplyBtn.textContent = 'Number All & Download ZIP ➔';
    }
};
