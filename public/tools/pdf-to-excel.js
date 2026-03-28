import * as pdfjsLib from '../vendor/pdfjs-dist/build/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = '../vendor/pdfjs-dist/build/pdf.worker.mjs';

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.browse-btn');
const controls = document.getElementById('controls');
const convertBtn = document.getElementById('convert-btn');
const changePdfBtn = document.getElementById('change-pdf-btn');
const loading = document.getElementById('loading');
const statusMessage = document.getElementById('status-message');
const fileNameSpan = document.getElementById('file-name');

let currentFile = null;

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
        alert('Please upload a PDF file.');
    }
});



fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
});

convertBtn.addEventListener('click', convertToExcel);

function handleFile(file) {
    currentFile = file;
    fileNameSpan.textContent = file.name;
    dropZone.classList.add('hidden');
    controls.classList.remove('hidden');
    statusMessage.classList.add('hidden');
}

async function convertToExcel() {
    if (!currentFile) return;

    showLoading(true);
    controls.classList.add('hidden');

    try {
        const arrayBuffer = await currentFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const totalPages = pdf.numPages;

        const rows = []; // Array of arrays

        for (let i = 1; i <= totalPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();

            // Heuristic: Group items by Y position to form rows
            const items = textContent.items;
            // Sort by Y (descending) then X (ascending)
            items.sort((a, b) => {
                if (Math.abs(a.transform[5] - b.transform[5]) > 5) {
                    return b.transform[5] - a.transform[5]; // Top to bottom
                }
                return a.transform[4] - b.transform[4]; // Left to right
            });

            let currentRow = [];
            let lastY = -1;

            items.forEach(item => {
                if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
                    // New row detected
                    if (currentRow.length > 0) rows.push(currentRow);
                    currentRow = [];
                }
                // Add exact string or try to split by spaces if it looks like columns?
                // For now, simple text content.
                currentRow.push(item.str);
                lastY = item.transform[5];
            });
            if (currentRow.length > 0) rows.push(currentRow);
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, "PDF Data");

        const excelContent = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([excelContent], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const fileName = currentFile.name.replace('.pdf', '.xlsx');
        await MobileBridge.saveFile(blob, fileName);

        statusMessage.textContent = "Conversion Complete! Download started.";
        statusMessage.classList.remove('hidden');

    } catch (error) {
        console.error('Error converting PDF to Excel:', error);
        alert('Error converting file.');
    } finally {
        showLoading(false);
        controls.classList.remove('hidden');
    }
}

function showLoading(show) {
    if (show) loading.classList.remove('hidden');
    else loading.classList.add('hidden');
}




browseBtn.addEventListener('click', () => fileInput.click());

if (changePdfBtn) {
    changePdfBtn.onclick = () => {
        currentFile = null;
        dropZone.classList.remove('hidden');
        controls.classList.add('hidden');
        statusMessage.classList.add('hidden');
        fileInput.value = '';
    };
}
