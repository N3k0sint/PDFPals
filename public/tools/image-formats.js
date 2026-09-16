const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.browse-btn');
const workspace = document.getElementById('workspace');
const previewGrid = document.getElementById('preview-grid');
const targetFormatSelect = document.getElementById('target-format');
const qualityField = document.getElementById('quality-field');
const qualitySlider = document.getElementById('quality-slider');
const qualityVal = document.getElementById('quality-val');
const icoField = document.getElementById('ico-field');
const icoSizeSelect = document.getElementById('ico-size');
const downloadModeField = document.getElementById('download-mode-field');
const downloadModeSelect = document.getElementById('download-mode');
const convertBtn = document.getElementById('convert-btn');
const switchImgBtn = document.getElementById('switch-img-btn');
const addMoreBtn = document.getElementById('add-more-btn');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const statusMsg = document.getElementById('status-msg');

let selectedFiles = []; // Array of { id, file, name, ext, sizeStr, previewUrl, isPlaceholder }

if (downloadModeSelect) {
    downloadModeSelect.addEventListener('change', updateConvertBtnText);
}

function updateConvertBtnText() {
    if (selectedFiles.length > 1) {
        if (downloadModeField) downloadModeField.classList.remove('hidden');
        const mode = downloadModeSelect ? downloadModeSelect.value : 'zip';
        if (mode === 'zip') {
            convertBtn.textContent = 'Convert & Download (ZIP) ➔';
        } else {
            convertBtn.textContent = 'Convert & Download All ➔';
        }
    } else {
        if (downloadModeField) downloadModeField.classList.add('hidden');
        convertBtn.textContent = 'Convert & Download ➔';
    }
}

// Quality slider updates
qualitySlider.addEventListener('input', () => {
    qualityVal.textContent = `${qualitySlider.value}%`;
});

// Format change triggers options
targetFormatSelect.addEventListener('change', () => {
    const format = targetFormatSelect.value;
    if (format === 'jpeg' || format === 'webp' || format === 'avif') {
        qualityField.classList.remove('hidden');
    } else {
        qualityField.classList.add('hidden');
    }

    if (format === 'ico') {
        icoField.classList.remove('hidden');
    } else {
        icoField.classList.add('hidden');
    }
});

// File Handling Drag & Drop
browseBtn.addEventListener('click', () => fileInput.click());

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
        addFiles(Array.from(e.dataTransfer.files));
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) {
        addFiles(Array.from(e.target.files));
        fileInput.value = '';
    }
});

switchImgBtn.addEventListener('click', () => {
    thumbnailQueue = [];
    selectedFiles = [];
    renderGrid();
    workspace.classList.add('hidden');
    dropZone.classList.remove('hidden');
    fileInput.click();
});

addMoreBtn.addEventListener('click', () => fileInput.click());

function addFiles(files) {
    if (!files.length) return;

    for (const file of files) {
        const id = Date.now() + Math.random().toString(36).substring(2, 7);
        const name = file.name;
        const ext = name.substring(name.lastIndexOf('.') + 1).toLowerCase() || 'img';
        const sizeStr = formatFileSize(file.size);
        
        let previewUrl;
        let isPlaceholder = false;
        if (isHeic(file) || isTiff(file)) {
            // Instant crisp SVG placeholder so dropping files is instantaneous
            previewUrl = createFormatPlaceholder(ext);
            isPlaceholder = true;
        } else {
            previewUrl = URL.createObjectURL(file);
        }

        selectedFiles.push({ id, file, name, ext, sizeStr, previewUrl, isPlaceholder });
    }

    dropZone.classList.add('hidden');
    workspace.classList.remove('hidden');
    renderGrid();
}

