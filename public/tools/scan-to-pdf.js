const setupZone = document.getElementById('setup-zone');
const startCameraBtn = document.getElementById('start-camera-btn');
const workspace = document.getElementById('workspace');
const video = document.getElementById('viewfinder');
const canvas = document.getElementById('capture-canvas');
const captureBtn = document.getElementById('capture-btn');
const switchCameraBtn = document.getElementById('switch-camera-btn');
const cameraSelector = document.getElementById('camera-selector'); // New selector
const filterSelector = document.getElementById('filter-selector'); // New filter selector
const imageGrid = document.getElementById('image-grid');
const exportBtn = document.getElementById('export-btn');
const extractTextBtn = document.getElementById('extract-text-btn'); // New OCR Button
const pageCountSpan = document.getElementById('page-count');
const resetCameraBtn = document.getElementById('reset-camera-btn');

// --- OCR Modal Elements ---
const ocrModal = document.getElementById('ocr-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const ocrProgressContainer = document.getElementById('ocr-progress-container');
const ocrProgressText = document.getElementById('ocr-progress-text');
const ocrProgressPercent = document.getElementById('ocr-progress-percent');
const ocrProgressBar = document.getElementById('ocr-progress-bar');
const ocrResultText = document.getElementById('ocr-result-text');
const ocrStatus = document.getElementById('ocr-status');
const copyTextBtn = document.getElementById('copy-text-btn');
const downloadTxtBtn = document.getElementById('download-txt-btn');

// --- Manual Crop UI Elements ---
const liveCameraView = document.getElementById('live-camera-view');
const cropView = document.getElementById('crop-view');
const cropWrapper = document.getElementById('crop-wrapper');
const cropPhoto = document.getElementById('crop-photo');
const cropCanvas = document.getElementById('crop-canvas');
const retakeBtn = document.getElementById('retake-btn');
const applyCropBtn = document.getElementById('apply-crop-btn');

let currentStream = null;
let useFrontCamera = false;
let capturedImages = []; // Array of base64 data URLs

// --- OpenCV Document Detection Globals ---
const overlayCanvas = document.getElementById('overlay-canvas');
let overlayCtx = null;
if (overlayCanvas) overlayCtx = overlayCanvas.getContext('2d');
let cvLoaded = false;
let loopId = null;
let detectedCorners = null;

// --- AI Engine Initialization ---
function onAiReady() {
    if (cvLoaded) return;
    cvLoaded = true;
    console.log("Optimized: AI Neural Engine is fully loaded and ready.");

    const badge = document.getElementById('ai-status');
    if (badge) {
        badge.textContent = '🚀 AI Engine Ready';
        badge.style.color = '#10b981';
    }

    if (currentStream && video.videoWidth && !loopId) {
        startProcessingLoop();
    }
}

// Immediate check in case script loaded before module
if (window.cvInit || (window.cv && window.cv.onRuntimeInitialized)) {
    onAiReady();
} else if (window.cv) {
    window.cv.onRuntimeInitialized = onAiReady;
}

// Fallback listener
document.addEventListener('cvLoaded', onAiReady);

// --- Camera Logic ---

startCameraBtn.addEventListener('click', () => {
    // We request basic access first to trigger the permission prompt
    // This allows enumerateDevices to get actual labels
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(stream => {
            // Immediately stop this initial stream, it was just for permissions
            stream.getTracks().forEach(track => track.stop());
            return loadDevices();
        })
        .then(() => startCamera())
        .catch(err => handleCameraError(err));
});

switchCameraBtn.addEventListener('click', toggleCamera);
cameraSelector.addEventListener('change', startCamera);

// --- Camera Logic ---

async function loadDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');

        cameraSelector.innerHTML = ''; // Clear loading text

        if (videoDevices.length === 0) {
            cameraSelector.innerHTML = '<option value="">No cameras found</option>';
            return;
        }

        videoDevices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `Camera ${cameraSelector.length + 1}`;
            cameraSelector.appendChild(option);
        });
    } catch (err) {
        console.error("Error listing devices:", err);
    }
}

