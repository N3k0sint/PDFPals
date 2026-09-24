import * as pdfjsLib from '../vendor/pdfjs-dist/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '../vendor/pdfjs-dist/build/pdf.worker.mjs';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.browse-btn');
const workspace = document.getElementById('workspace');
const loading = document.getElementById('loading');
const fileNameSpan = document.getElementById('file-name');
const pageGrid = document.getElementById('page-grid');
const exportBtn = document.getElementById('export-btn');
const resetBtn = document.getElementById('reset-btn');
const addBlankPageBtn = document.getElementById('add-blank-page-btn');
const changePdfBtn = document.getElementById('change-pdf-btn');
const pipelineNext = document.getElementById('pipeline-next-container');

const addMoreBtn = document.getElementById('add-more-btn');
const addMoreInput = document.getElementById('add-more-input');

// Modal Elements
const passwordModal = document.getElementById('password-modal');
const passwordInput = document.getElementById('pdf-password');
const submitPasswordBtn = document.getElementById('submit-password-btn');
const cancelPasswordBtn = document.getElementById('cancel-password-btn');

let sourceDocuments = []; // Array of { id: string, bytes: Uint8Array, password: str, name: str }
let pages = []; // Array to store page data: { sourceDocId, originalIndex, imgData, fileName }
let nextDocId = 1;
let currentPendingDoc = null; // Used when waiting for password

// --- Event Listeners: Drag & Drop Files ---
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
    if (e.dataTransfer.files.length > 0) {
        handleFiles(Array.from(e.dataTransfer.files));
    }
});

browseBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFiles(Array.from(e.target.files));
    }
});

if (addMoreBtn && addMoreInput) {
    addMoreBtn.addEventListener('click', () => addMoreInput.click());
    addMoreInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            handleFiles(Array.from(e.target.files));
        }
    });
}

if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
        if (sourceDocuments.length > 0) {
            pageGrid.innerHTML = '';
            pages = [];
            loading.classList.remove('hidden');

            for (const doc of sourceDocuments) {
                await loadPdf(doc.bytes, doc.id, doc.password, doc.name);
            }

            renderGrid();
            loading.classList.add('hidden');
        }
    });
}

exportBtn.addEventListener('click', generatePdf);

function createBlankThumbnail() {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 280;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
    ctx.setLineDash([]);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('📄 Blank Page', canvas.width / 2, canvas.height / 2);
    return canvas.toDataURL('image/png');
}

if (addBlankPageBtn) {
    addBlankPageBtn.addEventListener('click', () => {
        const blankPage = {
            sourceDocId: 'blank_' + Date.now(),
            originalIndex: -1,
            isBlank: true,
            imgData: createBlankThumbnail(),
            fileName: 'Blank Page'
        };
        pages.push(blankPage);
        renderGrid();
    });
}


// Incoming Workflow Pipeline check
if (window.WorkflowBridge) {
    window.WorkflowBridge.checkIncomingPipeline((incomingFile) => {
        handleFiles([incomingFile]);
    });
}

// --- Core Logic ---

async function handleFiles(files) {
    const validFiles = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (validFiles.length === 0) {
        alert('Please select valid PDF files.');
        return;
    }

    if (pipelineNext) pipelineNext.innerHTML = '';

    dropZone.classList.add('hidden');
    loading.classList.remove('hidden');
    workspace.classList.add('hidden');

    for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i];
        const loadingP = loading.querySelector('p');
        if (loadingP) {
            loadingP.textContent = `Analyzing Document ${i + 1} of ${validFiles.length}: ${file.name}...`;
        }

        try {
            const arrayBuffer = await file.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            const docId = `doc_${nextDocId++}_${Date.now()}`;

            const success = await loadPdf(bytes, docId, '', file.name);
            if (success) {
                sourceDocuments.push({ 
                    id: docId, 
                    bytes: bytes.slice(0), 
                    password: '', 
                    name: file.name 
                });
            }
        } catch (error) {
            console.error("Error loading PDF:", error);
            alert(`Could not load ${file.name}: ${error.message}`);
        }
    }

    fileNameSpan.textContent = `${sourceDocuments.length} file${sourceDocuments.length === 1 ? '' : 's'}`;

    renderGrid();

    if (passwordModal.classList.contains('hidden')) {
        loading.classList.add('hidden');
        workspace.classList.remove('hidden');
    }
}

async function loadPdf(pdfBytes, docId, password = '', fileName = '') {
    try {
        const loadingTask = pdfjsLib.getDocument({
            data: pdfBytes.slice(0),
            password: password
        });

        const pdfjsDoc = await loadingTask.promise;
        const numPages = pdfjsDoc.numPages;
        const tempPages = [];

        for (let i = 1; i <= numPages; i++) {
            const page = await pdfjsDoc.getPage(i);
            const viewport = page.getViewport({ scale: 0.5 });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            tempPages.push({
                sourceDocId: docId,
                originalIndex: i - 1,
                imgData: canvas.toDataURL(),
                fileName: fileName
            });
        }

        // Commit pages atomically only when all pages in this document succeed
        pages.push(...tempPages);
        return true;
    } catch (error) {
        if (error.name === 'PasswordException' || (error.message && error.message.includes('PasswordException'))) {
            loading.classList.add('hidden');
            passwordModal.classList.remove('hidden');
            passwordInput.focus();

            currentPendingDoc = { bytes: pdfBytes.slice(0), id: docId, name: fileName };
            return false;
        } else {
            console.error("Error rendering PDF:", error);
            throw error;
        }
    }
}