function createFormatPlaceholder(ext) {
    const label = ext.toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="120" viewBox="0 0 180 120">
        <rect width="180" height="120" rx="12" fill="#1e293b"/>
        <rect x="45" y="22" width="90" height="60" rx="8" fill="#0f172a" stroke="#38bdf8" stroke-width="2"/>
        <circle cx="68" cy="42" r="6" fill="#38bdf8"/>
        <path d="M52 72 L72 52 L92 68 L108 58 L126 74" stroke="#38bdf8" stroke-width="2" fill="none" stroke-linecap="round"/>
        <text x="90" y="103" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#38bdf8" text-anchor="middle">${label}</text>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

let thumbnailQueue = [];
let isProcessingThumbnails = false;

function enqueueThumbnailGeneration(item) {
    if (thumbnailQueue.some(i => i.id === item.id)) return;
    thumbnailQueue.push(item);
    processThumbnailQueue();
}

async function processThumbnailQueue() {
    if (isProcessingThumbnails || thumbnailQueue.length === 0) return;
    isProcessingThumbnails = true;

    while (thumbnailQueue.length > 0) {
        const item = thumbnailQueue.shift();
        // Skip if user removed the file in the meantime
        if (!selectedFiles.some(f => f.id === item.id)) continue;

        try {
            let realUrl = null;
            if (isHeic(item.file)) {
                realUrl = await getHeicPreviewUrl(item.file);
            } else if (isTiff(item.file)) {
                realUrl = await getTiffPreviewUrl(item.file);
            }

            if (realUrl && realUrl !== '../assets/icon.png') {
                item.previewUrl = realUrl;
                item.isPlaceholder = false;
                const imgEl = previewGrid.querySelector(`img[data-id="${item.id}"]`);
                if (imgEl) {
                    imgEl.style.transition = 'opacity 0.3s ease';
                    imgEl.style.opacity = '0.4';
                    const temp = new Image();
                    temp.onload = () => {
                        imgEl.src = realUrl;
                        imgEl.style.opacity = '1';
                    };
                    temp.src = realUrl;
                }
            }
        } catch (err) {
            console.warn('Async thumbnail error for', item.name, err);
        }
    }

    isProcessingThumbnails = false;
}

function renderGrid() {
    previewGrid.innerHTML = '';
    selectedFiles.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'image-card';

        const delBtn = document.createElement('button');
        delBtn.className = 'delete-btn';
        delBtn.innerHTML = '&times;';
        delBtn.title = 'Remove';
        delBtn.onclick = () => {
            selectedFiles.splice(index, 1);
            thumbnailQueue = thumbnailQueue.filter(t => t.id !== item.id);
            if (selectedFiles.length === 0) {
                workspace.classList.add('hidden');
                dropZone.classList.remove('hidden');
            } else {
                renderGrid();
            }
        };

        const img = document.createElement('img');
        img.className = 'image-thumbnail';
        img.src = item.previewUrl;
        img.alt = item.name;
        img.dataset.id = item.id;

        const info = document.createElement('div');
        info.className = 'image-info';

        const nameEl = document.createElement('div');
        nameEl.className = 'image-name';
        nameEl.textContent = item.name;
        nameEl.title = item.name;

        const metaEl = document.createElement('div');
        metaEl.className = 'image-meta';
        metaEl.innerHTML = `<span class="format-tag">${item.ext}</span> <span>${item.sizeStr}</span>`;

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
        dlBtn.title = `Convert & download ${item.name}`;
        dlBtn.onclick = async (e) => {
            e.stopPropagation();
            await convertAndDownloadSingleItem(item, dlBtn);
        };

        info.appendChild(nameEl);
        info.appendChild(metaEl);
        info.appendChild(dlBtn);

        card.appendChild(delBtn);
        card.appendChild(img);
        card.appendChild(info);

        previewGrid.appendChild(card);

        // If file has a placeholder, queue background thumbnail generation
        if (item.isPlaceholder) {
            enqueueThumbnailGeneration(item);
        }
    });

    updateConvertBtnText();
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / 1048576).toFixed(1) + ' MB';
}

function isHeic(file) {
    const ext = file.name.substring(file.name.lastIndexOf('.') + 1).toLowerCase();
    return ext === 'heic' || ext === 'heif' || file.type === 'image/heic' || file.type === 'image/heif';
}

function isTiff(file) {
    const ext = file.name.substring(file.name.lastIndexOf('.') + 1).toLowerCase();
    return ext === 'tiff' || ext === 'tif' || file.type === 'image/tiff';
}

async function getHeicPreviewUrl(file) {
    if (typeof window.HeicTo !== 'undefined') {
        try {
            const blob = await window.HeicTo({ blob: file, type: 'image/jpeg', quality: 0.35 });
            return URL.createObjectURL(blob);
        } catch (e) {
            console.warn('HeicTo preview error:', e);
        }
    }
    if (typeof window.heic2any !== 'undefined') {
        try {
            const blob = await window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.35 });
            const singleBlob = Array.isArray(blob) ? blob[0] : blob;
            return URL.createObjectURL(singleBlob);
        } catch (e) {
            console.warn('heic2any preview error:', e);
        }
    }
    return null;
}

