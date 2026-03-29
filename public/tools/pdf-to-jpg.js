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

// Removed currentPdf, rely on local variables in handleFiles
let renderedPages = []; // Stores data URLs

// Event Listeners
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
        handleFiles(files);
    } else {
        alert('Please upload valid PDF files.');
    }
});

fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) handleFiles(files);
});

resetBtn.addEventListener('click', resetApp);

downloadAllBtn.addEventListener('click', downloadAllAsZip);

async function handleFiles(files) {
    resetApp();
    showLoading(true);
    dropZone.classList.add('hidden');
    workspace.classList.remove('hidden');
    controls.classList.remove('hidden');
    previewContainer.classList.remove('hidden');

    fileNameDisplay.textContent = `${files.length} PDF(s) loaded`;

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
        alert('Error parsing PDF file.');
        resetApp();
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
    loadBtn.className = 'download-page-btn';
    loadBtn.innerHTML = '⬇️'; // Simple icon
    loadBtn.title = 'Download this page';
    loadBtn.onclick = () => downloadSinglePage(pageNum, imgDataUrl, filePrefix);

    footer.appendChild(pageNumSpan);
    footer.appendChild(loadBtn);

    card.appendChild(img);
    card.appendChild(footer);
    previewContainer.appendChild(card);
}

async function downloadSinglePage(pageNum, dataUrl, filePrefix) {
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
    currentPdf = null;
    renderedPages = [];
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




browseBtn.addEventListener('click', () => fileInput.click());
