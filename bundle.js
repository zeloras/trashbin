// Configuration
const CONFIG = {
    CAMERA: {
        constraints: {
            video: {
                facingMode: 'environment',
                width: { ideal: window.innerWidth },
                height: { ideal: window.innerHeight }
            }
        }
    },
    UI: {
        captureButton: {
            size: {
                desktop: { width: '65px', height: '65px' },
                mobile: { width: '55px', height: '55px' }
            }
        },
        uploadButton: {
            size: {
                desktop: { width: '40px', height: '40px' },
                mobile: { width: '35px', height: '35px' }
            }
        }
    }
};

// Camera class
class Camera {
    constructor(videoElement, canvasElement) {
        this.video = videoElement;
        this.canvas = canvasElement;
        this.stream = null;
    }

    async initialize() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia(CONFIG.CAMERA.constraints);
            this.video.srcObject = this.stream;
            
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.adjustVideoSize();
                    resolve();
                };
            });
        } catch (error) {
            console.error('Camera initialization error:', error);
            throw new Error('Failed to access camera');
        }
    }

    adjustVideoSize() {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const screenRatio = screenWidth / screenHeight;
        
        const videoWidth = this.video.videoWidth;
        const videoHeight = this.video.videoHeight;
        const videoRatio = videoWidth / videoHeight;

        let targetWidth, targetHeight;
        
        if (screenRatio > videoRatio) {
            targetHeight = screenHeight;
            targetWidth = targetHeight * videoRatio;
        } else {
            targetWidth = screenWidth;
            targetHeight = targetWidth / videoRatio;
        }

        this.video.style.width = `${targetWidth}px`;
        this.video.style.height = `${targetHeight}px`;
        this.video.style.position = 'absolute';
        this.video.style.left = `${(screenWidth - targetWidth) / 2}px`;
        this.video.style.top = `${(screenHeight - targetHeight) / 2}px`;

        this.canvas.width = videoWidth;
        this.canvas.height = videoHeight;
    }

    capture() {
        const ctx = this.canvas.getContext('2d');
        ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        return this.canvas.toDataURL('image/jpeg');
    }

    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
    }
}

// UI class
class UI {
    constructor() {
        this.elements = {
            video: document.querySelector('#video'),
            canvas: document.querySelector('#canvas'),
            captureButton: document.querySelector('#captureButton'),
            newPhotoButton: document.querySelector('#newPhotoButton'),
            uploadButton: document.querySelector('#uploadButton'),
            fileInput: document.querySelector('#fileInput'),
            topStatusBar: document.querySelector('.status-bar.top'),
            bottomStatusBar: document.querySelector('.status-bar.bottom')
        };
        this.checkCameraSupport();
    }

    checkCameraSupport() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.elements.captureButton.style.display = 'none';
            this.elements.video.style.display = 'none';
            this.showError('Camera is not supported in your browser');
        }
    }

    setupEventListeners(camera) {
        this.elements.captureButton.addEventListener('click', () => this.handleCapture(camera));
        this.elements.newPhotoButton.addEventListener('click', () => this.handleNewPhoto());
        this.elements.uploadButton.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.fileInput.addEventListener('change', (event) => this.handleFileUpload(event, camera));
    }

    handleCapture(camera) {
        try {
            camera.capture();
            this.toggleView('canvas');
            this.toggleButtons('afterCapture');
            this.showSuccess('Photo captured successfully');
        } catch (error) {
            console.error('Capture error:', error);
            this.showError('Failed to capture photo');
        }
    }

    handleNewPhoto() {
        this.toggleView('video');
        this.toggleButtons('beforeCapture');
        this.resetStatus();
    }

    async handleFileUpload(event, camera) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });

            const ctx = camera.canvas.getContext('2d');
            camera.canvas.width = img.width;
            camera.canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            this.toggleView('canvas');
            this.toggleButtons('afterCapture');
            this.showSuccess('Photo loaded successfully');
        } catch (error) {
            console.error('Error loading image:', error);
            this.showError('Failed to load image');
        }
    }

    toggleView(view) {
        if (view === 'canvas') {
            this.elements.video.style.display = 'none';
            this.elements.canvas.style.display = 'block';
        } else {
            this.elements.video.style.display = 'block';
            this.elements.canvas.style.display = 'none';
        }
    }

    toggleButtons(state) {
        if (state === 'afterCapture') {
            this.elements.captureButton.style.display = 'none';
            this.elements.newPhotoButton.style.display = 'inline-block';
        } else {
            this.elements.captureButton.style.display = 'block';
            this.elements.newPhotoButton.style.display = 'none';
        }
    }

    showSuccess(message) {
        this.elements.topStatusBar.classList.add('success');
        this.elements.topStatusBar.textContent = message;
        setTimeout(() => this.resetStatus(), 3000);
    }

    showError(message) {
        this.elements.topStatusBar.classList.add('error');
        this.elements.topStatusBar.textContent = message;
        setTimeout(() => this.resetStatus(), 3000);
    }

    resetStatus() {
        this.elements.topStatusBar.classList.remove('success', 'error');
        this.elements.topStatusBar.textContent = '';
    }
}

// Initialize application
let camera;
let ui;

async function init() {
    try {
        camera = new Camera(
            document.getElementById('video'),
            document.getElementById('canvas')
        );
        
        ui = new UI();
        await camera.initialize();
        ui.setupEventListeners(camera);
    } catch (error) {
        console.error('Initialization error:', error);
        alert('Failed to initialize application');
    }
}

window.addEventListener('load', init); 