async function getTiffPreviewUrl(file) {
    if (typeof window.UTIF !== 'undefined') {
        try {
            const buffer = await file.arrayBuffer();
            const ifds = window.UTIF.decode(buffer);
            if (ifds.length) {
                window.UTIF.decodeImage(buffer, ifds[0]);
                const rgba = window.UTIF.toRGBA8(ifds[0]);
                const canvas = document.createElement('canvas');
                canvas.width = ifds[0].width;
                canvas.height = ifds[0].height;
                const ctx = canvas.getContext('2d');
                const imgData = ctx.createImageData(canvas.width, canvas.height);
                imgData.data.set(rgba);
                ctx.putImageData(imgData, 0, 0);
                return canvas.toDataURL('image/jpeg', 0.5);
            }
        } catch (e) {
            console.warn('UTIF preview error:', e);
        }
    }
    return null;
}

// Universal Image Decoder (returns an HTMLCanvasElement)
async function decodeImageToCanvas(file) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // 1. HEIC / HEIF
    if (isHeic(file)) {
        // Priority 1: Modern HeicTo (handles modern iOS HEIC/HEIF containers)
        if (typeof window.HeicTo !== 'undefined') {
            try {
                const blob = await window.HeicTo({ blob: file, type: 'image/png' });
                return await decodeBlobToCanvas(blob);
            } catch (errHeicTo) {
                console.warn('HeicTo decode failed, attempting heic2any fallback:', errHeicTo);
            }
        }

        // Priority 2: heic2any fallback
        if (typeof window.heic2any !== 'undefined') {
            try {
                const converted = await window.heic2any({ blob: file, toType: 'image/png' });
                const blob = Array.isArray(converted) ? converted[0] : converted;
                return await decodeBlobToCanvas(blob);
            } catch (errHeic2Any) {
                console.warn('heic2any decode failed:', errHeic2Any);
            }
        }

        throw new Error('Unsupported HEIC container. Your camera may be using an unsupported HDR/depth layer.');
    }

    // 2. TIFF / TIF
    if (isTiff(file)) {
        if (typeof window.UTIF === 'undefined') {
            throw new Error('TIFF converter library not loaded.');
        }
        const buffer = await file.arrayBuffer();
        const ifds = window.UTIF.decode(buffer);
        if (!ifds.length) throw new Error('Invalid TIFF file.');
        window.UTIF.decodeImage(buffer, ifds[0]);
        const rgba = window.UTIF.toRGBA8(ifds[0]);
        canvas.width = ifds[0].width;
        canvas.height = ifds[0].height;
        const imgData = ctx.createImageData(canvas.width, canvas.height);
        imgData.data.set(rgba);
        ctx.putImageData(imgData, 0, 0);
        return canvas;
    }

    // 3. SVG
    const ext = file.name.substring(file.name.lastIndexOf('.') + 1).toLowerCase();
    if (ext === 'svg' || file.type === 'image/svg+xml') {
        const text = await file.text();
        const blob = new Blob([text], { type: 'image/svg+xml;charset=utf-8' });
        return decodeBlobToCanvas(blob);
    }

    // 4. Standard Browser formats (JPG, PNG, WEBP, GIF, BMP, AVIF, ICO)
    return decodeBlobToCanvas(file);
}

function decodeBlobToCanvas(blob) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            resolve(canvas);
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image into canvas.'));
        };
        img.src = url;
    });
}

