import * as pdfjsLib from '../vendor/pdfjs-dist/build/pdf.mjs';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '../vendor/pdfjs-dist/build/pdf.worker.mjs';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.browse-btn');
const controls = document.getElementById('controls');
const previewContainer = document.getElementById('preview-container');
const loading = document.getElementById('loading');
const fileNameDisplay = document.getElementById('file-name');
const pageCountDisplay = document.getElementById('page-count');
const downloadAllBtn = document.getElementById('download-all-btn');
const resetBtn = document.getElementById('reset-btn');

let currentPdf = null;
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
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
        handleFile(file);
    } else {
        alert('Please upload a valid PDF file.');
    }
});



fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
});

resetBtn.addEventListener('click', resetApp);

downloadAllBtn.addEventListener('click', downloadAllAsZip);

async function handleFile(file) {
    resetApp();
    showLoading(true);
    dropZone.classList.add('hidden');
    controls.classList.remove('hidden');
    previewContainer.classList.remove('hidden');

    fileNameDisplay.textContent = file.name;

    try {
        const arrayBuffer = await file.arrayBuffer();
        currentPdf = await pdfjsLib.getDocument(arrayBuffer).promise;

        pageCountDisplay.textContent = `${currentPdf.numPages} pages`;

        // Render all pages
        for (let i = 1; i <= currentPdf.numPages; i++) {
            await renderPage(i);
        }
    } catch (error) {
        console.error('Error loading PDF:', error);
        alert('Error parsing PDF file.');
        resetApp();
    } finally {
        showLoading(false);
    }
}

async function renderPage(pageNum) {
    const page = await currentPdf.getPage(pageNum);
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
    renderedPages.push({ pageNum, data: imgDataUrl });

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
    loadBtn.onclick = () => downloadSinglePage(pageNum, imgDataUrl);

    footer.appendChild(pageNumSpan);
    footer.appendChild(loadBtn);

    card.appendChild(img);
    card.appendChild(footer);
    previewContainer.appendChild(card);
}

async function downloadSinglePage(pageNum, dataUrl) {
    const base64Data = dataUrl.split(',')[1];
    const binaryData = atob(base64Data);
    const array = new Uint8Array(binaryData.length);
    for (let i = 0; i < binaryData.length; i++) array[i] = binaryData.charCodeAt(i);
    const blob = new Blob([array], { type: 'image/jpeg' });
    const fileName = `${fileNameDisplay.textContent.replace('.pdf', '')}_page_${pageNum}.jpg`;
    await MobileBridge.saveFile(blob, fileName);
}

function downloadAllAsZip() {
    if (renderedPages.length === 0) return;

    const zip = new JSZip();
    const folder = zip.folder("images");

    renderedPages.forEach(page => {
        // Remove 'data:image/jpeg;base64,' prefix
        const base64Data = page.data.split(',')[1];
        folder.file(`page_${page.pageNum}.jpg`, base64Data, { base64: true });
    });

    zip.generateAsync({ type: "blob" })
        .then(async function (content) {
            const fileName = `${fileNameDisplay.textContent.replace('.pdf', '')}_images.zip`;
            await MobileBridge.saveFile(content, fileName);
        });
}

function resetApp() {
    currentPdf = null;
    renderedPages = [];
    fileInput.value = '';
    previewContainer.innerHTML = '';
    dropZone.classList.remove('hidden');
    controls.classList.add('hidden');
    previewContainer.classList.add('hidden');
    showLoading(false);
}

function showLoading(show) {
    if (show) loading.classList.remove('hidden');
    else loading.classList.add('hidden');
}




browseBtn.addEventListener('click', () => fileInput.click());
