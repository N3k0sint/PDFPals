import * as pdfjsLib from '../vendor/pdfjs-dist/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '../vendor/pdfjs-dist/build/pdf.worker.mjs';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.browse-btn');
const workspace = document.getElementById('workspace');
const batchWorkspace = document.getElementById('batch-workspace');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loading-text');
const pageGrid = document.getElementById('page-grid');
const exportBtn = document.getElementById('export-btn');
const pipelineNext = document.getElementById('pipeline-next-container');

// Single mode buttons
const rotateLeftAllBtn = document.getElementById('rotate-left-all');
const rotateRightAllBtn = document.getElementById('rotate-right-all');
const changePdfBtn = document.getElementById('change-pdf-btn');

// Batch mode elements
const batchTitle = document.getElementById('batch-title');
const batchList = document.getElementById('batch-list');
const batchSummary = document.getElementById('batch-summary');
const batchExportBtn = document.getElementById('batch-export-btn');
const batchRotLeftBtn = document.getElementById('batch-rot-left');
const batchRotRightBtn = document.getElementById('batch-rot-right');
const batchRot180Btn = document.getElementById('batch-rot-180');
const batchAddMoreBtn = document.getElementById('batch-add-more');
const batchResetBtn = document.getElementById('batch-reset');

let originalPdfBytes = null;
let originalFileName = '';
let pdfDoc = null; // pdfjs document
let pages = []; // Array of page data: { index, canvas, currentRotation }

// Batch state
let batchFiles = []; // Array of { file, name, size, bytes, pageCount, rotation }

function formatBytes(bytes, decimals = 1) {
    if (!+bytes) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// --- Drag & Drop ---
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
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (droppedFiles.length > 0) {
        handleIncomingFiles(droppedFiles);
    }
});

browseBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length > 0) {
        handleIncomingFiles(selected);
    }
});

// Check incoming pipeline from another tool
if (window.WorkflowBridge) {
    window.WorkflowBridge.checkIncomingPipeline((incomingFile) => {
        handleIncomingFiles([incomingFile]);
    });
}

function handleIncomingFiles(fileList) {
    if (pipelineNext) pipelineNext.innerHTML = '';

    if (fileList.length === 1 && batchFiles.length === 0) {
        // Single file mode
        handleSingleFile(fileList[0]);
    } else {
        // Batch mode
        addFilesToBatch(fileList);
    }
}

// --- Single File Mode Logic ---
async function handleSingleFile(file) {
    originalFileName = file.name;
    dropZone.classList.add('hidden');
    batchWorkspace.classList.add('hidden');
    workspace.classList.add('hidden');
    loading.classList.remove('hidden');
    if (loadingText) loadingText.textContent = 'Rendering preview pages...';

    try {
        const arrayBuffer = await file.arrayBuffer();
        originalPdfBytes = new Uint8Array(arrayBuffer);
        await loadPdf(originalPdfBytes);

        loading.classList.add('hidden');
        workspace.classList.remove('hidden');
    } catch (error) {
        console.error("Error loading PDF:", error);
        alert("Could not load the PDF file. It might be password-protected or corrupted.");
        loading.classList.add('hidden');
        dropZone.classList.remove('hidden');
    }
}

async function loadPdf(pdfBytes) {
    pageGrid.innerHTML = '';
    pages = [];

    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice() });
    pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    for (let i = 1; i <= numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const viewport = page.getViewport({ scale: 0.5 });

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport }).promise;

        pages.push({
            originalIndex: i - 1,
            imgData: canvas.toDataURL(),
            currentRotation: 0
        });
    }

    renderGrid();
}

