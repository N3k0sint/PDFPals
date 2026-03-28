import * as pdfjsLib from '../vendor/pdfjs-dist/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '../vendor/pdfjs-dist/build/pdf.worker.mjs';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.browse-btn');
const controls = document.getElementById('controls');
const previewContainer = document.getElementById('preview-container');
const loading = document.getElementById('loading');
const pageCountSpan = document.getElementById('page-count');
const extractBtn = document.getElementById('extract-btn');
const resetBtn = document.getElementById('reset-btn');

let currentFile = null;
let currentPdf = null; // PDF.js document
let selectedPages = new Set(); // 1-based page indices

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
    }
});



fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
});

resetBtn.addEventListener('click', resetApp);
extractBtn.addEventListener('click', extractPages);

async function handleFile(file) {
    resetApp();
    currentFile = file;
    showLoading(true);
    dropZone.classList.add('hidden');
    controls.classList.remove('hidden');
    previewContainer.classList.remove('hidden');

    try {
        const arrayBuffer = await file.arrayBuffer();
        currentPdf = await pdfjsLib.getDocument(arrayBuffer).promise;

        pageCountSpan.textContent = `${currentPdf.numPages} pages found`;

        // Render thumbnails
        for (let i = 1; i <= currentPdf.numPages; i++) {
            await renderThumbnail(i);
        }
    } catch (error) {
        console.error('Error loading PDF:', error);
        alert('Error parsing PDF file.');
        resetApp();
    } finally {
        showLoading(false);
    }
}

async function renderThumbnail(pageNum) {
    const page = await currentPdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 0.5 }); // Thumbnail scale

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport: viewport }).promise;

    const card = document.createElement('div');
    card.className = 'page-card';
    card.dataset.pageNum = pageNum;
    card.onclick = () => togglePageSelection(card, pageNum);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'page-checkbox';
    checkbox.checked = false;
    // Handle checkbox click separately
    checkbox.onclick = (e) => {
        e.stopPropagation();
        togglePageSelection(card, pageNum);
    };

    const img = document.createElement('img');
    img.src = canvas.toDataURL();
    img.className = 'page-preview';

    const footer = document.createElement('div');
    footer.className = 'page-footer';
    footer.innerHTML = `<span class="page-number">Page ${pageNum}</span>`;

    card.appendChild(checkbox);
    card.appendChild(img);
    card.appendChild(footer);
    previewContainer.appendChild(card);
}

function togglePageSelection(card, pageNum) {
    const checkbox = card.querySelector('.page-checkbox');
    if (selectedPages.has(pageNum)) {
        selectedPages.delete(pageNum);
        card.classList.remove('selected');
        checkbox.checked = false;
    } else {
        selectedPages.add(pageNum);
        card.classList.add('selected');
        checkbox.checked = true;
    }
    updateExtractButton();
}

function updateExtractButton() {
    extractBtn.textContent = `Extract ${selectedPages.size} Pages`;
}

async function extractPages() {
    if (selectedPages.size === 0) {
        alert('Please select pages to extract.');
        return;
    }

    const arrayBuffer = await currentFile.arrayBuffer();
    const srcPdf = await window.PDFLib.PDFDocument.load(arrayBuffer);
    const newPdf = await window.PDFLib.PDFDocument.create();

    // window.PDFLib uses 0-based index
    const indices = Array.from(selectedPages).map(p => p - 1).sort((a, b) => a - b);
    const copiedPages = await newPdf.copyPages(srcPdf, indices);

    copiedPages.forEach(page => newPdf.addPage(page));

    newPdf.setProducer('PDFPals');
    newPdf.setCreator('PDFPals');
    const pdfBytes = await newPdf.save();
    downloadPDF(pdfBytes, `extracted_from_${currentFile.name}`);
}

async function downloadPDF(pdfBytes, filename) {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    await MobileBridge.saveFile(blob, filename);
}

function resetApp() {
    currentFile = null;
    currentPdf = null;
    selectedPages.clear();
    fileInput.value = '';
    previewContainer.innerHTML = '';
    extractBtn.textContent = 'Extract Selected';
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