async function startCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }

    const selectedDeviceId = cameraSelector.value;

    // Base constraints - relaxed resolution to avoid crashing on basic webcams
    const constraints = {
        video: {
            width: { ideal: 1280 }, // 720p is safer for broader compatibility than 1080p
            height: { ideal: 720 }
        },
        audio: false
    };

    // Apply specific constraints if a device is selected or front/back is requested
    if (selectedDeviceId) {
        constraints.video.deviceId = { exact: selectedDeviceId };
    } else {
        constraints.video.facingMode = useFrontCamera ? "user" : "environment";
    }

    try {
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = currentStream;

        video.onloadedmetadata = () => {
            setupZone.classList.add('hidden');
            workspace.classList.remove('hidden');
            if (cvLoaded) startProcessingLoop();
        };

    } catch (err) {
        console.warn("High-res camera failed, trying fallback...", err);
        try {
            // Fallback: Standard 640x480 or just "any video"
            currentStream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = currentStream;
            video.onloadedmetadata = () => {
                setupZone.classList.add('hidden');
                workspace.classList.remove('hidden');
                if (cvLoaded) startProcessingLoop();
            };
        } catch (fallbackErr) {
            handleCameraError(err); // Show original error if even fallback fails
        }
    }
}

function handleCameraError(err) {
    const errorMsg = MobileBridge.getCameraErrorMessage(err);
    alert(errorMsg);
}
function toggleCamera() {
    useFrontCamera = !useFrontCamera;
    startCamera();
}

// Ensure camera stops when leaving page
window.addEventListener('beforeunload', () => {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
});

if (resetCameraBtn) {
    resetCameraBtn.onclick = () => {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
        capturedImages = [];
        updateGallery();
        workspace.classList.add('hidden');
        setupZone.classList.remove('hidden');
        if (loopId) {
            cancelAnimationFrame(loopId);
            loopId = null;
        }
    };
}

// --- Capture & Crop Logic ---

captureBtn.addEventListener('click', captureFrame);

retakeBtn.addEventListener('click', () => {
    // Hide crop view, show live camera
    cropView.style.display = 'none';
    cropView.classList.add('hidden');
    liveCameraView.style.display = 'flex';
    liveCameraView.classList.remove('hidden');

    // Resume document detection loop
    startProcessingLoop();
});

// Global state for crop points
let cropPoints = [];
let draggingPointIndex = -1;
let fullResCanvas = document.createElement('canvas'); // Holds the uncompressed full-res photo

function captureFrame() {
    if (!video.videoWidth) return;

    // 1. Pause the OpenCV processing loop to save CPU
    if (loopId) {
        cancelAnimationFrame(loopId);
        loopId = null;
    }

    // 2. Capture FULL RESOLUTION frame from the video feed
    fullResCanvas.width = video.videoWidth;
    fullResCanvas.height = video.videoHeight;
    const ctx = fullResCanvas.getContext('2d');
    ctx.drawImage(video, 0, 0, fullResCanvas.width, fullResCanvas.height);

    // 3. Set the image source for the Crop View
    cropPhoto.src = fullResCanvas.toDataURL('image/jpeg', 1.0);

    // 4. Initialize Crop Points (use OpenCV detection if available, else default rect)
    initCropPoints();

    // 5. Swap UI: Hide Live Camera, Show Crop View
    liveCameraView.style.display = 'none';
    liveCameraView.classList.add('hidden');
    cropView.style.display = 'flex';
    cropView.classList.remove('hidden');

    // 6. Wait for the image to render, then setup the interactive crop canvas overlay
    cropPhoto.onload = () => {
        setupCropCanvas();
        drawCropOverlay();
    };
}

