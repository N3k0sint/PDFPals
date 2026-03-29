const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.browse-btn');
const workspace = document.getElementById('workspace');
const previewContainer = document.getElementById('preview-container');
const previewContent = document.getElementById('preview-content');
const fileNameSpan = document.getElementById('file-name');
// const printBtn = document.getElementById('print-btn');
const changeExcelBtn = document.getElementById('change-pdf-btn');
const convertBtn = document.getElementById('convert-btn');

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
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
        handleFile(file);
    } else {
        alert('Please upload an Excel file (.xlsx or .xls).');
    }
});



fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
});

// printBtn removed
convertBtn.addEventListener('click', () => {
    window.print(); // Triggers the @media print CSS rules to save as PDF
});

function handleFile(file) {
    fileNameSpan.textContent = file.name;
    dropZone.classList.add('hidden');
    workspace.classList.remove('hidden');
    previewContainer.classList.remove('hidden');

    const reader = new FileReader();
    reader.onload = function (e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        // Convert first sheet to HTML
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const html = XLSX.utils.sheet_to_html(worksheet);

        previewContent.innerHTML = html;
    };
    reader.readAsArrayBuffer(file);
}




browseBtn.addEventListener('click', () => fileInput.click());

if (changeExcelBtn) {
    changeExcelBtn.onclick = () => {
        previewContent.innerHTML = '';
        dropZone.classList.remove('hidden');
        workspace.classList.add('hidden');
        previewContainer.classList.add('hidden');
        fileInput.value = '';
    };
}
