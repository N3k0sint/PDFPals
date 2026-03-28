import * as pdfjsLib from '../vendor/pdfjs-dist/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '../vendor/pdfjs-dist/build/pdf.worker.mjs';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.browse-btn');
const workspace = document.getElementById('workspace');
const loading = document.getElementById('loading');
const pageGrid = document.getElementById('page-grid');
const exportBtn = document.getElementById('export-btn');

const rotateLeftAllBtn = document.getElementById('rotate-left-all');
const rotateRightAllBtn = document.getElementById('rotate-right-all');
const changePdfBtn = document.getElementById('change-pdf-btn');

let originalPdfBytes = null;
let originalFileName = '';
let pdfDoc = null; // pdfjs document
let pages = []; // Array to store page data: { index, canvas, currentRotation }

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
        handleFile(e.dataTransfer.files[0]);
    }
});



fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

rotateLeftAllBtn.addEventListener('click', () => {
    pages.forEach(p => p.currentRotation = (p.currentRotation - 90) % 360);
    renderGrid();
});

rotateRightAllBtn.addEventListener('click', () => {
    pages.forEach(p => p.currentRotation = (p.currentRotation + 90) % 360);
    renderGrid();
});

exportBtn.addEventListener('click', generatePdf);

// --- Core Logic ---

async function handleFile(file) {
    if (file.type !== 'application/pdf') {
        alert('Please select a valid PDF file.');
        return;
    }

    originalFileName = file.name;
    dropZone.classList.add('hidden');
    loading.classList.remove('hidden');
    workspace.classList.add('hidden');

    try {
        const arrayBuffer = await file.arrayBuffer();
        originalPdfBytes = new Uint8Array(arrayBuffer);
        await loadPdf(originalPdfBytes);

        loading.classList.add('hidden');
        workspace.classList.remove('hidden');
    } catch (error) {
        console.error("Error loading PDF:", error);
        alert("Could not load the PDF file. It might be corrupted or protected.");
        loading.classList.add('hidden');
        dropZone.classList.remove('hidden');
    }
}

async function loadPdf(pdfBytes) {
    pageGrid.innerHTML = '';
    pages = [];

    try {
        const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice() });
        pdfDoc = await loadingTask.promise;
        const numPages = pdfDoc.numPages;

        for (let i = 1; i <= numPages; i++) {
            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: 0.5 }); // Thumbnail scale

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };

            await page.render(renderContext).promise;

            // Store original rotation as starting point, though usually 0 in viewer
            pages.push({
                originalIndex: i - 1,
                imgData: canvas.toDataURL(),
                currentRotation: 0
            });
        }

        renderGrid();

        // Hide loading and show workspace
        loading.classList.add('hidden');
        workspace.classList.remove('hidden');

    } catch (error) {
        console.error("Error rendering PDF:", error);
        alert("Could not render the PDF file. It might be corrupted.");
        loading.classList.add('hidden');
        dropZone.classList.remove('hidden');
    }
}

// --- UI Rendering ---

function renderGrid() {
    pageGrid.innerHTML = '';

    pages.forEach((pageData, currentIndex) => {
        const pageItem = document.createElement('div');
        pageItem.className = 'page-item';

        const thumbnailDiv = document.createElement('div');
        thumbnailDiv.className = 'page-thumbnail';

        const img = document.createElement('img');
        img.src = pageData.imgData;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        // Apply visual rotation CSS
        img.style.transform = `rotate(${pageData.currentRotation}deg)`;

        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'rotate-controls';

        const leftBtn = document.createElement('button');
        leftBtn.className = 'rotate-btn';
        leftBtn.innerHTML = '↺';
        leftBtn.onclick = () => {
            pageData.currentRotation = (pageData.currentRotation - 90) % 360;
            renderGrid();
        };

        const rightBtn = document.createElement('button');
        rightBtn.className = 'rotate-btn';
        rightBtn.innerHTML = '↻';
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
        pageLabel.textContent = `Page ${currentIndex + 1}`;

        pageItem.appendChild(thumbnailDiv);
        pageItem.appendChild(pageLabel);

        pageGrid.appendChild(pageItem);
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
        const sourceDoc = await window.PDFLib.PDFDocument.load(originalPdfBytes);
        const sourcePages = sourceDoc.getPages();

        // Apply physical rotation using pdf-lib
        pages.forEach(pData => {
            const page = sourcePages[pData.originalIndex];
            const currentDocRotation = page.getRotation().angle;

            // Normalize current visual rotation (e.g. -90 becomes 270)
            let visualRot = pData.currentRotation;
            if (visualRot < 0) visualRot += 360;

            const newRotation = (currentDocRotation + visualRot) % 360;
            page.setRotation(window.PDFLib.degrees(newRotation));
        });

        sourceDoc.setProducer('PDFPals');
        sourceDoc.setCreator('PDFPals');
        const pdfBytes = await sourceDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = originalFileName.replace('.pdf', '_rotated.pdf');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error("FULL EXPORT ERROR:", error);
        alert(`Failed to create the rotated PDF.`);
    } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = 'Apply Rotation & Download';
    }
}

if (changePdfBtn) {
    changePdfBtn.onclick = () => {
        originalPdfBytes = null;
        pages = [];
        pageGrid.innerHTML = '';
        dropZone.classList.remove('hidden');
        workspace.classList.add('hidden');
        fileInput.value = '';
    };
}




browseBtn.addEventListener('click', () => fileInput.click());