function initCropPoints() {
    // If OpenCV found a document in the live feed just before capture, use those coordinates!
    if (detectedCorners && cvLoaded && detectedCorners.length === 4) {
        // detectedCorners are scaled to the video feed overlay. 
        // We will store them natively (0.0 to 1.0 relative scale) so they match 
        // regardless of the CSS size of the cropPhoto box.
        cropPoints = detectedCorners.map(pt => ({
            x: pt.x / video.videoWidth,
            y: pt.y / video.videoHeight
        }));
    } else {
        // Fallback: Default to a box that is 10% from the edges
        const margin = 0.1;
        cropPoints = [
            { x: margin, y: margin },             // Top-Left
            { x: 1 - margin, y: margin },         // Top-Right
            { x: 1 - margin, y: 1 - margin },     // Bottom-Right
            { x: margin, y: 1 - margin }          // Bottom-Left
        ];
    }
}

function setupCropCanvas() {
    // Make the wrapper exactly the size of the rendered image
    const rect = cropPhoto.getBoundingClientRect();
    cropWrapper.style.width = `${rect.width}px`;
    cropWrapper.style.height = `${rect.height}px`;

    // Match canvas internal resolution to its CSS layout size for 1:1 crisp drawing
    cropCanvas.width = rect.width;
    cropCanvas.height = rect.height;
}

// Ensure the crop canvas stays aligned if the user resizes the window
window.addEventListener('resize', () => {
    if (!cropView.classList.contains('hidden') && cropPhoto.src) {
        setupCropCanvas();
        drawCropOverlay();
    }
});

function drawCropOverlay() {
    const ctx = cropCanvas.getContext('2d');
    const w = cropCanvas.width;
    const h = cropCanvas.height;

    ctx.clearRect(0, 0, w, h);

    if (cropPoints.length !== 4) return;

    // Convert relative coordinates (0.0 - 1.0) to absolute Canvas pixels
    const pts = cropPoints.map(p => ({ x: p.x * w, y: p.y * h }));

    // Format the path
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 4; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();

    // 1. Draw the transluscent blue overlay *inside* the crop area
    ctx.fillStyle = 'rgba(139, 92, 246, 0.2)'; // Tailwind violet-500
    ctx.fill();

    // 2. Dim the outside of the crop area
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fill({ fillRule: 'evenodd' }); // Creates a transparent hole where the polygon is
    ctx.fillRect(0, 0, w, h); // Try to fill entire screen, but rule prevents filling inner polygon

    // Quick and dirty way to draw the inverted mask (everything EXCEPT the polygon)
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath();
    // Clockwise outer box
    ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.lineTo(0, 0);
    // Counter-clockwise inner polygon
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.lineTo(pts[3].x, pts[3].y);
    ctx.lineTo(pts[2].x, pts[2].y);
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.closePath();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fill();

    // Redraw the inner tinted polygon
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < 4; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(139, 92, 246, 0.2)';
    ctx.fill();

    // 3. Draw the thick border
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#8b5cf6';
    ctx.stroke();

    // 4. Draw the 4 draggable corner nodes
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 4;
    pts.forEach((pt, i) => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    });
}

// --- Crop Canvas Interaction Logic ---

function getEventPos(e) {
    const rect = cropCanvas.getBoundingClientRect();
    // Support both mouse and touch events
    const clientX = e.touches && e.touches.length > 0 ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches && e.touches.length > 0 ? e.touches[0].clientY : e.clientY;
    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}

function handlePointerDown(e) {
    if (cropPoints.length !== 4) return;

    const pos = getEventPos(e);
    const w = cropCanvas.width;
    const h = cropCanvas.height;

    // Map absolute mouse pixels back to relative 0.0-1.0 coordinate space
    const relX = pos.x / w;
    const relY = pos.y / h;

    // Hit-testing (radius of ~40 pixels for easy finger tapping)
    const hitRadius = 40 / Math.min(w, h);

    let closestIndex = -1;
    let minDiff = hitRadius * hitRadius;

    cropPoints.forEach((pt, i) => {
        const dx = pt.x - relX;
        const dy = pt.y - relY;
        const distSq = dx * dx + dy * dy;
        if (distSq < minDiff) {
            minDiff = distSq;
            closestIndex = i;
        }
    });

    if (closestIndex !== -1) {
        draggingPointIndex = closestIndex;
        e.preventDefault(); // Prevent scrolling on mobile while dragging
    }
}