function renderGrid() {
    pageGrid.innerHTML = '';

    pages.forEach((pageData, currentIndex) => {
        const pageItem = document.createElement('div');
        pageItem.className = 'page-item';

        const thumbnailDiv = document.createElement('div');
        thumbnailDiv.className = 'page-thumbnail';
        thumbnailDiv.style.position = 'relative';
        thumbnailDiv.style.overflow = 'hidden';
        thumbnailDiv.style.display = 'flex';
        thumbnailDiv.style.alignItems = 'center';
        thumbnailDiv.style.justifyContent = 'center';
        thumbnailDiv.style.minHeight = '180px';

        const img = document.createElement('img');
        img.src = pageData.imgData;
        img.style.maxWidth = '100%';
        img.style.maxHeight = '240px';
        img.style.objectFit = 'contain';
        img.style.transition = 'transform 0.25s ease';
        img.style.transform = `rotate(${pageData.currentRotation}deg)`;

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'rotate-controls';

        const leftBtn = document.createElement('button');
        leftBtn.className = 'rotate-btn';
        leftBtn.innerHTML = '↺';
        leftBtn.title = 'Rotate 90° CCW';
        leftBtn.onclick = () => {
            pageData.currentRotation = (pageData.currentRotation - 90 + 360) % 360;
            renderGrid();
        };

        const rightBtn = document.createElement('button');
        rightBtn.className = 'rotate-btn';
        rightBtn.innerHTML = '↻';
        rightBtn.title = 'Rotate 90° CW';
        rightBtn.onclick = () => {
            pageData.currentRotation = (pageData.currentRotation + 90) % 360;
            renderGrid();
        };

        controlsDiv.appendChild(leftBtn);
        controlsDiv.appendChild(rightBtn);

        thumbnailDiv.appendChild(img);
        thumbnailDiv.appendChild(controlsDiv);

        const pageLabel = document.createElement('div');
        pageLabel.className = 'page-number';
        pageLabel.style.textAlign = 'center';
        pageLabel.style.marginTop = '0.8rem';
        pageLabel.style.fontWeight = '600';
        pageLabel.style.fontSize = '0.9rem';
        pageLabel.textContent = `Page ${currentIndex + 1} (${pageData.currentRotation}°)`;

        pageItem.appendChild(thumbnailDiv);
        pageItem.appendChild(pageLabel);
        pageGrid.appendChild(pageItem);
    });
}

rotateLeftAllBtn.addEventListener('click', () => {
    pages.forEach(p => p.currentRotation = (p.currentRotation - 90 + 360) % 360);
    renderGrid();
});

rotateRightAllBtn.addEventListener('click', () => {
    pages.forEach(p => p.currentRotation = (p.currentRotation + 90) % 360);
    renderGrid();
});

exportBtn.addEventListener('click', async () => {
    if (pages.length === 0) return;

    exportBtn.disabled = true;
    exportBtn.textContent = 'Applying Rotation...';

    try {
        const sourceDoc = await window.PDFLib.PDFDocument.load(originalPdfBytes);
        const sourcePages = sourceDoc.getPages();

        pages.forEach(pData => {
            const page = sourcePages[pData.originalIndex];
            const currentDocRotation = page.getRotation().angle;
            let visualRot = pData.currentRotation;
            if (visualRot < 0) visualRot += 360;
            const newRotation = (currentDocRotation + visualRot) % 360;
            page.setRotation(window.PDFLib.degrees(newRotation));
        });

        sourceDoc.setProducer('PDFPals');
        sourceDoc.setCreator('PDFPals');
        const pdfBytes = await sourceDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const outName = originalFileName.replace(/\.pdf$/i, '_rotated.pdf');

        if (window.MobileBridge) {
            await window.MobileBridge.saveFile(blob, outName);
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = outName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        // Cross-tool workflow chaining
        if (window.WorkflowBridge && pipelineNext) {
            window.WorkflowBridge.renderNextActionBar({
                container: pipelineNext,
                pdfBytes: pdfBytes,
                fileName: outName
            });
        }
    } catch (error) {
        console.error("Export error:", error);
        alert("Failed to create the rotated PDF.");
    } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = 'Save Rotated PDF ➔';
    }
});

changePdfBtn.onclick = () => {
    originalPdfBytes = null;
    pages = [];
    pageGrid.innerHTML = '';
    dropZone.classList.remove('hidden');
    workspace.classList.add('hidden');
    batchWorkspace.classList.add('hidden');
    fileInput.value = '';
    if (pipelineNext) pipelineNext.innerHTML = '';
};