// --- Password Modal Logic ---

submitPasswordBtn.addEventListener('click', async () => {
    const pwd = passwordInput.value;
    if (pwd && currentPendingDoc) {
        passwordModal.classList.add('hidden');
        loading.classList.remove('hidden');

        const success = await loadPdf(currentPendingDoc.bytes, currentPendingDoc.id, pwd, currentPendingDoc.name);
        if (success) {
            sourceDocuments.push({
                id: currentPendingDoc.id,
                bytes: currentPendingDoc.bytes,
                password: pwd,
                name: currentPendingDoc.name
            });
            currentPendingDoc = null;
            renderGrid();
            loading.classList.add('hidden');
            workspace.classList.remove('hidden');
        }
    }
});

passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        submitPasswordBtn.click();
    }
});

cancelPasswordBtn.addEventListener('click', () => {
    passwordModal.classList.add('hidden');
    passwordInput.value = '';
    currentPendingDoc = null;
    if (sourceDocuments.length > 0) {
        workspace.classList.remove('hidden');
    } else {
        dropZone.classList.remove('hidden');
    }
});

if (changePdfBtn) {
    changePdfBtn.onclick = () => {
        sourceDocuments = [];
        pages = [];
        pageGrid.innerHTML = '';
        dropZone.classList.remove('hidden');
        workspace.classList.add('hidden');
        fileInput.value = '';
        if (addMoreInput) addMoreInput.value = '';
        fileNameSpan.textContent = '';
        if (pipelineNext) pipelineNext.innerHTML = '';
        stopAutoScroll();
    };
}

// ========================================================
// --- AUTO-SCROLL ENGINE FOR DRAG AND DROP ---
// ========================================================
let autoScrollTimer = null;
let autoScrollSpeed = 0;

function updateAutoScroll(clientY) {
    if (!draggedItem) return;

    const threshold = 140; // Zone in pixels from top/bottom edge
    const maxSpeed = 24;   // Max scroll speed per frame
    const viewportHeight = window.innerHeight;

    if (clientY < threshold) {
        // Dragging near top of viewport -> Scroll UP
        const factor = (threshold - clientY) / threshold;
        autoScrollSpeed = -Math.max(4, Math.round(factor * maxSpeed));
    } else if (clientY > viewportHeight - threshold) {
        // Dragging near bottom of viewport -> Scroll DOWN
        const factor = (clientY - (viewportHeight - threshold)) / threshold;
        autoScrollSpeed = Math.max(4, Math.round(factor * maxSpeed));
    } else {
        autoScrollSpeed = 0;
    }

    if (autoScrollSpeed !== 0 && !autoScrollTimer) {
        stepAutoScroll();
    } else if (autoScrollSpeed === 0 && autoScrollTimer) {
        stopAutoScroll();
    }
}

function stepAutoScroll() {
    if (autoScrollSpeed === 0 || !draggedItem) {
        stopAutoScroll();
        return;
    }

    window.scrollBy({ top: autoScrollSpeed, behavior: 'auto' });
    autoScrollTimer = requestAnimationFrame(stepAutoScroll);
}

function stopAutoScroll() {
    if (autoScrollTimer) {
        cancelAnimationFrame(autoScrollTimer);
        autoScrollTimer = null;
    }
    autoScrollSpeed = 0;
}

// Track mouse drag position anywhere across the document
document.addEventListener('dragover', (e) => {
    if (draggedItem) {
        e.preventDefault();
        updateAutoScroll(e.clientY);
    }
});

// Enable mouse wheel scrolling while holding a dragged item
window.addEventListener('wheel', (e) => {
    if (draggedItem) {
        window.scrollBy({ top: e.deltaY, behavior: 'auto' });
    }
}, { passive: true });

// Stop auto-scroll whenever drag ends anywhere
document.addEventListener('dragend', () => {
    stopAutoScroll();
    clearDragStyles();
});

// ========================================================
// --- UI RENDERING & DRAG LOGIC ---
// ========================================================

let draggedItem = null;