function handlePointerMove(e) {
    if (draggingPointIndex === -1) return;
    e.preventDefault();

    const pos = getEventPos(e);
    // Clamp to canvas boundaries 0.0-1.0
    const relX = Math.max(0, Math.min(1, pos.x / cropCanvas.width));
    const relY = Math.max(0, Math.min(1, pos.y / cropCanvas.height));

    cropPoints[draggingPointIndex] = { x: relX, y: relY };

    // Use requestAnimationFrame so dragging is buttery smooth 
    requestAnimationFrame(drawCropOverlay);
}

function handlePointerUp() {
    draggingPointIndex = -1;
}

// Bind Mouse
cropCanvas.addEventListener('mousedown', handlePointerDown);
window.addEventListener('mousemove', handlePointerMove);
window.addEventListener('mouseup', handlePointerUp);

// Bind Touch
cropCanvas.addEventListener('touchstart', handlePointerDown, { passive: false });
window.addEventListener('touchmove', handlePointerMove, { passive: false });
window.addEventListener('touchend', handlePointerUp);

// --- Apply Crop & Filter Logic ---

applyCropBtn.addEventListener('click', applyCropAndFilter);

function applyCropAndFilter() {
    if (!cvLoaded) {
        alert("The AI Processing Engine (OpenCV) is still warming up. Please wait a few seconds and try again.");
        return;
    }
    if (cropPoints.length !== 4) return;

    // Slight delay to allow UI to update to "Processing..."
    setTimeout(() => {
        try {
            // 1. Load the original full-res photo we stored earlier
            let src = cv.imread(fullResCanvas);

            // 2. Scale the relative 0.0-1.0 Crop Points back up to the full-res photo dimensions
            const fw = fullResCanvas.width;
            const fh = fullResCanvas.height;
            const scaledPts = cropPoints.map(p => ({ x: p.x * fw, y: p.y * fh }));

            // 3. Ensure Clockwise Ordering (Top-Left, Top-Right, Bottom-Right, Bottom-Left)
            let ordered = orderPoints(scaledPts);
            let tl = ordered[0], tr = ordered[1], br = ordered[2], bl = ordered[3];

            // 4. Calculate Final Bounding Box Dimensions
            let widthA = Math.sqrt(Math.pow(br.x - bl.x, 2) + Math.pow(br.y - bl.y, 2));
            let widthB = Math.sqrt(Math.pow(tr.x - tl.x, 2) + Math.pow(tr.y - tl.y, 2));
            let maxWidth = Math.max(Math.round(widthA), Math.round(widthB));

            let heightA = Math.sqrt(Math.pow(tr.x - br.x, 2) + Math.pow(tr.y - br.y, 2));
            let heightB = Math.sqrt(Math.pow(tl.x - bl.x, 2) + Math.pow(tl.y - bl.y, 2));
            let maxHeight = Math.max(Math.round(heightA), Math.round(heightB));

            // 5. Build Warp Matrices
            let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
                tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y
            ]);

            let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
                0, 0, maxWidth - 1, 0, maxWidth - 1, maxHeight - 1, 0, maxHeight - 1
            ]);

            // 6. Execute Perspective Warp
            let M = cv.getPerspectiveTransform(srcTri, dstTri);
            let warped = new cv.Mat();
            let dsize = new cv.Size(maxWidth, maxHeight);
            cv.warpPerspective(src, warped, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

            // 7. Write Warped Image to the main capture canvas
            canvas.width = maxWidth;
            canvas.height = maxHeight;
            cv.imshow(canvas, warped);

            // Cleanup OpenCV memory
            src.delete(); srcTri.delete(); dstTri.delete(); M.delete(); warped.delete();

            // 8. Apply User's Selected Filter (e.g. B&W Magic Filter)
            let ctx = canvas.getContext('2d');
            applyFilter(ctx, canvas.width, canvas.height, filterSelector.value);

            // 9. Save heavily optimized JPG to Gallery
            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
            capturedImages.push(dataUrl);
            updateGallery();

            // 10. Return to Live Camera
            retakeBtn.click(); // Re-use the retake logic to hide crop and show cam

        } catch (e) {
            console.error("Manual Crop Error:", e);
            alert("An error occurred during cropping. Please try again.");
        } finally {
            applyCropBtn.disabled = false;
            applyCropBtn.textContent = 'Crop & Apply Filter';
        }
    }, 50);
}


