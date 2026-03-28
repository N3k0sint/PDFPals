const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.browse-btn');
const fileListContainer = document.getElementById('file-list-container');
const controls = document.getElementById('controls');
const convertBtn = document.getElementById('convert-btn');
const fileCountSpan = document.getElementById('file-count');
const changeImagesBtn = document.getElementById('change-images-btn');

let selectedFiles = [];

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
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    addFiles(files);
});



fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    addFiles(files);
});

convertBtn.addEventListener('click', convertToPDF);

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
        item.className = 'page-card';
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

        item.appendChild(img);
        item.appendChild(removeBtn);
        fileListContainer.appendChild(item);
    });
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateUI();
}

async function convertToPDF() {
    if (selectedFiles.length === 0) return;

    const newPdf = await window.PDFLib.PDFDocument.create();

    for (const file of selectedFiles) {
        const arrayBuffer = await file.arrayBuffer();
        let image;

        if (file.type === 'image/jpeg') {
            image = await newPdf.embedJpg(arrayBuffer);
        } else if (file.type === 'image/png') {
            image = await newPdf.embedPng(arrayBuffer);
        } else {
            continue; // Skip unsupported
        }

        const page = newPdf.addPage([image.width, image.height]);
        page.drawImage(image, {
            x: 0,
            y: 0,
            width: image.width,
            height: image.height,
        });
    }

    newPdf.setProducer('PDFPals');
    newPdf.setCreator('PDFPals');
    const pdfBytes = await newPdf.save();
    downloadPDF(pdfBytes, 'images_converted.pdf');
}

async function downloadPDF(pdfBytes, filename) {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    await MobileBridge.saveFile(blob, filename);
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
