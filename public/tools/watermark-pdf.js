const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.browse-btn');
const fileNameDisplay = document.getElementById('file-name');

// Settings
const wmText = document.getElementById('wm-text');
const wmMosaic = document.getElementById('wm-mosaic');
const wmColor = document.getElementById('wm-color');
const wmOpacity = document.getElementById('wm-opacity');
const wmRotation = document.getElementById('wm-rotation');
const wmSize = document.getElementById('wm-size');
const gridBtns = document.querySelectorAll('.grid-btn');
const applyBtn = document.getElementById('apply-btn');
const changePdfBtn = document.getElementById('change-pdf-btn');
const workspace = document.getElementById('workspace');

let pdfBytes = null;
let currentPos = 'middle-center';

// Tab Switching
const tabText = document.getElementById('tab-text');
const tabImage = document.getElementById('tab-image');
const textSettings = document.getElementById('text-settings');
const imageSettings = document.getElementById('image-settings');
const wmImgScale = document.getElementById('wm-img-scale');
const wmImgScaleSlider = document.getElementById('wm-img-scale-slider');

let activeMode = 'text'; // 'text' or 'image'

wmImgScaleSlider.addEventListener('input', (e) => {
    wmImgScale.value = e.target.value;
});

wmImgScale.addEventListener('input', (e) => {
    wmImgScaleSlider.value = e.target.value;
});

tabText.addEventListener('click', () => {
    tabText.classList.add('active');
    tabImage.classList.remove('active');
    textSettings.classList.remove('hidden');
    imageSettings.classList.add('hidden');
    activeMode = 'text';
});

tabImage.addEventListener('click', () => {
    tabImage.classList.add('active');
    tabText.classList.remove('active');
    imageSettings.classList.remove('hidden');
    textSettings.classList.add('hidden');
    activeMode = 'image';
});

// Image Handling
const wmImageInput = document.getElementById('wm-image-input');
const wmImagePreview = document.getElementById('wm-image-preview');
const wmImgTag = document.getElementById('wm-img-tag');
const removeImgBtn = document.getElementById('remove-img-btn');

let wmImageBytes = null;
let wmImageType = null; // 'png' or 'jpg'

wmImageInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
        alert('Please select a PNG or JPG image.');
        return;
    }

    wmImageType = file.type === 'image/png' ? 'png' : 'jpg';
    const buffer = await file.arrayBuffer();
    wmImageBytes = new Uint8Array(buffer);

    wmImgTag.src = URL.createObjectURL(file);
    wmImagePreview.classList.remove('hidden');
});

removeImgBtn.addEventListener('click', () => {
    wmImageBytes = null;
    wmImageType = null;
    wmImgTag.src = '';
    wmImagePreview.classList.add('hidden');
    wmImageInput.value = '';
});

// Position Selection (Existing logic)
gridBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        gridBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPos = btn.dataset.pos;
    });
});

// Drag and drop setup (Existing)
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

    fileNameDisplay.textContent = file.name;
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

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255
    } : { r: 0, g: 0, b: 0 };
}