function applyFilter(ctx, width, height, filterType) {
    if (filterType === 'none') return;

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const len = data.length;

    // 1. Convert to grayscale
    const grays = new Float32Array(width * height);
    for (let i = 0, j = 0; i < len; i += 4, j++) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        grays[j] = 0.299 * r + 0.587 * g + 0.114 * b;

        if (filterType === 'grayscale') {
            data[i] = data[i + 1] = data[i + 2] = grays[j];
        }
    }

    if (filterType === 'grayscale') {
        ctx.putImageData(imageData, 0, 0);
        return;
    }

    if (filterType === 'bw') {
        if (!cvLoaded) {
            console.warn("OpenCV not ready yet, skipping advanced B&W filter.");
            return;
        }

        // --- Native OpenCV High-Fidelity Document Binarization ---
        try {
            let src = cv.imread(canvas);
            let gray = new cv.Mat();
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

            // --- 1. Shadow Removal (Illumination Normalization) ---
            // Create a highly blurred "background" map that estimates the paper's lighting gradients.
            // Using 15% guarantees that even dense blocks of math equations are blurred into uniformity.
            let k = Math.max(51, Math.floor(Math.min(canvas.width, canvas.height) * 0.15));
            if (k % 2 === 0) k++; // Kernel size must be odd

            let bg = new cv.Mat();
            cv.GaussianBlur(gray, bg, new cv.Size(k, k), 0, 0, cv.BORDER_DEFAULT);

            // Convert to 32-bit floats for mathematical division
            let grayF = new cv.Mat();
            let bgF = new cv.Mat();
            gray.convertTo(grayF, cv.CV_32F);
            bg.convertTo(bgF, cv.CV_32F);

            // Normalize the image: norm = (gray / bg) * 255
            // This mathematically erases shadows! The paper becomes ~255 (white), text stays darker.
            let normF = new cv.Mat();
            cv.divide(grayF, bgF, normF, 255.0);

            let norm = new cv.Mat();
            normF.convertTo(norm, cv.CV_8U);

            // --- 2. CLAHE (Contrast Limited Adaptive Histogram Equalization) ---
            // This is MakeACopy's secret weapon for faint pencil on lined paper.
            // It aggressively boosts the local contrast of the thin grey pencil strokes.
            let clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
            clahe.apply(norm, norm);

            // --- 3. Median Blur (Clears salt & pepper paper noise) ---
            cv.medianBlur(norm, norm, 3);

            // --- 4. OpenCV Adaptive Thresholding (Crisping the text) ---
            let bw = new cv.Mat();
            // Block Size = min dimension / 20 (Prevents thick ruled lines from blowing up)
            let bs = Math.max(51, Math.floor(Math.min(canvas.width, canvas.height) / 20) | 1);
            if (bs % 2 === 0) bs++;

            // C = 7 (Perfect offset for protecting faint strokes without picking up background gradients)
            cv.adaptiveThreshold(norm, bw, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, bs, 7);

            // --- 5. MakeACopy's despeckleFast() Logic ---
            // Invert the textual lines so they are white (255) and background is black (0)
            let inv = new cv.Mat();
            cv.bitwise_not(bw, inv);

            // MORPH_OPEN (Erosion followed by Dilation)
            // Erosion naturally wipes out tiny 1-2px dots (noise/texture that Adaptive Threshold picked up).
            // Dilation then safely restores the surviving core text to its original thickness.
            let kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(2, 2));
            cv.morphologyEx(inv, inv, cv.MORPH_OPEN, kernel);

            // Re-invert back to black text on white background
            cv.bitwise_not(inv, bw);

            // Render result back to canvas
            cv.imshow(canvas, bw);

            // Cleanup memory
            src.delete(); gray.delete(); bg.delete();
            grayF.delete(); bgF.delete(); normF.delete(); norm.delete();
            clahe.delete(); bw.delete(); inv.delete(); kernel.delete();
            ctx = canvas.getContext('2d'); // Update context variable if needed
        } catch (e) {
            console.error("OpenCV B&W Filter Error:", e);
        }
    }
}

