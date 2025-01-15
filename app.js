let video;
let canvas;
let capturedImage;
let model;
let stream;

async function init() {
    // Performance monitoring
    console.log('Browser Info:', {
        userAgent: navigator.userAgent,
        memory: performance.memory ? {
            jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1048576) + 'MB',
            totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1048576) + 'MB',
            usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB'
        } : 'Not available'
    });

    console.time('Model Loading Time');
    // Loading COCO-SSD model
    model = await cocoSsd.load();
    console.timeEnd('Model Loading Time');
    
    // Getting access to elements
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    const captureButton = document.getElementById('captureButton');
    const newPhotoButton = document.getElementById('newPhotoButton');
    const analyzeButton = document.getElementById('analyzeButton');
    
    // Initial camera setup
    await setupCamera();

    // Event handlers
    captureButton.addEventListener('click', captureImage);
    newPhotoButton.addEventListener('click', startNewPhoto);
    analyzeButton.addEventListener('click', analyzeImage);

    checkCompatibility();
}

async function setupCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ 
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
}

function startNewPhoto() {
    // Show video, hide canvas and calibration
    video.style.display = 'block';
    canvas.style.display = 'none';
    document.getElementById('calibration').style.display = 'none';
    
    // Reset buttons
    document.getElementById('captureButton').style.display = 'inline-block';
    document.getElementById('newPhotoButton').style.display = 'none';
    document.getElementById('analyzeButton').disabled = true;
    
    // Clear result
    const result = document.getElementById('result');
    result.style.display = 'none';
    result.innerHTML = '';
}

function captureImage() {
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    capturedImage = canvas.toDataURL('image/jpeg');
    
    // Show canvas and calibration, hide video
    canvas.style.display = 'block';
    video.style.display = 'none';
    document.getElementById('calibration').style.display = 'block';
    
    // Update buttons
    document.getElementById('captureButton').style.display = 'none';
    document.getElementById('newPhotoButton').style.display = 'inline-block';
    document.getElementById('analyzeButton').disabled = false;
}

function getObjectBaseSize(objectClass) {
    // Base sizes in meters
    const sizes = {
        'bottle': { height: 0.25, width: 0.08 },
        'wine glass': { height: 0.15, width: 0.08 },
        'cup': { height: 0.12, width: 0.08 },
        'bowl': { height: 0.08, width: 0.15 },
        'cell phone': { height: 0.14, width: 0.07 },
        // Add more objects as needed
        'default': { height: 0.3, width: 0.3 }
    };
    
    return sizes[objectClass] || sizes.default;
}

function estimateDistance(objectHeight, imageHeight) {
    const realObjectHeight = document.getElementById('realHeight').value / 100; // convert cm to meters
    const focalLength = 1000;
    return (realObjectHeight * focalLength) / objectHeight;
}

function estimateVolume(bbox) {
    const width = bbox[2];
    const height = bbox[3];
    
    const realHeight = document.getElementById('realHeight').value / 100; // convert cm to meters
    const pixelToMeterRatio = realHeight / height;
    
    const realWidth = width * pixelToMeterRatio;
    const realDepth = realWidth; // assuming similar depth to width
    
    const shape = document.getElementById('objectShape').value;
    
    if (shape === 'cylinder') {
        // Cylinder volume: π * r² * h
        const radius = realWidth / 2;
        return Math.PI * radius * radius * realHeight;
    } else {
        // Box volume: w * h * d
        return realWidth * realHeight * realDepth;
    }
}

async function analyzeImage() {
    const result = document.getElementById('result');
    result.style.display = 'block';
    result.innerHTML = 'Analyzing image...';

    try {
        console.time('Object Detection Time');
        const predictions = await model.detect(canvas);
        console.timeEnd('Object Detection Time');
        
        const memoryUsage = performance.memory ? 
            Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB' : 
            'Not available';
        console.log('Memory usage after detection:', memoryUsage);
        
        if (!predictions || predictions.length === 0) {
            result.innerHTML = `
                <h3>Analysis Results:</h3>
                <p>No objects detected in the image.</p>
                <p class="note">Try taking another photo with a clearer view of the object.</p>
            `;
            return;
        }

        const detected = predictions[0];
        const objectHeight = detected.bbox[3];
        const imageHeight = canvas.height;
        const approximateDistance = estimateDistance(objectHeight, imageHeight);
        const volume = estimateVolume(detected.bbox);

        const volumeInLiters = volume * 1000;
        const volumeUnit = volumeInLiters >= 1 ? 'liters' : 'ml';
        const volumeValue = volumeInLiters >= 1 ? 
            volumeInLiters.toFixed(1) : 
            (volumeInLiters * 1000).toFixed(0);

        result.innerHTML = `
            <h3>Analysis Results:</h3>
            <p>Detected object: ${detected.class}</p>
            <p>Confidence: ${(detected.score * 100).toFixed(1)}%</p>
            <p>Approximate distance: ${approximateDistance.toFixed(2)} meters</p>
            <p>Approximate volume: ${volumeValue} ${volumeUnit}</p>
            <p class="note">Note: Volume is an approximation based on visible dimensions</p>
        `;
    } catch (err) {
        console.error('Analysis error:', err);
        result.innerHTML = `
            <h3>Analysis Error</h3>
            <p>An error occurred during image analysis.</p>
            <p class="note">Please try again with a different photo.</p>
        `;
    }
}

function checkCompatibility() {
    const issues = [];
    
    // Check WebGL
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        issues.push('WebGL is not supported. GPU acceleration will not be available.');
    }
    
    // Check camera support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        issues.push('Camera access is not supported in this browser.');
    }
    
    // Check memory (if available)
    if (performance.memory) {
        const totalMemory = performance.memory.jsHeapSizeLimit / 1048576;
        if (totalMemory < 512) {
            issues.push('Available memory might be too low for optimal performance.');
        }
    }
    
    // Display issues if any
    if (issues.length > 0) {
        const compatDiv = document.getElementById('compatibility-check');
        const issuesList = document.getElementById('compatibility-issues');
        issues.forEach(issue => {
            const li = document.createElement('li');
            li.textContent = issue;
            issuesList.appendChild(li);
        });
        compatDiv.style.display = 'block';
    }
}

// Initialize on page load
window.addEventListener('load', init); 