applyBtn.addEventListener('click', async () => {
    if (!pdfBytes) return;
    if (activeMode === 'image' && !wmImageBytes) {
        alert('Please select a watermark image.');
        return;
    }

    applyBtn.disabled = true;
    applyBtn.textContent = 'Processing...';

    try {
        const opacityStr = wmOpacity.value;
        const opacity = (opacityStr && !isNaN(Number(opacityStr))) ? Number(opacityStr) : 0.5;

        const rotStr = wmRotation.value;
        const rot = (rotStr && !isNaN(Number(rotStr))) ? Number(rotStr) : 0;

        const isMosaic = wmMosaic.checked;

        const pdfDoc = await window.PDFLib.PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();
        const { StandardFonts, rgb, degrees } = window.PDFLib;

        let wmImage = null;
        if (activeMode === 'image') {
            wmImage = wmImageType === 'png'
                ? await pdfDoc.embedPng(wmImageBytes)
                : await pdfDoc.embedJpg(wmImageBytes);
        }

        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        for (const page of pages) {
            const { width, height } = page.getSize();

            if (activeMode === 'text') {
                const textToDraw = String(wmText.value || ' ');
                const fontSizeStr = wmSize.value;
                const fontSize = (fontSizeStr && !isNaN(Number(fontSizeStr))) ? Number(fontSizeStr) : 48;
                const colorInput = wmColor.value;
                const rgbColor = hexToRgb(colorInput);
                const textWidth = font.widthOfTextAtSize(textToDraw, fontSize);
                const textHeight = font.heightAtSize(fontSize);

                const drawProps = {
                    size: fontSize,
                    font: font,
                    color: rgb(rgbColor.r, rgbColor.g, rgbColor.b),
                    opacity: opacity,
                    rotate: degrees(rot),
                };

                if (isMosaic) {
                    const stepX = width / 2;
                    const stepY = height / 3;
                    for (let x = -width; x < width * 2; x += stepX) {
                        for (let y = -height; y < height * 2; y += stepY) {
                            page.drawText(textToDraw, { ...drawProps, x: Number(x), y: Number(y) });
                        }
                    }
                } else {
                    let x = 0, y = 0;
                    if (currentPos.includes('left')) x = 50;
                    else if (currentPos.includes('right')) x = width - textWidth - 50;
                    else x = (width / 2) - (textWidth / 2);

                    if (currentPos.includes('top')) y = height - textHeight - 50;
                    else if (currentPos.includes('bottom')) y = 50;
                    else y = (height / 2) - (textHeight / 2);

                    page.drawText(textToDraw, { ...drawProps, x: Number(x), y: Number(y) });
                }
            } else if (activeMode === 'image' && wmImage) {
                // Image Watermark Logic
                const scaleVal = (parseInt(wmImgScale.value) || 50) / 100;
                const wmDims = wmImage.scale(scaleVal);
                // Ensure image isn't too large
                const maxWidth = width * 0.4;
                if (wmDims.width > maxWidth) {
                    const ratio = maxWidth / wmDims.width;
                    wmDims.width *= ratio;
                    wmDims.height *= ratio;
                }

                const drawProps = {
                    width: wmDims.width,
                    height: wmDims.height,
                    opacity: opacity,
                    rotate: degrees(rot),
                };

                if (isMosaic) {
                    const stepX = width / 2;
                    const stepY = height / 3;
                    for (let x = -width; x < width * 2; x += stepX) {
                        for (let y = -height; y < height * 2; y += stepY) {
                            page.drawImage(wmImage, { ...drawProps, x: Number(x), y: Number(y) });
                        }
                    }
                } else {
                    let x = 0, y = 0;
                    if (currentPos.includes('left')) x = 50;
                    else if (currentPos.includes('right')) x = width - wmDims.width - 50;
                    else x = (width / 2) - (wmDims.width / 2);

                    if (currentPos.includes('top')) y = height - wmDims.height - 50;
                    else if (currentPos.includes('bottom')) y = 50;
                    else y = (height / 2) - (wmDims.height / 2);

                    page.drawImage(wmImage, { ...drawProps, x: Number(x), y: Number(y) });
                }
            }
        }

        pdfDoc.setProducer('PDFPals');
        pdfDoc.setCreator('PDFPals');
        const outBytes = await pdfDoc.save();
        const blob = new Blob([outBytes], { type: 'application/pdf' });
        const fileName = fileNameDisplay.textContent.replace('.pdf', '_watermarked.pdf');
        await MobileBridge.saveFile(blob, fileName);
    } catch (e) {
        console.error("WATERMARK ERROR DETAILS:");
        console.error(e);
        alert(`Failed to apply watermark. Error: ${e.message}`);
    } finally {
        applyBtn.disabled = false;
        applyBtn.textContent = 'Add watermark ➔';
    }
});


browseBtn.addEventListener('click', () => fileInput.click());