function updateGallery() {
    imageGrid.innerHTML = '';

    capturedImages.forEach((dataUrl, index) => {
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';

        const thumbnailDiv = document.createElement('div');
        thumbnailDiv.className = 'image-thumbnail';

        const img = document.createElement('img');
        img.src = dataUrl;
        thumbnailDiv.appendChild(img);

        const pageLabel = document.createElement('div');
        pageLabel.className = 'page-number';
        pageLabel.textContent = `Page ${index + 1}`;

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.title = 'Remove Image';
        deleteBtn.onclick = () => {
            capturedImages.splice(index, 1);
            updateGallery();
        };

        imageItem.appendChild(deleteBtn);
        imageItem.appendChild(thumbnailDiv);
        imageItem.appendChild(pageLabel);

        imageGrid.appendChild(imageItem);
    });

    pageCountSpan.textContent = capturedImages.length;
    exportBtn.disabled = capturedImages.length === 0;
    extractTextBtn.disabled = capturedImages.length === 0;
}

// --- PDF Generation Logic ---

exportBtn.addEventListener('click', generatePdf);

async function generatePdf() {
    if (capturedImages.length === 0) return;

    exportBtn.disabled = true;
    exportBtn.textContent = 'Generating PDF...';

    try {
        const pdfDoc = await window.PDFLib.PDFDocument.create();

        for (const dataUrl of capturedImages) {
            // Load image depending on mime type (should always be jpeg from our capture)
            const imageBytes = await fetch(dataUrl).then(res => res.arrayBuffer());
            let pdfImage;

            if (dataUrl.includes('image/jpeg')) {
                pdfImage = await pdfDoc.embedJpg(imageBytes);
            } else if (dataUrl.includes('image/png')) {
                pdfImage = await pdfDoc.embedPng(imageBytes);
            } else {
                continue; // Skip unsupported formats
            }

            // A4 page size (Standard)
            const page = pdfDoc.addPage([595.28, 841.89]); // A4 in points
            const { width: pageWidth, height: pageHeight } = page.getSize();

            // Calculate scale to fit image into A4 page while maintaining aspect ratio
            const imgDims = pdfImage.scale(1);
            const scaleX = pageWidth / imgDims.width;
            const scaleY = pageHeight / imgDims.height;
            const scale = Math.min(scaleX, scaleY) * 0.95; // 0.95 adds a small margin

            const drawWidth = imgDims.width * scale;
            const drawHeight = imgDims.height * scale;

            // Center image on page
            page.drawImage(pdfImage, {
                x: (pageWidth - drawWidth) / 2,
                y: (pageHeight - drawHeight) / 2,
                width: drawWidth,
                height: drawHeight,
            });
        }

        pdfDoc.setProducer('PDFPals');
        pdfDoc.setCreator('PDFPals');
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const fileName = `Scanned_Document_${timestamp}.pdf`;
        await MobileBridge.saveFile(blob, fileName);

    } catch (error) {
        console.error("PDF Generation Error:", error);
        alert("Failed to generate PDF. Make sure images are valid.");
    } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = 'Save Scan ➔';
    }
}

// --- Text Extraction (OCR) Logic ---

extractTextBtn.addEventListener('click', runOCR);

closeModalBtn.addEventListener('click', () => {
    ocrModal.classList.add('hidden');
});