// Encoders for various output formats
async function encodeCanvasToFormat(canvas, targetFormat, quality, icoSize) {
    const q = quality / 100;

    // 1. PNG
    if (targetFormat === 'png') {
        return new Promise(res => canvas.toBlob(res, 'image/png'));
    }

    // 2. JPEG
    if (targetFormat === 'jpeg' || targetFormat === 'jpg') {
        // Draw over white background to avoid transparent black artifacting
        const flatCanvas = document.createElement('canvas');
        flatCanvas.width = canvas.width;
        flatCanvas.height = canvas.height;
        const fCtx = flatCanvas.getContext('2d');
        fCtx.fillStyle = '#ffffff';
        fCtx.fillRect(0, 0, flatCanvas.width, flatCanvas.height);
        fCtx.drawImage(canvas, 0, 0);
        return new Promise(res => flatCanvas.toBlob(res, 'image/jpeg', q));
    }

    // 3. WEBP
    if (targetFormat === 'webp') {
        return new Promise(res => canvas.toBlob(res, 'image/webp', q));
    }

    // 4. AVIF
    if (targetFormat === 'avif') {
        const blob = await new Promise(res => canvas.toBlob(res, 'image/avif', q));
        if (blob && blob.type === 'image/avif') return blob;
        // Fallback to WebP if browser canvas does not yet support avif encoding
        return new Promise(res => canvas.toBlob(res, 'image/webp', q));
    }

    // 5. GIF
    if (targetFormat === 'gif') {
        const blob = await new Promise(res => canvas.toBlob(res, 'image/gif'));
        if (blob && blob.type === 'image/gif') return blob;
        // Fallback to PNG if browser doesn't support canvas gif export
        return new Promise(res => canvas.toBlob(res, 'image/png'));
    }

    // 6. BMP (Pure JS 24-bit/32-bit BMP Encoder)
    if (targetFormat === 'bmp') {
        return encodeBmp(canvas);
    }

    // 7. ICO (Standard Windows Icon with PNG Payload)
    if (targetFormat === 'ico') {
        return encodeIco(canvas, parseInt(icoSize, 10) || 256);
    }

    // 8. TIFF (UTIF Encoder)
    if (targetFormat === 'tiff' || targetFormat === 'tif') {
        if (typeof window.UTIF !== 'undefined') {
            const ctx = canvas.getContext('2d');
            const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const tiffBuffer = window.UTIF.encodeImage(imgData.data, canvas.width, canvas.height);
            return new Blob([tiffBuffer], { type: 'image/tiff' });
        }
        return new Promise(res => canvas.toBlob(res, 'image/png'));
    }

    // 9. SVG (Vector image container)
    if (targetFormat === 'svg') {
        const pngDataUrl = canvas.toDataURL('image/png');
        const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}">
    <image width="${canvas.width}" height="${canvas.height}" xlink:href="${pngDataUrl}"/>
</svg>`;
        return new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    }

    // 10. PDF
    if (targetFormat === 'pdf') {
        if (typeof window.PDFLib === 'undefined') {
            throw new Error('PDF library not available.');
        }
        const pdfDoc = await window.PDFLib.PDFDocument.create();
        const pngData = await new Promise(res => canvas.toBlob(res, 'image/png'));
        const arrayBuffer = await pngData.arrayBuffer();
        const image = await pdfDoc.embedPng(arrayBuffer);
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
        pdfDoc.setProducer('PDFPals');
        pdfDoc.setCreator('PDFPals');
        const pdfBytes = await pdfDoc.save();
        return new Blob([pdfBytes], { type: 'application/pdf' });
    }

    // Default fallback to PNG
    return new Promise(res => canvas.toBlob(res, 'image/png'));
}

// Lightweight, pure JavaScript 24-bit RGB Windows Bitmap (BMP) Encoder
function encodeBmp(canvas) {
    const width = canvas.width;
    const height = canvas.height;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    const rowSize = Math.floor((24 * width + 31) / 32) * 4;
    const pixelArraySize = rowSize * height;
    const fileSize = 54 + pixelArraySize;

    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);

    // BITMAPFILEHEADER (14 bytes)
    view.setUint16(0, 0x4D42, false); // 'BM'
    view.setUint32(2, fileSize, true); // File size
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint32(10, 54, true); // Pixel data offset

    // BITMAPINFOHEADER (40 bytes)
    view.setUint32(14, 40, true); // Header size
    view.setInt32(18, width, true); // Width
    view.setInt32(22, height, true); // Height (positive for bottom-up)
    view.setUint16(26, 1, true); // Planes
    view.setUint16(28, 24, true); // 24 bits per pixel
    view.setUint32(30, 0, true); // BI_RGB (uncompressed)
    view.setUint32(34, pixelArraySize, true); // Image data size
    view.setInt32(38, 2835, true); // 72 DPI (2835 pixels/meter)
    view.setInt32(42, 2835, true);
    view.setUint32(46, 0, true);
    view.setUint32(50, 0, true);

    // Write BGR pixels (bottom-up order)
    const uint8 = new Uint8Array(buffer);
    let offset = 54;

    for (let y = height - 1; y >= 0; y--) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            uint8[offset++] = data[idx + 2]; // B
            uint8[offset++] = data[idx + 1]; // G
            uint8[offset++] = data[idx];     // R
        }
        // Row padding
        for (let p = 0; p < rowSize - width * 3; p++) {
            uint8[offset++] = 0;
        }
    }

    return new Blob([buffer], { type: 'image/bmp' });
}

// Windows Icon (ICO) Encoder using PNG image payload
async function encodeIco(canvas, targetDim) {
    const icoCanvas = document.createElement('canvas');
    icoCanvas.width = targetDim;
    icoCanvas.height = targetDim;
    const ctx = icoCanvas.getContext('2d');

    // Fit source into square icon with aspect ratio preserved
    const scale = Math.min(targetDim / canvas.width, targetDim / canvas.height);
    const w = Math.round(canvas.width * scale);
    const h = Math.round(canvas.height * scale);
    const x = Math.round((targetDim - w) / 2);
    const y = Math.round((targetDim - h) / 2);

    ctx.drawImage(canvas, x, y, w, h);

    const pngBlob = await new Promise(res => icoCanvas.toBlob(res, 'image/png'));
    const pngBytes = new Uint8Array(await pngBlob.arrayBuffer());

    // ICONDIR (6 bytes) + 1 ICONDIRENTRY (16 bytes) = 22 bytes header
    const icoBuffer = new ArrayBuffer(22 + pngBytes.length);
    const view = new DataView(icoBuffer);
    const uint8 = new Uint8Array(icoBuffer);

    // ICONDIR
    view.setUint16(0, 0, true);  // Reserved (0)
    view.setUint16(2, 1, true);  // Type (1 = icon)
    view.setUint16(4, 1, true);  // Count (1 image)

    // ICONDIRENTRY
    view.setUint8(6, targetDim >= 256 ? 0 : targetDim); // Width (0 means 256)
    view.setUint8(7, targetDim >= 256 ? 0 : targetDim); // Height (0 means 256)
    view.setUint8(8, 0); // Palette colors
    view.setUint8(9, 0); // Reserved
    view.setUint16(10, 1, true); // Color planes
    view.setUint16(12, 32, true); // Bits per pixel
    view.setUint32(14, pngBytes.length, true); // Size of image data
    view.setUint32(18, 22, true); // Offset of image data

    uint8.set(pngBytes, 22);

    return new Blob([icoBuffer], { type: 'image/x-icon' });
}

// Optimized Single File Converter with Fast-Path for HEIC
async function convertSingleFile(file, targetFormat, quality, icoSize) {
    const q = quality / 100;

    // Direct 1-pass fast-path for HEIC -> JPG / PNG / WEBP
    if (isHeic(file)) {
        const directMime = (targetFormat === 'jpeg' || targetFormat === 'jpg') ? 'image/jpeg'
                         : targetFormat === 'png' ? 'image/png'
                         : targetFormat === 'webp' ? 'image/webp'
                         : null;

        if (directMime && typeof window.HeicTo !== 'undefined') {
            try {
                return await window.HeicTo({ blob: file, type: directMime, quality: q });
            } catch (e) {
                console.warn('Direct HeicTo fast-path failed, falling back to canvas pipeline:', e);
            }
        }
    }

    // Standard canvas pipeline
    const canvas = await decodeImageToCanvas(file);
    return await encodeCanvasToFormat(canvas, targetFormat, quality, icoSize);
}

// Single image direct conversion & download (Save Solely)
async function convertAndDownloadSingleItem(item, btn) {
    const targetFormat = targetFormatSelect.value;
    const quality = parseInt(qualitySlider.value, 10) || 92;
    const icoSize = icoSizeSelect.value;

    const originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span>⏳</span> <span>Converting...</span>`;

    try {
        const blob = await convertSingleFile(item.file, targetFormat, quality, icoSize);
        const baseName = item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
        const newExtension = targetFormat === 'jpeg' ? 'jpg' : targetFormat;
        const newFileName = `${baseName}.${newExtension}`;

        if (typeof MobileBridge !== 'undefined') {
            await MobileBridge.saveFile(blob, newFileName);
        } else {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = newFileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(a.href), 10000);
        }

        btn.classList.add('success');
        btn.innerHTML = `<span>✓</span> <span>Downloaded!</span>`;
        setTimeout(() => {
            btn.classList.remove('success');
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }, 2200);
    } catch (err) {
        console.error(`Error converting ${item.name}:`, err);
        alert(`Failed to convert ${item.name}: ` + (err.message || 'Error'));
        btn.disabled = false;
        btn.innerHTML = originalHtml;
    }
}

