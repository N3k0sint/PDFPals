const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.browse-btn');
const fileListContainer = document.getElementById('file-list-container');
const controls = document.getElementById('controls');
const mergeBtn = document.getElementById('merge-btn');
const fileCountSpan = document.getElementById('file-count');
const changePdfBtn = document.getElementById('change-pdf-btn');

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
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    addFiles(files);
});



fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    addFiles(files);
});

mergeBtn.addEventListener('click', mergePDFs);

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

    fileCountSpan.textContent = `${selectedFiles.length} files selected`;
    renderFileList();
}

function renderFileList() {
    fileListContainer.innerHTML = '';
    selectedFiles.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = 'page-card'; // Reusing card style
        item.style.padding = '1rem';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.justifyContent = 'space-between';

        const name = document.createElement('span');
        name.textContent = file.name;
        name.style.fontWeight = '500';

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '✕';
        removeBtn.style.background = 'none';
        removeBtn.style.border = 'none';
        removeBtn.style.color = '#ef4444';
        removeBtn.style.cursor = 'pointer';
        removeBtn.style.fontSize = '1.2rem';
        removeBtn.onclick = () => removeFile(index);

        item.appendChild(name);
        item.appendChild(removeBtn);
        fileListContainer.appendChild(item);
    });
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateUI();
}

async function mergePDFs() {
    if (selectedFiles.length < 2) {
        alert('Please select at least 2 PDF files to merge.');
        return;
    }

    const mergedPdf = await window.PDFLib.PDFDocument.create();

    for (const file of selectedFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await window.PDFLib.PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
    }

    mergedPdf.setProducer('PDFPals');
    mergedPdf.setCreator('PDFPals');
    const pdfBytes = await mergedPdf.save();
    downloadPDF(pdfBytes, 'merged-document.pdf');
}

async function downloadPDF(pdfBytes, filename) {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    await MobileBridge.saveFile(blob, filename);
}

if (changePdfBtn) {
    changePdfBtn.onclick = () => {
        selectedFiles = [];
        updateUI();
        dropZone.classList.remove('hidden');
        fileInput.value = '';
    };
}




browseBtn.addEventListener('click', () => fileInput.click());
