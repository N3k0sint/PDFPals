const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// --- Security Middlewares ---
// 1. Helmet: Secures Express apps by setting various HTTP headers
app.use(helmet({
  contentSecurityPolicy: false, // Disabled temporarily to allow existing inline scripts/styles
  crossOriginEmbedderPolicy: false // Allow loading cross-origin resources if needed
}));

// 2. CORS: Restrict or allow specific origins
app.use(cors());

// 3. Rate limiting: Prevent brute-force/DDoS attacks by limiting requests per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});
app.use(limiter);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve pdfjs-dist from node_modules
app.use('/pdfjs-dist', express.static(path.join(__dirname, 'node_modules/pdfjs-dist')));
// Serve jszip from node_modules
app.use('/jszip', express.static(path.join(__dirname, 'node_modules/jszip/dist')));
// Serve pdf-lib
app.use('/pdf-lib', express.static(path.join(__dirname, 'node_modules/pdf-lib/dist')));
// Serve mammoth
app.use('/mammoth', express.static(path.join(__dirname, 'node_modules/mammoth')));
// Serve xlsx
app.use('/xlsx', express.static(path.join(__dirname, 'node_modules/xlsx/dist')));
// Serve docx
app.use('/docx', express.static(path.join(__dirname, 'node_modules/docx/dist')));
// Serve docx-preview
app.use('/docx-preview', express.static(path.join(__dirname, 'node_modules/docx-preview/dist')));

app.listen(port, () => {
  console.log(`PDF Scanner app listening at http://localhost:${port}`);
});
