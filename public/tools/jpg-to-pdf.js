const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.browse-btn');
const fileListContainer = document.getElementById('image-list');
const controls = document.getElementById('controls');
const convertBtn = document.getElementById('convert-btn');
const fileCountSpan = document.getElementById('file-count');
const changeImagesBtn = document.getElementById('change-pdf-btn');
const addMoreBtn = document.getElementById('add-more-btn');
const convertSeparateBtn = document.getElementById('convert-separate-btn');

let selectedFiles = [];

// Event Listeners
if (addMoreBtn) {
    addMoreBtn.addEventListener('click', () => fileInput.click());
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
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    addFiles(files);
});

fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    addFiles(files);
    fileInput.value = '';
});

convertBtn.addEventListener('click', convertToPDF);
if (convertSeparateBtn) convertSeparateBtn.addEventListener('click', convertToSeparatePDFs);

function addFiles(files) {
    if (files.length === 0) return;
    selectedFiles = [...selectedFiles, ...files];
    updateUI();
}

function updateUI() {
    if (selectedFiles.length > 0) {
        controls.classList.remove('hidden');
        fileListContainer.classList.remove('hidden');
    } else {
        controls.classList.add('hidden');
        fileListContainer.classList.add('hidden');
    }

    fileCountSpan.textContent = `${selectedFiles.length} images selected`;
    renderFileList();
}

