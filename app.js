let video;
let canvas;
let capturedImage;
let model;
let stream;
let modelLoaded = false;
let cameraReady = false;
let selectedModel = 'tensorflow';
let modelInitialized = false;

async function init() {
    checkCompatibility();
    
    // Performance monitoring
    console.log('Browser Info:', {
        userAgent: navigator.userAgent,
        memory: performance.memory ? {
            jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1048576) + 'MB',
            totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1048576) + 'MB',
            usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB'
        } : 'Not available'
    });

    // Getting access to elements
    video = document.getElementById('video');
    canvas = document.getElementById('canvas');
    const captureButton = document.getElementById('captureButton');
    const newPhotoButton = document.getElementById('newPhotoButton');
    const analyzeButton = document.getElementById('analyzeButton');
    
    // Start both processes in parallel
    const [modelPromise, cameraPromise] = await Promise.all([
        loadModel(),
        setupCamera()
    ]);

    // Event handlers
    captureButton.addEventListener('click', captureImage);
    newPhotoButton.addEventListener('click', startNewPhoto);
    analyzeButton.addEventListener('click', analyzeImage);
}

async function loadModel() {
    try {
        console.time('Model Loading Time');
        model = await cocoSsd.load({
            onProgress: (progress) => {
                // Update loading progress bar
                const progressBar = document.querySelector('.progress');
                if (progressBar) {
                    progressBar.style.width = `${progress * 100}%`;
                }
            }
        });
        console.timeEnd('Model Loading Time');
        
        modelLoaded = true;
        document.getElementById('loading').style.display = 'none';
        
        return model;
    } catch (err) {
        console.error('Model loading error:', err);
        document.getElementById('loading').innerHTML = 'Error loading model. Please refresh the page.';
        throw err;
    }
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
                cameraReady = true;
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
    
    // Show canvas, hide video
    canvas.style.display = 'block';
    video.style.display = 'none';
    
    // Show calibration only for TensorFlow
    if (selectedModel === 'tensorflow') {
        document.getElementById('calibration').style.display = 'block';
    }
    
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
        if (selectedModel === 'tensorflow') {
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
        } else {
            const imageData = canvas.toDataURL('image/jpeg');
            const analysis = await analyzeWithOpenAI(imageData);
            
            result.innerHTML = `
                <h3>Analysis Results:</h3>
                <p>Detected object: ${analysis.object}</p>
                <p>Confidence: ${analysis.confidence}%</p>
                <p>Approximate distance: ${analysis.distance} meters</p>
                <p>Dimensions: ${analysis.dimensions.width}×${analysis.dimensions.height}×${analysis.dimensions.depth} cm</p>
                <p>Approximate volume: ${analysis.volume}</p>
                <p class="note">Analysis provided by OpenAI Vision API</p>
            `;
        }
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

async function initializeAnalysis() {
    try {
        const modelType = document.querySelector('input[name="model"]:checked').value;
        selectedModel = modelType;
        
        // Hide model selection, show loading
        document.querySelector('.model-selection').style.display = 'none';
        document.getElementById('loading').style.display = 'block';
        
        // Show/hide calibration based on model type
        const calibrationBlock = document.getElementById('calibration');
        calibrationBlock.style.display = modelType === 'tensorflow' ? 'block' : 'none';
        
        if (modelType === 'tensorflow') {
            await loadTensorFlowScripts();
            await init();
        } else {
            await initOpenAI();
        }
        
        // Show the main interface
        document.querySelector('.content-wrapper').style.display = 'block';
    } catch (error) {
        console.error('Initialization error:', error);
        document.getElementById('loading').innerHTML = `
            <h3>Error</h3>
            <p>Failed to initialize the selected model.</p>
            <p class="note">${error.message}</p>
            <button onclick="location.reload()">Try Again</button>
        `;
    }
}

async function loadTensorFlowScripts() {
    try {
        const scripts = CONFIG.MODEL_SETTINGS.tensorflow.scripts;
        for (const src of scripts) {
            try {
                await loadScript(src);
                console.log(`Successfully loaded: ${src}`);
            } catch (error) {
                console.error(`Failed to load script: ${src}`, error);
                throw new Error(`Failed to load TensorFlow script: ${src}`);
            }
        }
    } catch (error) {
        document.getElementById('loading').innerHTML = `
            <h3>Error</h3>
            <p>Failed to load TensorFlow. Please check your internet connection and try again.</p>
            <p class="note">${error.message}</p>
        `;
        throw error;
    }
}

function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => {
            console.log(`Script loaded successfully: ${src}`);
            resolve();
        };
        script.onerror = (error) => {
            console.error(`Script load error: ${src}`, error);
            reject(new Error(`Failed to load script: ${src}`));
        };
        document.body.appendChild(script);
    });
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
                                "distance": "estimated distance in meters",
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
                }
            ],
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

        // Parse JSON from the response
        const analysis = JSON.parse(data.choices[0].message.content);
        return analysis;
    } catch (error) {
        console.error('OpenAI API Error:', error);
        throw new Error(`Failed to analyze image: ${error.message}`);
    }
}

async function initOpenAI() {
    try {
        if (!CONFIG.OPENAI_API_KEY || CONFIG.OPENAI_API_KEY === 'your-api-key-here') {
            throw new Error('OpenAI API key is not configured');
        }

        // Initialize DOM elements
        video = document.getElementById('video');
        canvas = document.getElementById('canvas');
        const captureButton = document.getElementById('captureButton');
        const newPhotoButton = document.getElementById('newPhotoButton');
        const analyzeButton = document.getElementById('analyzeButton');

        // Hide calibration form for OpenAI
        document.getElementById('calibration').style.display = 'none';

        // Initialize camera setup
        await setupCamera();
        
        // Hide loading screen
        document.getElementById('loading').style.display = 'none';
        
        // Setup event handlers
        captureButton.addEventListener('click', captureImage);
        newPhotoButton.addEventListener('click', startNewPhoto);
        analyzeButton.addEventListener('click', analyzeImage);
        
        modelInitialized = true;
        
    } catch (error) {
        console.error('OpenAI initialization error:', error);
        document.getElementById('loading').innerHTML = `
            <h3>Error</h3>
            <p>${error.message}</p>
            <p>Please check your configuration and refresh the page.</p>
        `;
        throw error;
    }
}

// Add event listener for model selection
document.getElementById('startAnalysis').addEventListener('click', initializeAnalysis);

// Initially hide the content wrapper
document.querySelector('.content-wrapper').style.display = 'none'; 