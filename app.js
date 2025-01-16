let video;
let canvas;
let capturedImage;
let stream;
let modelInitialized = false;

async function init() {
    // Getting access to elements
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    const captureButton = document.getElementById('captureButton');
    const newPhotoButton = document.getElementById('newPhotoButton');
    const analyzeButton = document.getElementById('analyzeButton');
    
    // Initialize camera
    await setupCamera();

    // Event handlers
    captureButton.addEventListener('click', captureImage);
    newPhotoButton.addEventListener('click', startNewPhoto);
    analyzeButton.addEventListener('click', analyzeImage);
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
        
        // Wait for video to be ready
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                resolve();
            };
        });
        
        return stream;
    } catch (err) {
        console.error('Camera access error:', err);
        alert('Failed to access camera');
        throw err;
    }
}

function startNewPhoto() {
    // Show video, hide canvas
    video.style.display = 'block';
    canvas.style.display = 'none';
    
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
    
    // Show canvas, hide video
    canvas.style.display = 'block';
    video.style.display = 'none';
    
    // Update buttons
    document.getElementById('captureButton').style.display = 'none';
    document.getElementById('newPhotoButton').style.display = 'inline-block';
    document.getElementById('analyzeButton').disabled = false;
}

function estimateDistance(objectHeight, imageHeight) {
    // Using the focal length formula: F = (P x D) / R
    // where F is focal length (pixels), P is object height in pixels, 
    // D is real distance, R is real object height
    
    if (!objectHeight || !imageHeight || objectHeight <= 0 || imageHeight <= 0) {
        console.error('Invalid dimensions for distance calculation:', { objectHeight, imageHeight });
        return null;
    }

    const realObjectHeight = 0.3; // meters (30cm as default)
    const focalLength = 1000; // approximate focal length in pixels
    
    const distance = (realObjectHeight * focalLength) / objectHeight;
    
    // Validate the result
    if (isNaN(distance) || distance <= 0) {
        console.error('Invalid distance calculation result:', distance);
        return null;
    }
    
    return distance;
}

async function analyzeImage() {
    const result = document.getElementById('result');
    result.style.display = 'block';
    result.innerHTML = 'Analyzing image...';

    try {
        const imageData = canvas.toDataURL('image/jpeg');
        const analysis = await analyzeWithOpenAI(imageData);
        
        // Calculate distance using the height from OpenAI analysis
        let distanceText = 'Unable to calculate distance';
        
        if (analysis.dimensions && analysis.dimensions.height) {
            const objectHeightPixels = canvas.height * (parseFloat(analysis.dimensions.height) / 100); // convert cm to ratio
            const distance = estimateDistance(objectHeightPixels, canvas.height);
            if (distance !== null) {
                distanceText = `${distance.toFixed(2)} meters`;
            }
        }
        
        result.innerHTML = `
            <h3>Analysis Results:</h3>
            <p>Detected object: ${analysis.object}</p>
            <p>Confidence: ${analysis.confidence}%</p>
            <p>Approximate distance: ${distanceText}</p>
            <p>Dimensions: ${analysis.dimensions.width}×${analysis.dimensions.height}×${analysis.dimensions.depth}</p>
            <p>Approximate volume: ${analysis.volume}</p>
            <p class="note">Analysis provided by OpenAI Vision API</p>
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

async function analyzeWithOpenAI(imageData) {
    try {
        const base64Image = imageData.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: CONFIG.MODEL_SETTINGS.openai.model,
                messages: [{
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Analyze this image and return a JSON object with the following structure:
                            {
                                "object": "name of detected object",
                                "confidence": "confidence score in percentage",
                                "volume": "estimated volume in liters or milliliters",
                                "dimensions": {
                                    "width": "in cm",
                                    "height": "in cm",
                                    "depth": "in cm"
                                }
                            }
                            Be as precise as possible with measurements.`
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${base64Image}`,
                                detail: "high"
                            }
                        }
                    ]
                }],
                response_format: { type: "json_object" },
                max_tokens: 500
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('API Response:', errorData);
            throw new Error(`OpenAI API Error: ${errorData.error?.message || 'Unknown error'}`);
        }

        const data = await response.json();
        console.log('OpenAI Response:', data);
        
        if (!data.choices || !data.choices[0]) {
            throw new Error('Invalid response format from OpenAI API');
        }

        return JSON.parse(data.choices[0].message.content);
    } catch (error) {
        console.error('OpenAI API Error:', error);
        throw new Error(`Failed to analyze image: ${error.message}`);
    }
}

// Initialize when page loads
window.addEventListener('load', init); 