// Main Batch Conversion & Download
convertBtn.addEventListener('click', async () => {
    if (!selectedFiles.length) {
        alert('Please select at least one image to convert.');
        return;
    }

    const targetFormat = targetFormatSelect.value;
    const quality = parseInt(qualitySlider.value, 10) || 92;
    const icoSize = icoSizeSelect.value;

    convertBtn.disabled = true;
    convertBtn.textContent = 'Processing...';
    progressContainer.classList.remove('hidden');
    progressBar.style.width = '5%';
    statusMsg.textContent = `Preparing 0 of ${selectedFiles.length}...`;

    try {
        const convertedItems = [];
        const failedItems = [];
        const total = selectedFiles.length;
        let completed = 0;
        let queueIdx = 0;

        // Process with parallel concurrency to utilize CPU cores
        const concurrency = Math.min(2, total);

        const worker = async () => {
            while (queueIdx < total) {
                const idx = queueIdx++;
                const item = selectedFiles[idx];
                statusMsg.textContent = `Converting ${item.name} (${completed + 1}/${total})...`;

                try {
                    const blob = await convertSingleFile(item.file, targetFormat, quality, icoSize);
                    const baseName = item.name.substring(0, item.name.lastIndexOf('.')) || item.name;
                    const newExtension = targetFormat === 'jpeg' ? 'jpg' : targetFormat;
                    const newFileName = `${baseName}.${newExtension}`;
                    convertedItems.push({ name: newFileName, blob });
                } catch (fileErr) {
                    console.error(`Error processing ${item.name}:`, fileErr);
                    failedItems.push({ name: item.name, error: fileErr.message || 'Unsupported image container' });
                }

                completed++;
                const pct = Math.round((completed / total) * 90);
                progressBar.style.width = `${pct}%`;
            }
        };

        const workers = Array.from({ length: concurrency }, () => worker());
        await Promise.all(workers);

        if (convertedItems.length === 0) {
            const reasons = failedItems.map(f => `${f.name}: ${f.error}`).join('\n');
            throw new Error(`Conversion failed for all files:\n${reasons}`);
        }

        progressBar.style.width = '95%';
        statusMsg.textContent = 'Finalizing download package...';

        // Download: Single file direct or Multi-file (ZIP vs Separate/Solely)
        if (convertedItems.length === 1) {
            const single = convertedItems[0];
            if (typeof MobileBridge !== 'undefined') {
                await MobileBridge.saveFile(single.blob, single.name);
            } else {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(single.blob);
                a.download = single.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(a.href), 10000);
            }
        } else {
            const mode = downloadModeSelect ? downloadModeSelect.value : 'zip';
            if (mode === 'zip') {
                // Multi-file ZIP
                if (typeof window.JSZip === 'undefined') {
                    throw new Error('JSZip library not available for batch packaging.');
                }
                const zip = new window.JSZip();
                const folder = zip.folder("converted_images");
                for (const item of convertedItems) {
                    folder.file(item.name, item.blob);
                }
                const zipContent = await zip.generateAsync({ type: 'blob' });
                if (typeof MobileBridge !== 'undefined') {
                    await MobileBridge.saveFile(zipContent, 'PDFPals_Converted_Images.zip');
                } else {
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(zipContent);
                    a.download = 'PDFPals_Converted_Images.zip';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
                }
            } else {
                // Multi-file Separate Downloads (Solely)
                for (let i = 0; i < convertedItems.length; i++) {
                    const single = convertedItems[i];
                    statusMsg.textContent = `Saving ${single.name} (${i + 1}/${convertedItems.length})...`;
                    if (typeof MobileBridge !== 'undefined') {
                        await MobileBridge.saveFile(single.blob, single.name);
                    } else {
                        const a = document.createElement('a');
                        a.href = URL.createObjectURL(single.blob);
                        a.download = single.name;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        setTimeout(() => URL.revokeObjectURL(a.href), 10000);
                    }
                    if (i < convertedItems.length - 1) {
                        await new Promise(r => setTimeout(r, 350));
                    }
                }
            }
        }

        progressBar.style.width = '100%';
        let msg = `Done! Successfully converted ${convertedItems.length} image(s).`;
        if (failedItems.length > 0) {
            msg += ` (${failedItems.length} image(s) skipped)`;
            alert(`Converted ${convertedItems.length} file(s) successfully!\n\n${failedItems.length} file(s) were skipped due to unsupported internal container format:\n` + failedItems.map(f => `• ${f.name} (${f.error})`).join('\n'));
        }
        statusMsg.textContent = msg;

        setTimeout(() => {
            progressContainer.classList.add('hidden');
            progressBar.style.width = '0%';
        }, 4000);

    } catch (err) {
        console.error('Conversion failed:', err);
        alert('Conversion failed: ' + err.message);
        statusMsg.textContent = 'Error occurred during conversion.';
    } finally {
        convertBtn.disabled = false;
        updateConvertBtnText();
    }
});
