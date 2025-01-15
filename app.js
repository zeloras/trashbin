let video;
let canvas;
let capturedImage;
let model;

async function init() {
    // Loading COCO-SSD model
    model = await cocoSsd.load();
    
    // Getting access to elements
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    const captureButton = document.getElementById('captureButton');
    const analyzeButton = document.getElementById('analyzeButton');
    
    // Requesting camera access
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            } 
        });
        video.srcObject = stream;
    } catch (err) {
        console.error('Camera access error:', err);
        alert('Failed to access camera');
    }

    // Event handlers
    captureButton.addEventListener('click', captureImage);
    analyzeButton.addEventListener('click', analyzeImage);
}

function captureImage() {
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    capturedImage = canvas.toDataURL('image/jpeg');
    canvas.style.display = 'block';
    video.style.display = 'none';
    
    document.getElementById('analyzeButton').disabled = false;
}

async function analyzeImage() {
    const result = document.getElementById('result');
    result.style.display = 'block';
    result.innerHTML = 'Analyzing image...';

    try {
        const predictions = await model.detect(canvas);
        const trashBin = predictions.find(pred => 
            pred.class === 'trash bin' || 
            pred.class === 'container' ||
            pred.class === 'bin'
        );

        if (trashBin) {
            // Approximate distance calculation based on object size
            const objectHeight = trashBin.bbox[3]; // detection area height
            const imageHeight = canvas.height;
            const approximateDistance = estimateDistance(objectHeight, imageHeight);
            
            // Approximate volume calculation
            const volume = estimateVolume(trashBin.bbox);

            result.innerHTML = `
                <h3>Analysis Results:</h3>
                <p>Trash bin detected</p>
                <p>Approximate distance: ${approximateDistance.toFixed(2)} meters</p>
                <p>Approximate volume: ${volume.toFixed(2)} cubic meters</p>
            `;
        } else {
            result.innerHTML = 'No trash bin detected in the image';
        }
    } catch (err) {
        console.error('Analysis error:', err);
        result.innerHTML = 'An error occurred during image analysis';
    }
}

function estimateDistance(objectHeight, imageHeight) {
    // Approximate formula for distance calculation
    // Assuming standard trash bin height is 1 meter
    const realObjectHeight = 1; // meters
    return (realObjectHeight * imageHeight) / objectHeight;
}

function estimateVolume(bbox) {
    // Approximate volume calculation based on detection area dimensions
    const width = bbox[2];
    const height = bbox[3];
    const depth = width * 0.8; // assuming depth is 80% of width
    
    // Converting pixels to meters (approximate)
    const scaleFactor = 0.001;
    return (width * height * depth) * scaleFactor;
}

// Initialize on page load
window.addEventListener('load', init); 