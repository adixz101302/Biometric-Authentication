import { registerUser } from './firebase-config.js';

const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const statusMessage = document.getElementById('statusMessage');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const registerForm = document.getElementById('registerForm');

let encodings = [];
const ENCODING_TARGET = 15;

Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/models')
]).then(startVideo);

function startVideo() {
    statusMessage.innerText = "Activating Optical Sensor...";
    navigator.mediaDevices.getUserMedia({ video: {} })
        .then(stream => {
            video.srcObject = stream;
        })
        .catch(err => {
            statusMessage.innerHTML = "<span class='status-error'>Error accessing webcam. Please secure camera permissions.</span>";
            console.error(err);
        });
}

video.addEventListener('play', () => {
    statusMessage.innerHTML = "<span class='status-detecting'>Align Face within the Frame Frame...</span>";
    progressContainer.style.display = 'block';
    
    // Set canvas dimensions
    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(overlay, displaySize);

    const captureInterval = setInterval(async () => {
        if (encodings.length >= ENCODING_TARGET) {
            clearInterval(captureInterval);
            finishCapture();
            return;
        }

        const detection = await faceapi.detectSingleFace(video)
            .withFaceLandmarks()
            .withFaceDescriptor();

        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);

        if (detection) {
            const resizedDetection = faceapi.resizeResults(detection, displaySize);
            
            // Draw custom cyber box
            const box = resizedDetection.detection.box;
            ctx.strokeStyle = '#00f3ff';
            ctx.lineWidth = 2;
            ctx.strokeRect(box.x, box.y, box.width, box.height);

            // Add the descriptor array
            encodings.push(detection.descriptor);
            
            // Update progress
            const progress = (encodings.length / ENCODING_TARGET) * 100;
            progressBar.style.width = `${progress}%`;
            statusMessage.innerHTML = `<span class='status-detecting'>Processing Biometrics: ${Math.round(progress)}%... Maintain Position</span>`;
        } else {
            statusMessage.innerHTML = "<span class='status-error'>No Face Detected. Ensure good lighting.</span>";
        }
    }, 500);
});

function finishCapture() {
    statusMessage.innerHTML = "<span class='status-success'>Biometric Scan Complete. Enter Identity Details.</span>";
    registerForm.style.display = 'block';
    progressContainer.style.display = 'none';

    // Stop Webcam stream to save resources
    const stream = video.srcObject;
    const tracks = stream.getTracks();
    tracks.forEach(t => t.stop());
    video.srcObject = null;
    
    // Clear overlay
    const ctx = overlay.getContext('2d');
    ctx.clearRect(0, 0, overlay.width, overlay.height);
}

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;

    const btn = registerForm.querySelector('button');
    btn.innerText = "Encrypting & Storing...";
    btn.disabled = true;

    // mathematically average the 15 encodings
    let avgDescriptor = new Float32Array(128).fill(0);
    encodings.forEach(enc => {
        for(let i = 0; i < 128; i++) {
            avgDescriptor[i] += enc[i];
        }
    });
    for(let i = 0; i < 128; i++) {
        avgDescriptor[i] /= ENCODING_TARGET;
    }

    const res = await registerUser(name, email, avgDescriptor);
    
    if (res.success) {
        statusMessage.innerHTML = `<span class='status-success'><i class='fa-solid fa-check-circle'></i> ${res.message}</span>`;
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 3000);
    } else {
        statusMessage.innerHTML = `<span class='status-error'><i class='fa-solid fa-triangle-exclamation'></i> ${res.message}</span>`;
        btn.innerText = "Retry Commit";
        btn.disabled = false;
    }
});
