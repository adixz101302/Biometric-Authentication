import { loginUser } from './firebase-config.js';

const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const statusMessage = document.getElementById('statusMessage');

let loginAttempted = false;
let modelsLoaded = false;
let failedTries = 0;

// Load Face API Models
Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/models')
]).then(() => {
    modelsLoaded = true;
    startVideo();
});

function startVideo() {
    statusMessage.innerHTML = "<span class='status-detecting'>Align Face within the Frame...</span>";
    navigator.mediaDevices.getUserMedia({ video: {} })
        .then(stream => {
            video.srcObject = stream;
        })
        .catch(err => {
            statusMessage.innerHTML = "<span class='status-error'>Access Denied: Webcam required for Biometrics.</span>";
            console.error(err);
        });
}

video.addEventListener('play', () => {
    // Set canvas dimensions
    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(overlay, displaySize);

    // Run interval to scan the face
    const captureInterval = setInterval(async () => {
        if (loginAttempted) {
            clearInterval(captureInterval);
            return;
        }

        const detection = await faceapi.detectSingleFace(video)
            .withFaceLandmarks()
            .withFaceDescriptor();

        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);

        if (detection) {
            const resizedDetection = faceapi.resizeResults(detection, displaySize);
            
            // Draw cyber box
            const box = resizedDetection.detection.box;
            ctx.strokeStyle = '#ff00ea'; // Neon Pink for auth mode
            ctx.lineWidth = 2;
            ctx.strokeRect(box.x, box.y, box.width, box.height);

            // Trigger Verification
            statusMessage.innerHTML = "<span class='status-detecting'>Face Detected. Verifying Subroutines...</span>";
            loginAttempted = true; // Lock out further scans temporarily

            const authResponse = await loginUser(detection.descriptor);

            if (authResponse.success) {
                // Success
                statusMessage.innerHTML = `<span class='status-success'>Access Granted: Identity confirmed as ${authResponse.user}</span>`;
                ctx.strokeStyle = '#00ff66';
                ctx.strokeRect(box.x, box.y, box.width, box.height);
                
                // Stop the webcam and redirect after delay
                stopWebcam();
                setTimeout(() => {
                    alert(`Welcome, ${authResponse.user}. You have securely logged in!`);
                    window.location.href = 'index.html';
                }, 3000);
            } else {
                // Failure
                failedTries++;
                statusMessage.innerHTML = `<span class='status-error'>${authResponse.message} (Attempt ${failedTries})</span>`;
                ctx.strokeStyle = '#ff3333';
                ctx.strokeRect(box.x, box.y, box.width, box.height);

                if (failedTries >= 3) {
                    statusMessage.innerHTML = `<span class='status-error'>MAX ATTEMPTS REACHED. TERMINAL LOCKED.</span>`;
                    stopWebcam();
                } else {
                    // Unlock the scan window for Retry in 3 seconds
                    setTimeout(() => {
                        loginAttempted = false;
                        statusMessage.innerHTML = "<span class='status-detecting'>Retrying... Realign Face.</span>";
                    }, 3000);
                }
            }
        }
    }, 1500); // Check for face every 1.5 seconds
});

function stopWebcam() {
    const stream = video.srcObject;
    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        video.srcObject = null;
    }
}