function renderFileList() {
    fileListContainer.innerHTML = '';
    selectedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'img-card';
        item.style.position = 'relative';

        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.className = 'page-preview';

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '✕';
        removeBtn.style.position = 'absolute';
        removeBtn.style.top = '5px';
        removeBtn.style.right = '5px';
        removeBtn.style.background = 'rgba(239, 68, 68, 0.9)';
        removeBtn.style.color = 'white';
        removeBtn.style.border = 'none';
        removeBtn.style.borderRadius = '50%';
        removeBtn.style.width = '24px';
        removeBtn.style.height = '24px';
        removeBtn.style.cursor = 'pointer';
        removeBtn.onclick = () => removeFile(index);

        const info = document.createElement('div');
        info.style.width = '100%';
        info.style.textAlign = 'center';

        const nameEl = document.createElement('div');
        nameEl.textContent = file.name;
        nameEl.title = file.name;
        nameEl.style.fontSize = '0.8rem';
        nameEl.style.fontWeight = '600';
        nameEl.style.whiteSpace = 'nowrap';
        nameEl.style.overflow = 'hidden';
        nameEl.style.textOverflow = 'ellipsis';
        nameEl.style.marginBottom = '0.3rem';

        const dlBtn = document.createElement('button');
        dlBtn.className = 'single-dl-btn';
        dlBtn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span>Download</span>
        `;
        dlBtn.title = `Convert and download ${file.name} as PDF`;
        dlBtn.onclick = async (e) => {
            e.stopPropagation();
            await downloadSingleImageAsPdf(file, dlBtn);
        };

        info.appendChild(nameEl);
        info.appendChild(dlBtn);

        item.appendChild(img);
        item.appendChild(removeBtn);
        item.appendChild(info);
        fileListContainer.appendChild(item);
    });
}

// Universal robust image embedder for PDF-Lib (handles standard JPG/PNG + progressive JPEG, WebP, AVIF, etc.)
async function embedImageInPdf(newPdf, file) {
    const arrayBuffer = await file.arrayBuffer();

    // Fast-path 1: Direct JPG embed
    if (file.type === 'image/jpeg' || file.name.match(/\.(jpg|jpeg)$/i)) {
        try {
            return await newPdf.embedJpg(arrayBuffer);
        } catch (errJpg) {
            console.warn('Direct embedJpg failed (may be WebP or progressive JPEG), falling back to canvas pipeline:', errJpg);
        }
    }

    // Fast-path 2: Direct PNG embed
    if (file.type === 'image/png' || file.name.match(/\.png$/i)) {
        try {
            return await newPdf.embedPng(arrayBuffer);
        } catch (errPng) {
            console.warn('Direct embedPng failed, falling back to canvas pipeline:', errPng);
        }
    }

    // Universal rock-solid canvas pipeline for all formats
    const imgUrl = URL.createObjectURL(file);
    try {
        const imgEl = new Image();
        await new Promise((resolve, reject) => {
            imgEl.onload = resolve;
            imgEl.onerror = () => reject(new Error(`Browser could not decode image: ${file.name}`));
            imgEl.src = imgUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = imgEl.naturalWidth || imgEl.width;
        canvas.height = imgEl.naturalHeight || imgEl.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgEl, 0, 0);

        const pngBlob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        const pngBuffer = await pngBlob.arrayBuffer();
        return await newPdf.embedPng(pngBuffer);
    } finally {
        URL.revokeObjectURL(imgUrl);
    }
}

async function downloadSingleImageAsPdf(file, btn) {
    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span>⏳</span> <span>Converting...</span>`;

    try {
        const newPdf = await window.PDFLib.PDFDocument.create();
        const image = await embedImageInPdf(newPdf, file);

        const page = newPdf.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
        newPdf.setProducer('PDFPals');
        newPdf.setCreator('PDFPals');
        const pdfBytes = await newPdf.save();
        const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        const fileName = `${baseName}.pdf`;
        await downloadPDF(pdfBytes, fileName);

        btn.classList.add('success');
        btn.innerHTML = `<span>✓</span> <span>Downloaded!</span>`;
        setTimeout(() => {
            btn.classList.remove('success');
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }, 2200);
    } catch (err) {
        console.error('Single image to PDF failed:', err);
        alert('Failed to convert image to PDF: ' + (err.message || 'Error'));
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateUI();
}

async function convertToPDF() {
    if (selectedFiles.length === 0) return;

    convertBtn.disabled = true;
    convertBtn.textContent = 'Processing...';

    try {
        const newPdf = await window.PDFLib.PDFDocument.create();

        for (const file of selectedFiles) {
            try {
                const image = await embedImageInPdf(newPdf, file);
                const page = newPdf.addPage([image.width, image.height]);
                page.drawImage(image, {
                    x: 0,
                    y: 0,
                    width: image.width,
                    height: image.height,
                });
            } catch (fileErr) {
                console.warn(`Skipping unreadable file ${file.name}:`, fileErr);
            }
        }

        newPdf.setProducer('PDFPals');
        newPdf.setCreator('PDFPals');
        const pdfBytes = await newPdf.save();
        await downloadPDF(pdfBytes, 'images_converted.pdf');
    } catch (err) {
        console.error('Merge to PDF error:', err);
        alert('Failed to merge images into PDF: ' + err.message);
    } finally {
        convertBtn.disabled = false;
        convertBtn.textContent = 'Merge to 1 PDF';
    }
}

async function convertToSeparatePDFs() {
    if (selectedFiles.length === 0) return;

    if (convertSeparateBtn) {
        convertSeparateBtn.disabled = true;
        convertSeparateBtn.textContent = 'Processing...';
    }

    try {
        if (selectedFiles.length === 1) {
            const file = selectedFiles[0];
            const newPdf = await window.PDFLib.PDFDocument.create();
            const image = await embedImageInPdf(newPdf, file);

            const page = newPdf.addPage([image.width, image.height]);
            page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
            newPdf.setProducer('PDFPals');
            newPdf.setCreator('PDFPals');
            const pdfBytes = await newPdf.save();
            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            const fileName = `${baseName}.pdf`;
            await downloadPDF(pdfBytes, fileName);
            return;
        }

        // Multiple files -> Bundle into ZIP
        const zip = new window.JSZip();
        const folder = zip.folder("pdf_images");

        for (const file of selectedFiles) {
            try {
                const newPdf = await window.PDFLib.PDFDocument.create();
                const image = await embedImageInPdf(newPdf, file);

                const page = newPdf.addPage([image.width, image.height]);
                page.drawImage(image, {
                    x: 0,
                    y: 0,
                    width: image.width,
                    height: image.height,
                });

                newPdf.setProducer('PDFPals');
                newPdf.setCreator('PDFPals');
                const pdfBytes = await newPdf.save();
                
                const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
                const fileName = `${baseName}.pdf`;
                folder.file(fileName, pdfBytes);
            } catch (fileErr) {
                console.warn(`Skipping unreadable file ${file.name}:`, fileErr);
            }
        }

        const content = await zip.generateAsync({ type: "blob" });
        if (typeof window.MobileBridge !== 'undefined' && window.MobileBridge.isNative && window.MobileBridge.isNative()) {
            await window.MobileBridge.saveFile(content, 'PDFPals_Separated_Images.zip');
        } else {
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'PDFPals_Separated_Images.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 15000);
        }
    } catch (err) {
        console.error('Separate PDFs error:', err);
        alert('Failed to convert to separate PDFs: ' + err.message);
    } finally {
        if (convertSeparateBtn) {
            convertSeparateBtn.disabled = false;
            convertSeparateBtn.textContent = 'Separate PDFs ➔';
        }
    }
}

async function downloadPDF(pdfBytes, filename) {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    if (typeof window.MobileBridge !== 'undefined' && window.MobileBridge.isNative && window.MobileBridge.isNative()) {
        await window.MobileBridge.saveFile(blob, filename);
    } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 15000);
    }
}




browseBtn.addEventListener('click', () => fileInput.click());

if (changeImagesBtn) {
    changeImagesBtn.onclick = () => {
        selectedFiles = [];
        updateUI();
        dropZone.classList.remove('hidden');
        fileInput.value = '';
    };
}
