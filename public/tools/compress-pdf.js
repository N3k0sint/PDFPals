import * as pdfjsLib from '../vendor/pdfjs-dist/build/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = '../vendor/pdfjs-dist/build/pdf.worker.mjs';

// Style radio selections
const radioOptions = document.querySelectorAll('.radio-option');
radioOptions.forEach(opt => {
    opt.onclick = () => {
        radioOptions.forEach(r => r.classList.remove('active'));
        opt.classList.add('active');
        const input = opt.querySelector('input');
        if (input) input.checked = true;
    };
});

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.browse-btn');
const fileNameDisplay = document.getElementById('file-name');
const fileSizeDisplay = document.getElementById('file-size');
const applyBtn = document.getElementById('apply-btn');
const changePdfBtn = document.getElementById('change-pdf-btn');
const workspace = document.getElementById('workspace');

const pBar = document.getElementById('progress-bar');
const pText = document.getElementById('progress-text');
const pContainer = document.getElementById('progress-container');

let pdfBytes = null;
let originalFileSizes = 0;

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
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
    if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
    }
});


fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        handleFile(e.target.files[0]);
    }
});

async function handleFile(file) {
    if (file.type !== 'application/pdf') {
        alert('Please select a PDF file.');
        return;
    }
    const buffer = await file.arrayBuffer();
    pdfBytes = new Uint8Array(buffer);
    originalFileSizes = file.size;

    fileNameDisplay.textContent = file.name;
    fileSizeDisplay.textContent = `Original Size: ${formatBytes(file.size)}`;
    dropZone.classList.add('hidden');
    workspace.classList.remove('hidden');
}

if (changePdfBtn) {
    changePdfBtn.onclick = () => {
        pdfBytes = null;
        dropZone.classList.remove('hidden');
        workspace.classList.add('hidden');
        fileInput.value = '';
    };
}

applyBtn.addEventListener('click', async () => {
    if (!pdfBytes) return;

    applyBtn.disabled = true;
    applyBtn.classList.add('hidden');
    pContainer.classList.remove('hidden');

    try {
        const compLevel = document.querySelector('input[name="compression"]:checked').value;

        let scale = 1.5;
        let quality = 0.6;

        if (compLevel === 'extreme') {
            scale = 1.0;
            quality = 0.4;
        } else if (compLevel === 'less') {
            scale = 2.0;
            quality = 0.8;
        }

        const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice() });
        const pdfDoc = await loadingTask.promise;
        const numPages = pdfDoc.numPages;

        const newDoc = await window.PDFLib.PDFDocument.create();

        for (let i = 1; i <= numPages; i++) {
            pText.textContent = `Compressing page ${i} of ${numPages}...`;
            pBar.style.width = `${((i - 1) / numPages) * 100}%`;

            const page = await pdfDoc.getPage(i);
            const viewport = page.getViewport({ scale: scale });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            const imgDataUrl = canvas.toDataURL('image/jpeg', quality);

            // Convert data URL to bytes
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

        pBar.style.width = '100%';
        pText.textContent = 'Saving PDF...';

        newDoc.setProducer('PDFPals');
        newDoc.setCreator('PDFPals');
        const outBytes = await newDoc.save();
        alert(`Compression Complete!\nOriginal: ${formatBytes(originalFileSizes)}\nCompressed: ${formatBytes(outBytes.length)}`);

        const blob = new Blob([outBytes], { type: 'application/pdf' });
        const fileName = fileNameDisplay.textContent.replace('.pdf', '_compressed.pdf');
        await MobileBridge.saveFile(blob, fileName);
    } catch (e) {
        console.error(e);
        alert('Failed to compress PDF.');
    } finally {
        applyBtn.disabled = false;
        applyBtn.classList.remove('hidden');
        pContainer.classList.add('hidden');
        pBar.style.width = '0%';
    }
});




browseBtn.addEventListener('click', () => fileInput.click());
