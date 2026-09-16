import * as pdfjsLib from '../vendor/pdfjs-dist/build/pdf.mjs';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '../vendor/pdfjs-dist/build/pdf.worker.mjs';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.browse-btn');
const controls = document.getElementById('controls');
const workspace = document.getElementById('workspace');
const previewContainer = document.getElementById('preview-container');
const loading = document.getElementById('loading');
const fileNameDisplay = document.getElementById('file-name');
const pageCountDisplay = document.getElementById('page-count');
const downloadAllBtn = document.getElementById('download-all-btn');
const resetBtn = document.getElementById('reset-btn');
const addMoreBtn = document.getElementById('add-more-btn');

let renderedPages = []; // Stores data URLs
let loadedPdfNames = [];
let isAddingMore = false;

// Event Listeners
if (addMoreBtn) {
    addMoreBtn.addEventListener('click', () => {
        isAddingMore = true;
        fileInput.click();
    });
}

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
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    if (files.length > 0) {
        handleFiles(files, false);
    } else {
        alert('Please upload valid PDF files.');
    }
});

fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) handleFiles(files, isAddingMore);
    isAddingMore = false;
    fileInput.value = '';
});

resetBtn.addEventListener('click', resetApp);

downloadAllBtn.addEventListener('click', downloadAllAsZip);

async function handleFiles(files, isAppend = false) {
    if (!isAppend) {
        resetApp();
        loadedPdfNames = files.map(f => f.name);
    } else {
        files.forEach(f => {
            loadedPdfNames.push(f.name);
        });
    }

    showLoading(true);
    dropZone.classList.add('hidden');
    workspace.classList.remove('hidden');
    controls.classList.remove('hidden');
    previewContainer.classList.remove('hidden');

    fileNameDisplay.textContent = `${loadedPdfNames.length} PDF(s) loaded`;

    try {
        for (const file of files) {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

            // Render all pages for this pdf
            for (let i = 1; i <= pdf.numPages; i++) {
                await renderPage(pdf, i, file.name.replace('.pdf', ''));
            }
        }
        pageCountDisplay.textContent = `${renderedPages.length} pages total`;
    } catch (error) {
        console.error('Error loading PDF:', error);
        alert('Error parsing PDF file: ' + (error.message || error));
        if (!isAppend) resetApp();
    } finally {
        showLoading(false);
    }
}

async function renderPage(pdf, pageNum, filePrefix) {
    const page = await pdf.getPage(pageNum);
    const scale = 2.0; // High quality
    const viewport = page.getViewport({ scale });

    // Create canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // Render PDF page into canvas context
    const renderContext = {
        canvasContext: context,
        viewport: viewport
    };

    await page.render(renderContext).promise;

    // Convert to Image for preview
    const imgDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    renderedPages.push({ pageNum, data: imgDataUrl, filePrefix });

    // Create DOM elements
    const card = document.createElement('div');
    card.className = 'page-card';

    const img = document.createElement('img');
    img.src = imgDataUrl;
    img.className = 'page-preview';

    // Add page number and individual download
    const footer = document.createElement('div');
    footer.className = 'page-footer';

    const pageNumSpan = document.createElement('span');
    pageNumSpan.className = 'page-number';
    pageNumSpan.textContent = `Page ${pageNum}`;

    const loadBtn = document.createElement('button');
    loadBtn.className = 'single-dl-btn';
    loadBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span>Download</span>
    `;
    loadBtn.title = `Download Page ${pageNum}`;
    loadBtn.onclick = () => downloadSinglePage(pageNum, imgDataUrl, filePrefix, loadBtn);

    footer.appendChild(pageNumSpan);
    footer.appendChild(loadBtn);

    card.appendChild(img);
    card.appendChild(footer);
    previewContainer.appendChild(card);
}

async function downloadSinglePage(pageNum, dataUrl, filePrefix, btn) {
    if (btn) {
        btn.classList.add('success');
        btn.innerHTML = `<span>✓</span> <span>Downloaded!</span>`;
        setTimeout(() => {
            btn.classList.remove('success');
            btn.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                <span>Download</span>
            `;
        }, 2200);
    }
    const base64Data = dataUrl.split(',')[1];
    const binaryData = atob(base64Data);
    const array = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) array[i] = binaryData.charCodeAt(i);
    const blob = new Blob([array], { type: 'image/jpeg' });
    const fileName = `${filePrefix}_page_${pageNum}.jpg`;
    await MobileBridge.saveFile(blob, fileName);
}

function downloadAllAsZip() {
    if (renderedPages.length === 0) return;

    if (renderedPages.length === 1) {
        // Direct download
        const page = renderedPages[0];
        downloadSinglePage(page.pageNum, page.data, page.filePrefix);
        return;
    }

    const zip = new JSZip();
    const folder = zip.folder("images");

    renderedPages.forEach(page => {
        // Remove 'data:image/jpeg;base64,' prefix
        const base64Data = page.data.split(',')[1];
        folder.file(`${page.filePrefix}_page_${page.pageNum}.jpg`, base64Data, { base64: true });
    });

    zip.generateAsync({ type: "blob" })
        .then(async function (content) {
            const fileName = `PDFPals_extracted_images.zip`;
            await MobileBridge.saveFile(content, fileName);
        });
}

function resetApp() {
    loadedPdfNames = [];
    renderedPages = [];
    isAddingMore = false;
    fileInput.value = '';
    previewContainer.innerHTML = '';
    dropZone.classList.remove('hidden');
    workspace.classList.add('hidden');
    controls.classList.add('hidden');
    previewContainer.classList.add('hidden');
    showLoading(false);
}

function showLoading(show) {
    if (show) loading.classList.remove('hidden');
    else loading.classList.add('hidden');
}

browseBtn.addEventListener('click', () => {
    isAddingMore = false;
    fileInput.click();
});