async function runOCR() {
    if (capturedImages.length === 0) return;

    // Show modal and reset UI
    ocrModal.classList.remove('hidden');
    ocrProgressContainer.classList.remove('hidden');
    ocrResultText.value = '';
    ocrStatus.textContent = '';
    extractTextBtn.disabled = true;
    extractTextBtn.textContent = 'Extracting...';

    let allExtractedText = '';

    try {
        // Load English, Simplified Chinese, and Traditional Chinese AI models
        const worker = await Tesseract.createWorker('eng+chi_sim+chi_tra', 1, {
            logger: m => {
                if (m.status === 'recognizing text') {
                    ocrProgressText.textContent = `Processing Page...`;
                    ocrProgressPercent.textContent = `${Math.round(m.progress * 100)}%`;
                    ocrProgressBar.style.width = `${Math.round(m.progress * 100)}%`;
                } else {
                    ocrProgressText.textContent = m.status;
                }
            }
        });

        for (let i = 0; i < capturedImages.length; i++) {
            ocrProgressText.textContent = `Reading Page ${i + 1} of ${capturedImages.length}...`;

            // Run Tesseract on the base64 B&W image that was already cleaned by OpenCV
            const ret = await worker.recognize(capturedImages[i]);

            allExtractedText += `----- Page ${i + 1} -----\n\n`;
            allExtractedText += ret.data.text + '\n\n';

            // Stream text sequentially as it completes pages
            ocrResultText.value = allExtractedText;
            ocrResultText.scrollTop = ocrResultText.scrollHeight;
        }

        await worker.terminate();

        ocrProgressContainer.classList.add('hidden');
        ocrStatus.textContent = '✓ Extraction Complete';

    } catch (e) {
        console.error("OCR Failed:", e);
        ocrProgressText.textContent = "Error: Text extraction failed.";
        ocrProgressContainer.classList.add('hidden');
        ocrResultText.value = "An error occurred during text extraction. Please try scanning again with clearer lighting.";
    } finally {
        extractTextBtn.disabled = false;
        extractTextBtn.textContent = 'OCR Text';
    }
}

// Copy & Download Functions
copyTextBtn.addEventListener('click', () => {
    if (!ocrResultText.value) return;
    navigator.clipboard.writeText(ocrResultText.value).then(() => {
        const originalText = copyTextBtn.textContent;
        copyTextBtn.textContent = '✓ Copied!';
        setTimeout(() => copyTextBtn.textContent = originalText, 2000);
    });
});

downloadTxtBtn.addEventListener('click', async () => {
    if (!ocrResultText.value) return;
    const blob = new Blob([ocrResultText.value], { type: 'text/plain' });
    const fileName = `Extracted_Text_${new Date().toISOString().slice(0, 10)}.txt`;
    await MobileBridge.saveFile(blob, fileName);
});

// --- OpenCV Document Edge Detection Engine ---

const FPS = 10;
let lastProcessTime = 0;

function startProcessingLoop() {
    if (!cvLoaded || !video.videoWidth || !overlayCanvas) return;
    if (loopId) cancelAnimationFrame(loopId);

    overlayCanvas.width = video.videoWidth;
    overlayCanvas.height = video.videoHeight;
    loopId = requestAnimationFrame(processVideo);
}

function processVideo() {
    if (!currentStream || !cvLoaded || video.paused || video.ended) return;

    const now = Date.now();
    if (now - lastProcessTime > 1000 / FPS) {
        lastProcessTime = now;
        detectDocument();
    }
    loopId = requestAnimationFrame(processVideo);
}

