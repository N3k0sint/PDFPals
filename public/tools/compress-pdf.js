import * as pdfjsLib from '../vendor/pdfjs-dist/build/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = '../vendor/pdfjs-dist/build/pdf.worker.mjs';

function setupRadioGroup(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    const options = container.querySelectorAll('.radio-option');
    options.forEach(opt => {
        opt.onclick = () => {
            options.forEach(r => r.classList.remove('active'));
            opt.classList.add('active');
            const input = opt.querySelector('input');
            if (input) input.checked = true;
        };
    });
}

setupRadioGroup('#comp-options');
setupRadioGroup('#batch-comp-options');

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.browse-btn');
const fileNameDisplay = document.getElementById('file-name');
const fileSizeDisplay = document.getElementById('file-size');
const resultBadge = document.getElementById('result-badge');
const applyBtn = document.getElementById('apply-btn');
const changePdfBtn = document.getElementById('change-pdf-btn');
const workspace = document.getElementById('workspace');
const batchWorkspace = document.getElementById('batch-workspace');
const pipelineNext = document.getElementById('pipeline-next-container');

// Progress single
const pBar = document.getElementById('progress-bar');
const pText = document.getElementById('progress-text');
const pContainer = document.getElementById('progress-container');

// Batch elements
const batchTitle = document.getElementById('batch-title');
const batchList = document.getElementById('batch-list');
const batchAddBtn = document.getElementById('batch-add-btn');
const batchResetBtn = document.getElementById('batch-reset-btn');
const batchApplyBtn = document.getElementById('batch-apply-btn');
const batchPContainer = document.getElementById('batch-progress-container');
const batchPBar = document.getElementById('batch-progress-bar');
const batchPText = document.getElementById('batch-progress-text');

let singleFile = null;
let singleBytes = null;
let batchFiles = []; // Array of { file, name, size, bytes }

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

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
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (dropped.length > 0) handleIncomingFiles(dropped);
});

browseBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length > 0) handleIncomingFiles(selected);
});

// Workflow pipeline check
if (window.WorkflowBridge) {
    window.WorkflowBridge.checkIncomingPipeline((incomingFile) => {
        handleIncomingFiles([incomingFile]);
    });
}

function handleIncomingFiles(files) {
    if (pipelineNext) pipelineNext.innerHTML = '';
    if (resultBadge) resultBadge.style.display = 'none';

    if (files.length === 1 && batchFiles.length === 0) {
        handleSingleFile(files[0]);
    } else {
        handleBatchFiles(files);
    }
}

// Single file handler
async function handleSingleFile(file) {
    singleFile = file;
    const buffer = await file.arrayBuffer();
    singleBytes = new Uint8Array(buffer);

    fileNameDisplay.textContent = file.name;
    fileSizeDisplay.textContent = `Original Size: ${formatBytes(file.size)}`;
    dropZone.classList.add('hidden');
    batchWorkspace.classList.add('hidden');
    workspace.classList.remove('hidden');
}

changePdfBtn.onclick = () => {
    singleFile = null;
    singleBytes = null;
    dropZone.classList.remove('hidden');
    workspace.classList.add('hidden');
    batchWorkspace.classList.add('hidden');
    fileInput.value = '';
    if (resultBadge) resultBadge.style.display = 'none';
    if (pipelineNext) pipelineNext.innerHTML = '';
};

// Compression engine runner
async function compressDocument(bytes, compLevel, onProgress) {
    if (compLevel === 'lossless') {
        if (onProgress) onProgress(0.3, 'Parsing vector object stream...');
        const doc = await window.PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
        doc.setProducer('PDFPals');
        doc.setCreator('PDFPals');
        if (onProgress) onProgress(0.8, 'Compacting cross-reference streams...');
        // Lossless stream compression with object streams enabled
        const out = await doc.save({ useObjectStreams: true, addDefaultPage: false });
        if (onProgress) onProgress(1.0, 'Optimization complete');
        return out;
    }

    // Raster image compression options
    let scale = 1.4;
    let quality = 0.65;

    if (compLevel === 'extreme') {
        scale = 1.0;
        quality = 0.45;
    } else if (compLevel === 'recommended') {
        scale = 1.4;
        quality = 0.65;
    }

    const loadingTask = pdfjsLib.getDocument({ data: bytes.slice(0) });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    const newDoc = await window.PDFLib.PDFDocument.create();

    for (let i = 1; i <= numPages; i++) {
        if (onProgress) {
            onProgress((i - 1) / numPages, `Compressing page ${i} of ${numPages}...`);
        }

        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: scale });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;

        const imgDataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64Data = imgDataUrl.substring(imgDataUrl.indexOf(',') + 1);
        const raw = window.atob(base64Data);
        const rawLength = raw.length;
        const array = new Uint8Array(new ArrayBuffer(rawLength));
        for (let j = 0; j < rawLength; j++) {
            array[j] = raw.charCodeAt(j);
        }

        const img = await newDoc.embedJpg(array);
        const newPage = newDoc.addPage([viewport.width, viewport.height]);
        newPage.drawImage(img, {
            x: 0,
            y: 0,
            width: viewport.width,
            height: viewport.height,
        });
    }

    newDoc.setProducer('PDFPals');
    newDoc.setCreator('PDFPals');
    const outBytes = await newDoc.save({ useObjectStreams: true });
    if (onProgress) onProgress(1.0, 'Saving compressed PDF...');
    return outBytes;
}

