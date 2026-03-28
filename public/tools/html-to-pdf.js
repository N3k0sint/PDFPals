
document.addEventListener('DOMContentLoaded', () => {
    const htmlInput = document.getElementById('html-input');
    const clearBtn = document.getElementById('clear-editor');
    const loadExampleBtn = document.getElementById('load-example');
    const convertBtn = document.getElementById('convert-html');
    const resetBtn = document.getElementById('reset-editor-btn');
    const renderArea = document.getElementById('render-area');

    const pageSizeSelect = document.getElementById('page-size');
    const orientationSelect = document.getElementById('orientation');
    const marginSelect = document.getElementById('margin');

    const exampleHtml = `<!DOCTYPE html>
<html>
<head>
<style>
    body { font-family: sans-serif; padding: 20px; color: #333; }
    .header { color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px; }
    .card { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #e5e7eb; }
</style>
</head>
<body>
    <h1 class="header">Invoice #12345</h1>
    <p>Date: March 14, 2026</p>
    
    <div class="card">
        <h3>Customer Information</h3>
        <p><strong>Name:</strong> John Doe</p>
        <p><strong>Email:</strong> john@example.com</p>
    </div>

    <h3>Order Summary</h3>
    <table>
        <thead>
            <tr><th>Product</th><th>Qty</th><th>Price</th></tr>
        </thead>
        <tbody>
            <tr><td>Premium PDF Tool</td><td>1</td><td>$19.99</td></tr>
            <tr><td>Cloud Storage</td><td>1</td><td>$5.00</td></tr>
        </tbody>
    </table>
    
    <p style="text-align: right; font-size: 1.2rem;"><strong>Total: $24.99</strong></p>
</body>
</html>`;

    loadExampleBtn.onclick = () => {
        htmlInput.value = exampleHtml;
    };

    clearBtn.onclick = () => {
        htmlInput.value = '';
    };

    convertBtn.onclick = async () => {
        const html = htmlInput.value.trim();
        if (!html) return alert("Please enter some HTML code.");

        convertBtn.innerText = "Converting...";
        convertBtn.disabled = true;

        try {
            // 1. Render HTML to canvas via hidden area
            renderArea.innerHTML = html;

            // Adjust width based on orientation
            const isLandscape = orientationSelect.value === 'landscape';
            renderArea.style.width = isLandscape ? '1120px' : '795px'; // Approx A4 pixels at 96dpi
            renderArea.style.padding = marginSelect.value + 'px';

            // Wait for images if any (brief delay)
            await new Promise(r => setTimeout(r, 500));

            const canvas = await html2canvas(renderArea, {
                useCORS: true,
                scale: 2, // Higher quality
                backgroundColor: '#ffffff'
            });

            const imgData = canvas.toDataURL('image/png');

            // 2. Create PDF via pdf-lib
            const { PDFDocument, PageSizes } = window.PDFLib;
            const pdfDoc = await PDFDocument.create();

            const selectedSize = pageSizeSelect.value.toUpperCase();
            const pageBaseSize = PageSizes[selectedSize] || PageSizes.A4;

            // Handle Orientation
            const pageSize = isLandscape ? [pageBaseSize[1], pageBaseSize[0]] : pageBaseSize;
            const page = pdfDoc.addPage(pageSize);

            const { width, height } = page.getSize();

            // Embed image
            const image = await pdfDoc.embedPng(imgData);

            // Calculate dimensions to fit page (keeping ratio)
            const imgDims = image.scaleToFit(width - 40, height - 40);

            page.drawImage(image, {
                x: (width - imgDims.width) / 2,
                y: (height - imgDims.height) / 2,
                width: imgDims.width,
                height: imgDims.height,
            });

            pdfDoc.setProducer('PDFPals');
            pdfDoc.setCreator('PDFPals');
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });

            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `converted_html.pdf`;
            link.click();

        } catch (err) {
            console.error(err);
            alert("Error converting HTML. Check console for details.");
        } finally {
            convertBtn.innerText = "Convert to PDF ➔";
            convertBtn.disabled = false;
            renderArea.innerHTML = ''; // Cleanup
        }
    };

    if (resetBtn) {
        resetBtn.onclick = () => {
            htmlInput.value = '';
            renderArea.innerHTML = '';
        };
    }
});