function detectDocument() {
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height || !overlayCanvas) return;

    if (overlayCanvas.width !== width) {
        overlayCanvas.width = width;
        overlayCanvas.height = height;
    }

    const capCanvas = document.createElement('canvas');
    capCanvas.width = width;
    capCanvas.height = height;
    capCanvas.getContext('2d').drawImage(video, 0, 0, width, height);

    let src;
    try {
        src = cv.imread(capCanvas);
    } catch (e) {
        return;
    }

    // Downscale for real-time performance
    const maxDim = 600;
    let scale = Math.max(width, height) > maxDim ? maxDim / Math.max(width, height) : 1;

    let downscaled = new cv.Mat();
    cv.resize(src, downscaled, new cv.Size(Math.round(width * scale), Math.round(height * scale)));

    let gray = new cv.Mat();
    cv.cvtColor(downscaled, gray, cv.COLOR_RGBA2GRAY, 0);

    let blurred = new cv.Mat();
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

    let edges = new cv.Mat();
    cv.Canny(blurred, edges, 75, 200);

    let kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    cv.dilate(edges, edges, kernel, new cv.Point(-1, -1), 1);

    let contours = new cv.MatVector();
    let hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    let maxArea = 0;
    let bestApprox = new cv.Mat();
    let found = false;
    const minArea = (downscaled.cols * downscaled.rows) * 0.05; // Dropped to 5% for extreme closeups

    for (let i = 0; i < contours.size(); ++i) {
        let cnt = contours.get(i);
        let area = cv.contourArea(cnt);
        if (area > minArea && area > maxArea) {
            let peri = cv.arcLength(cnt, true);
            let approx = new cv.Mat();

            // Much looser approximation (0.05 instead of 0.02) to handle slightly curved pages
            cv.approxPolyDP(cnt, approx, 0.05 * peri, true);

            if (approx.rows === 4) {
                if (cv.isContourConvex(approx)) {
                    maxArea = area;
                    approx.copyTo(bestApprox);
                    found = true;
                }
            } else if (approx.rows > 4) {
                // If it finds more than 4 points (e.g. rounded page corners)
                // Try a convex hull, then approximate that hull to 4 points.
                let hull = new cv.Mat();
                cv.convexHull(approx, hull, false, true);
                let hullPeri = cv.arcLength(hull, true);
                let hullApprox = new cv.Mat();
                cv.approxPolyDP(hull, hullApprox, 0.05 * hullPeri, true);

                if (hullApprox.rows === 4 && cv.isContourConvex(hullApprox)) {
                    maxArea = area;
                    hullApprox.copyTo(bestApprox);
                    found = true;
                }
                hull.delete(); hullApprox.delete();
            }
            approx.delete();
        }
        cnt.delete();
    }

    overlayCtx.clearRect(0, 0, width, height);

    if (found) {
        detectedCorners = [];
        for (let i = 0; i < 4; i++) {
            detectedCorners.push({
                x: bestApprox.data32S[i * 2] / scale,
                y: bestApprox.data32S[i * 2 + 1] / scale
            });
        }

        // Draw Document Boundaries
        overlayCtx.beginPath();
        overlayCtx.moveTo(detectedCorners[0].x, detectedCorners[0].y);
        for (let i = 1; i < 4; i++) {
            overlayCtx.lineTo(detectedCorners[i].x, detectedCorners[i].y);
        }
        overlayCtx.closePath();

        overlayCtx.lineWidth = 3;
        overlayCtx.strokeStyle = 'rgba(0, 150, 255, 0.8)';
        overlayCtx.fillStyle = 'rgba(0, 150, 255, 0.2)';
        overlayCtx.stroke();
        overlayCtx.fill();

        overlayCtx.fillStyle = 'rgba(0, 150, 255, 1)';
        for (let i = 0; i < 4; i++) {
            overlayCtx.beginPath();
            overlayCtx.arc(detectedCorners[i].x, detectedCorners[i].y, 6, 0, Math.PI * 2);
            overlayCtx.fill();
        }
    } else {
        detectedCorners = null;
    }

    src.delete(); downscaled.delete(); gray.delete(); blurred.delete(); edges.delete(); kernel.delete();
    contours.delete(); hierarchy.delete(); bestApprox.delete();
}

// Ensure clockwise order starting from top-left
function orderPoints(pts) {
    let rect = new Array(4);
    let s = pts.map(p => p.x + p.y);
    rect[0] = pts[s.indexOf(Math.min(...s))];
    rect[2] = pts[s.indexOf(Math.max(...s))];

    let diff = pts.map(p => p.y - p.x);
    rect[1] = pts[diff.indexOf(Math.min(...diff))];
    rect[3] = pts[diff.indexOf(Math.max(...diff))];
    return rect;
}