// Single Apply
applyBtn.addEventListener('click', async () => {
    if (!singleBytes) return;

    applyBtn.disabled = true;
    applyBtn.classList.add('hidden');
    pContainer.classList.remove('hidden');

    try {
        const checkedRadio = document.querySelector('input[name="compression"]:checked');
        const compLevel = checkedRadio ? checkedRadio.value : 'lossless';

        const outBytes = await compressDocument(singleBytes, compLevel, (pct, status) => {
            pBar.style.width = `${Math.round(pct * 100)}%`;
            pText.textContent = status;
        });

        const origSize = singleBytes.length;
        const newSize = outBytes.length;
        const savings = Math.round(((origSize - newSize) / origSize) * 100);
        const savingsText = savings > 0 ? `Saved ${savings}%` : 'Optimized streams';

        resultBadge.style.display = 'block';
        resultBadge.innerHTML = `🎉 <b>Complete!</b> ${formatBytes(origSize)} ➔ <b>${formatBytes(newSize)}</b> (${savingsText})`;

        const blob = new Blob([outBytes], { type: 'application/pdf' });
        const outFileName = singleFile.name.replace(/\.pdf$/i, '_compressed.pdf');

        if (window.MobileBridge) {
            await window.MobileBridge.saveFile(blob, outFileName);
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = outFileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        // Cross-tool workflow chaining
        if (window.WorkflowBridge && pipelineNext) {
            window.WorkflowBridge.renderNextActionBar({
                container: pipelineNext,
                pdfBytes: outBytes,
                fileName: outFileName
            });
        }
    } catch (e) {
        console.error(e);
        alert('Failed to compress PDF: ' + e.message);
    } finally {
        applyBtn.disabled = false;
        applyBtn.classList.remove('hidden');
        pContainer.classList.add('hidden');
        pBar.style.width = '0%';
    }
});

// Batch Logic
async function handleBatchFiles(files) {
    dropZone.classList.add('hidden');
    workspace.classList.add('hidden');
    batchWorkspace.classList.remove('hidden');

    for (const file of files) {
        try {
            const buffer = await file.arrayBuffer();
            batchFiles.push({
                file,
                name: file.name,
                size: file.size,
                bytes: new Uint8Array(buffer)
            });
        } catch (err) {
            console.warn('Batch file read error:', file.name, err);
        }
    }

    renderBatchUI();
}

function renderBatchUI() {
    batchTitle.textContent = `Batch Compression (${batchFiles.length} files)`;
    batchList.innerHTML = '';

    batchFiles.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'batch-item';

        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.8rem; min-width: 0; flex: 1;">
                <span style="font-size: 1.4rem;">📄</span>
                <div style="min-width: 0;">
                    <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.name}">${item.name}</div>
                    <div style="font-size: 0.8rem; opacity: 0.6;">${formatBytes(item.size)}</div>
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.8rem;">
                <span class="batch-stat-badge">Ready</span>
                <button type="button" class="btn secondary outline small remove-b-btn" style="border-radius: 8px; color: #ef4444;" title="Remove">✕</button>
            </div>
        `;

        div.querySelector('.remove-b-btn').onclick = () => {
            batchFiles.splice(idx, 1);
            if (batchFiles.length === 0) {
                batchReset();
            } else {
                renderBatchUI();
            }
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
    if (batchFiles.length === 0) return;

    batchApplyBtn.disabled = true;
    batchPContainer.classList.remove('hidden');

    try {
        if (!window.JSZip) throw new Error('JSZip is required for batch export');
        const zip = new window.JSZip();

        const checkedRadio = document.querySelector('input[name="batch-compression"]:checked');
        const compLevel = checkedRadio ? checkedRadio.value : 'lossless';

        for (let i = 0; i < batchFiles.length; i++) {
            const item = batchFiles[i];
            const filePctBase = i / batchFiles.length;
            const filePctSlice = 1 / batchFiles.length;

            batchPText.textContent = `[${i + 1}/${batchFiles.length}] Compacting: ${item.name}...`;
            batchPBar.style.width = `${Math.round(filePctBase * 100)}%`;

            const outBytes = await compressDocument(item.bytes, compLevel, (progress) => {
                const totalPct = (filePctBase + progress * filePctSlice) * 100;
                batchPBar.style.width = `${Math.round(totalPct)}%`;
            });

            const outName = item.name.replace(/\.pdf$/i, '_compressed.pdf');
            zip.file(outName, outBytes);
        }

        batchPText.textContent = 'Packaging ZIP archive...';
        const zipBlob = await zip.generateAsync({ type: 'blob' });

        if (window.MobileBridge) {
            await window.MobileBridge.saveFile(zipBlob, 'compressed_documents.zip');
        } else {
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'compressed_documents.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        alert(`Successfully compressed ${batchFiles.length} documents!`);
    } catch (err) {
        console.error(err);
        alert('Batch compression error: ' + err.message);
    } finally {
        batchApplyBtn.disabled = false;
        batchPContainer.classList.add('hidden');
        batchPBar.style.width = '0%';
    }
};
