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
const changePdfBtn = document.getElementById('change-pdf-btn');

const addMoreBtn = document.getElementById('add-more-btn');
const addMoreInput = document.getElementById('add-more-input');

// Modal Elements
const passwordModal = document.getElementById('password-modal');
const passwordInput = document.getElementById('pdf-password');
const submitPasswordBtn = document.getElementById('submit-password-btn');
const cancelPasswordBtn = document.getElementById('cancel-password-btn');

let sourceDocuments = []; // Array of { id: string, bytes: Uint8Array, password: str, name: str }
let pages = []; // Array to store page data: { sourceDocId, originalIndex, imgData }
let nextDocId = 1;
let currentPendingDoc = null; // Used when waiting for password

// --- Event Listeners: Drag & Drop ---
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

addMoreBtn.addEventListener('click', () => addMoreInput.click());
addMoreInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFiles(Array.from(e.target.files));
    }
});

resetBtn.addEventListener('click', async () => {
    if (sourceDocuments.length > 0) {
        // Clear pages and reload all original docs
        pageGrid.innerHTML = '';
        pages = [];
        loading.classList.remove('hidden');

        for (const doc of sourceDocuments) {
            await loadPdf(doc.bytes, doc.id, doc.password);
        }

        renderGrid();
        loading.classList.add('hidden');
    }
});

exportBtn.addEventListener('click', generatePdf);

// --- Core Logic ---

// --- Core Logic ---

async function handleFiles(files) {
    const validFiles = files.filter(f => f.type === 'application/pdf');
    if (validFiles.length === 0) {
        alert('Please select valid PDF files.');
        return;
    }

    if (sourceDocuments.length === 0) {
        fileNameSpan.textContent = validFiles.length === 1 ? validFiles[0].name : `${validFiles.length} files`;
    } else {
        fileNameSpan.textContent = `${sourceDocuments.length + validFiles.length} files`;
    }

    dropZone.classList.add('hidden');
    loading.classList.remove('hidden');
    workspace.classList.add('hidden');

    for (const file of validFiles) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const bytes = new Uint8Array(arrayBuffer);
            const docId = `doc_${nextDocId++}`;

            // Note: If loadPdf fails due to password, it will trigger modal and return gracefully
            // but we need to wait manually to not overlap processing. 
            // In a robust implementation we might queue them, but for now we process sequentially.
            const success = await loadPdf(bytes, docId, '', file.name);
            if (success) {
                sourceDocuments.push({ id: docId, bytes: bytes, password: '', name: file.name });
            }
        } catch (error) {
            console.error("Error loading PDF:", error);
            alert(`Could not load ${file.name}. It might be corrupted.`);
        }
    }

    renderGrid();

    // Only hide if we aren't waiting for a password modal
    if (passwordModal.classList.contains('hidden')) {
        loading.classList.add('hidden');
        workspace.classList.remove('hidden');
    }
}

async function loadPdf(pdfBytes, docId, password = '', fileName = '') {
    try {
        const loadingTask = pdfjsLib.getDocument({
            data: pdfBytes.slice(),
            password: password
        });

        const pdfjsDoc = await loadingTask.promise;
        const numPages = pdfjsDoc.numPages;

        for (let i = 1; i <= numPages; i++) {
            const page = await pdfjsDoc.getPage(i);
            const viewport = page.getViewport({ scale: 0.5 });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            pages.push({
                sourceDocId: docId,
                originalIndex: i - 1,
                imgData: canvas.toDataURL(),
                fileName: fileName
            });
        }
        return true;
    } catch (error) {
        if (error.name === 'PasswordException' || (error.message && error.message.includes('PasswordException'))) {
            loading.classList.add('hidden');
            passwordModal.classList.remove('hidden');
            passwordInput.focus();

            // Set pending so the modal system knows what to retry
            currentPendingDoc = { bytes: pdfBytes, id: docId, name: fileName };
            return false;
        } else {
            console.error("Error rendering PDF:", error);
            throw error;
        }
    }
}

// --- Password Modal Logic ---

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
        // If it fails again, loadPdf will pop the modal back up.
    }
});

// Allow hitting Enter in the password field
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
        addMoreInput.value = '';
        fileNameSpan.textContent = '';
    };
}

// --- UI Rendering & Drag Logic ---

function renderGrid() {
    pageGrid.innerHTML = '';

    pages.forEach((pageData, currentIndex) => {
        const pageItem = document.createElement('div');
        pageItem.className = 'page-item';
        pageItem.draggable = true;
        pageItem.dataset.index = currentIndex; // Current array index

        const thumbnailDiv = document.createElement('div');
        thumbnailDiv.className = 'page-thumbnail';

        const img = document.createElement('img');
        img.src = pageData.imgData;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        thumbnailDiv.appendChild(img);

        const pageLabel = document.createElement('div');
        pageLabel.className = 'page-number';
        pageLabel.textContent = `Page ${currentIndex + 1}`;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Remove Page';
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

let draggedItem = null;

function handleDragStart(e) {
    draggedItem = this;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => this.classList.add('dragging'), 0);
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
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

    if (draggedItem !== this) {
        const fromIndex = parseInt(draggedItem.dataset.index);
        const toIndex = parseInt(this.dataset.index);

        // Move item in array
        const itemToMove = pages.splice(fromIndex, 1)[0];
        pages.splice(toIndex, 0, itemToMove);

        renderGrid(); // Re-render to update UI and indices
    }
    return false;
}

function handleDragEnd() {
    this.classList.remove('dragging');
    const items = document.querySelectorAll('.page-item');
    items.forEach(item => item.classList.remove('drag-over'));
}

// --- Export Logic ---

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

        // Load all source PDFs into objects we can copy from
        // Cache them so we don't reload the same document 50 times
        const loadedSourceDocs = {};
        for (const sourceDoc of sourceDocuments) {
            const loadConfig = {};
            if (sourceDoc.password) {
                loadConfig.password = sourceDoc.password;
            } else {
                loadConfig.ignoreEncryption = true;
            }
            loadedSourceDocs[sourceDoc.id] = await window.PDFLib.PDFDocument.load(sourceDoc.bytes, loadConfig);
        }

        // Iterate through our dragged & dropped pages
        for (const pageMetaData of pages) {
            const srcDocId = pageMetaData.sourceDocId;
            const srcIndex = pageMetaData.originalIndex;

            const srcDoc = loadedSourceDocs[srcDocId];
            const [copiedPage] = await newDoc.copyPages(srcDoc, [srcIndex]);
            newDoc.addPage(copiedPage);
        }

        // Save and Download
        newDoc.setProducer('PDFPals');
        newDoc.setCreator('PDFPals');
        const pdfBytes = await newDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        
        const originalName = sourceDocuments[0].name || 'document.pdf';
        const fileName = originalName.replace('.pdf', '_organized.pdf');
        await MobileBridge.saveFile(blob, fileName);

    } catch (error) {
        console.error("FULL EXPORT ERROR:", error);
        alert(`Failed to create the organized PDF. ${error.message}`);
    } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = 'Organize & Download PDF';
    }
}