// --- Batch Mode Logic ---
async function addFilesToBatch(files) {
    dropZone.classList.add('hidden');
    workspace.classList.add('hidden');
    batchWorkspace.classList.remove('hidden');
    loading.classList.remove('hidden');

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (loadingText) loadingText.textContent = `Analyzing file ${i + 1} of ${files.length}...`;
        try {
            const buffer = await file.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            const pdfDoc = await window.PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
            const pageCount = pdfDoc.getPageCount();

            batchFiles.push({
                file,
                name: file.name,
                size: file.size,
                bytes,
                pageCount,
                rotation: 90 // Default 90° CW rotation for batch
            });
        } catch (err) {
            console.warn('Could not parse file in batch:', file.name, err);
        }
    }

    loading.classList.add('hidden');
    renderBatchUI();
}

function renderBatchUI() {
    batchTitle.textContent = `Batch Queue (${batchFiles.length} files)`;
    batchSummary.textContent = `${batchFiles.length} file${batchFiles.length === 1 ? '' : 's'} queued for rotation`;
    batchList.innerHTML = '';

    batchFiles.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'batch-item';

        div.innerHTML = `
            <div class="batch-file-info">
                <span style="font-size: 1.6rem;">📄</span>
                <div style="min-width: 0;">
                    <div class="batch-file-name" title="${item.name}">${item.name}</div>
                    <div class="batch-file-meta">${formatBytes(item.size)} • ${item.pageCount} page${item.pageCount === 1 ? '' : 's'}</div>
                </div>
            </div>
            <div class="batch-controls">
                <span class="badge-rot">+${item.rotation}°</span>
                <button type="button" class="btn secondary small rotate-single-btn" style="border-radius: 8px;" title="Rotate 90° CW">↻ +90°</button>
                <button type="button" class="btn secondary outline small remove-single-btn" style="border-radius: 8px; color: #ef4444;" title="Remove">✕</button>
            </div>
        `;

        div.querySelector('.rotate-single-btn').onclick = () => {
            item.rotation = (item.rotation + 90) % 360;
            renderBatchUI();
        };

        div.querySelector('.remove-single-btn').onclick = () => {
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

batchRotLeftBtn.onclick = () => {
    batchFiles.forEach(f => f.rotation = (f.rotation - 90 + 360) % 360);
    renderBatchUI();
};

batchRotRightBtn.onclick = () => {
    batchFiles.forEach(f => f.rotation = (f.rotation + 90) % 360);
    renderBatchUI();
};

batchRot180Btn.onclick = () => {
    batchFiles.forEach(f => f.rotation = (f.rotation + 180) % 360);
    renderBatchUI();
};

batchAddMoreBtn.onclick = () => fileInput.click();

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

batchExportBtn.onclick = async () => {
    if (batchFiles.length === 0) return;

    batchExportBtn.disabled = true;
    batchExportBtn.textContent = 'Rotating Files...';
    loading.classList.remove('hidden');

    try {
        if (!window.JSZip) {
            throw new Error('JSZip library not found');
        }

        const zip = new window.JSZip();

        for (let i = 0; i < batchFiles.length; i++) {
            const item = batchFiles[i];
            if (loadingText) loadingText.textContent = `Rotating ${i + 1} of ${batchFiles.length}: ${item.name}...`;

            const doc = await window.PDFLib.PDFDocument.load(item.bytes);
            const docPages = doc.getPages();

            docPages.forEach(p => {
                const currentAngle = p.getRotation().angle;
                p.setRotation(window.PDFLib.degrees((currentAngle + item.rotation) % 360));
            });

            doc.setProducer('PDFPals');
            doc.setCreator('PDFPals');
            const rotatedBytes = await doc.save();
            const cleanName = item.name.replace(/\.pdf$/i, `_rotated_${item.rotation}deg.pdf`);
            zip.file(cleanName, rotatedBytes);
        }

        if (loadingText) loadingText.textContent = 'Packaging ZIP archive...';
        const zipBlob = await zip.generateAsync({ type: 'blob' });

        if (window.MobileBridge) {
            await window.MobileBridge.saveFile(zipBlob, 'rotated_documents.zip');
        } else {
            const url = URL.createObjectURL(zipBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'rotated_documents.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        alert(`Successfully rotated and packaged ${batchFiles.length} files!`);
    } catch (err) {
        console.error('Batch rotation error:', err);
        alert('Failed to process batch rotation: ' + err.message);
    } finally {
        loading.classList.add('hidden');
        batchExportBtn.disabled = false;
        batchExportBtn.textContent = 'Rotate & Download ZIP ➔';
    }
};
