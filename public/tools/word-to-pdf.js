const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const browseBtn = document.querySelector('.browse-btn');
const workspace = document.getElementById('workspace');
const previewContainer = document.getElementById('preview-container');
const previewContent = document.getElementById('preview-content'); // Used as container
const fileNameSpan = document.getElementById('file-name');
// const printBtn = document.getElementById('print-btn');
const changeWordBtn = document.getElementById('change-pdf-btn');
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
    if (file && file.name.endsWith('.docx')) {
        handleFile(file);
    } else {
        alert('Please upload a .docx file.');
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
    reader.onload = function (event) {
        const arrayBuffer = event.target.result;
        renderDocx(arrayBuffer);
    };
    reader.readAsArrayBuffer(file);
}

function renderDocx(arrayBuffer) {
    previewContent.innerHTML = ''; // Clear previous
    docx.renderAsync(arrayBuffer, previewContent, null, {
        inWrapper: true,
        ignoreWidth: false,
        ignoreHeight: false,
        useBase64URL: true /* Fix for some images not showing */
    })
        .then(() => {
            console.log("docx rendered");
        })
        .catch(err => {
            console.error(err);
            alert("Error converting file: " + err.message);
        });
}




browseBtn.addEventListener('click', () => fileInput.click());

if (changeWordBtn) {
    changeWordBtn.onclick = () => {
        previewContent.innerHTML = '';
        dropZone.classList.remove('hidden');
        workspace.classList.add('hidden');
        previewContainer.classList.add('hidden');
        fileInput.value = '';
    };
}