function renderGrid() {
    pageGrid.innerHTML = '';

    pages.forEach((pageData, currentIndex) => {
        const pageItem = document.createElement('div');
        pageItem.className = 'page-item';
        pageItem.draggable = true;
        pageItem.dataset.index = currentIndex;

        const thumbnailDiv = document.createElement('div');
        thumbnailDiv.className = 'page-thumbnail';

        const img = document.createElement('img');
        img.src = pageData.imgData;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.draggable = false;
        thumbnailDiv.appendChild(img);

        const pageLabel = document.createElement('div');
        pageLabel.className = 'page-number';
        pageLabel.textContent = `Page ${currentIndex + 1}`;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '✕';
        deleteBtn.title = `Delete Page ${currentIndex + 1}`;
        deleteBtn.setAttribute('aria-label', `Delete Page ${currentIndex + 1}`);
        
        // Prevent drag start on button click
        deleteBtn.onmousedown = (e) => e.stopPropagation();
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            pages.splice(currentIndex, 1);
            renderGrid();
        };

        pageItem.appendChild(deleteBtn);
        pageItem.appendChild(thumbnailDiv);
        pageItem.appendChild(pageLabel);

        // Drag events
        pageItem.addEventListener('dragstart', handleDragStart);
        pageItem.addEventListener('dragover', handleDragOver);
        pageItem.addEventListener('drop', handleDrop);
        pageItem.addEventListener('dragenter', handleDragEnter);
        pageItem.addEventListener('dragleave', handleDragLeave);
        pageItem.addEventListener('dragend', handleDragEnd);

        pageGrid.appendChild(pageItem);
    });
}

function handleDragStart(e) {
    draggedItem = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.index);
    setTimeout(() => this.classList.add('dragging'), 0);
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    updateAutoScroll(e.clientY);
    return false;
}

function handleDragEnter(e) {
    e.preventDefault();
    if (this !== draggedItem) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave() {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    e.stopPropagation();
    this.classList.remove('drag-over');
    stopAutoScroll();

    if (draggedItem && draggedItem !== this) {
        const fromIndex = parseInt(draggedItem.dataset.index, 10);
        const toIndex = parseInt(this.dataset.index, 10);

        if (!isNaN(fromIndex) && !isNaN(toIndex)) {
            const itemToMove = pages.splice(fromIndex, 1)[0];
            pages.splice(toIndex, 0, itemToMove);
            renderGrid();
        }
    }
    return false;
}

function handleDragEnd() {
    stopAutoScroll();
    clearDragStyles();
}

function clearDragStyles() {
    if (draggedItem) {
        draggedItem.classList.remove('dragging');
        draggedItem = null;
    }
    document.querySelectorAll('.page-item').forEach(item => {
        item.classList.remove('drag-over');
        item.classList.remove('dragging');
    });
}

// --- Export Logic ---

async function generatePdf() {
    if (pages.length === 0) {
        alert("There are no pages to export!");
        return;
    }

    exportBtn.disabled = true;
    exportBtn.textContent = 'Processing...';

    try {
        const newDoc = await window.PDFLib.PDFDocument.create();

        // Load all source PDFs into a safe lookup Map
        const loadedSourceDocs = new Map();
        for (const sourceDoc of sourceDocuments) {
            try {
                const loadConfig = sourceDoc.password ? { password: sourceDoc.password } : { ignoreEncryption: true };
                const pdfLibDoc = await window.PDFLib.PDFDocument.load(sourceDoc.bytes.slice(0), loadConfig);
                loadedSourceDocs.set(sourceDoc.id, pdfLibDoc);
            } catch (docErr) {
                console.warn(`Could not load document ${sourceDoc.name}:`, docErr);
            }
        }

        // Copy pages in the new reordered sequence
        let copiedCount = 0;
        for (const pageMetaData of pages) {
            if (pageMetaData.isBlank) {
                // Add fresh blank page matching document dimensions
                const refPage = newDoc.getPageCount() > 0 ? newDoc.getPage(0) : null;
                const width = refPage ? refPage.getWidth() : 595.28;
                const height = refPage ? refPage.getHeight() : 841.89;
                newDoc.addPage([width, height]);
                copiedCount++;
                continue;
            }
            const srcDoc = loadedSourceDocs.get(pageMetaData.sourceDocId);
            if (!srcDoc) {
                console.warn(`Skipping page with missing source document: ${pageMetaData.fileName} (id: ${pageMetaData.sourceDocId})`);
                continue;
            }

            try {
                const [copiedPage] = await newDoc.copyPages(srcDoc, [pageMetaData.originalIndex]);
                if (copiedPage) {
                    newDoc.addPage(copiedPage);
                    copiedCount++;
                }
            } catch (pageErr) {
                console.warn(`Error copying page ${pageMetaData.originalIndex + 1} from ${pageMetaData.fileName}:`, pageErr);
            }
        }

        if (copiedCount === 0) {
            throw new Error("No pages could be extracted from the provided documents. Please re-add the files.");
        }

        newDoc.setProducer('PDFPals');
        newDoc.setCreator('PDFPals');
        const pdfBytes = await newDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        
        const originalName = sourceDocuments[0]?.name || 'document.pdf';
        const fileName = originalName.replace(/\.pdf$/i, '_organized.pdf');

        if (window.MobileBridge) {
            await window.MobileBridge.saveFile(blob, fileName);
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
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
                fileName: fileName
            });
        }

    } catch (error) {
        console.error("FULL EXPORT ERROR:", error);
        alert(`Failed to create the organized PDF: ${error.message}`);
    } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = 'Export Final PDF ➔';
    }
}
