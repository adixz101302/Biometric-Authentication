class SecureCamera {
    constructor(videoElementId, canvasElementId) {
        this.video = document.getElementById(videoElementId);
        this.canvas = document.getElementById(canvasElementId);
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.stream = null;
        this.isStreaming = false;
        
        // Match canvas to video size
        if (this.video) {
            this.video.addEventListener('loadedmetadata', () => {
                if (this.canvas) {
                    this.canvas.width = this.video.videoWidth;
                    this.canvas.height = this.video.videoHeight;
                    this.drawScanningEffect(); // Initial effect
                }
            });
        }
    }

    async start() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ 
                video: { width: 640, height: 480, facingMode: "user" },
                audio: false 
            });
            this.video.srcObject = this.stream;
            this.video.play();
            this.isStreaming = true;
            return true;
        } catch (err) {
            console.error("Camera error:", err);
            return false;
        }
    }

    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.video.srcObject = null;
            this.isStreaming = false;
        }
    }

    captureFrame() {
        if (!this.isStreaming) return null;
        
        const captureCanvas = document.createElement('canvas');
        captureCanvas.width = this.video.videoWidth;
        captureCanvas.height = this.video.videoHeight;
        const ctx = captureCanvas.getContext('2d');
        ctx.drawImage(this.video, 0, 0, captureCanvas.width, captureCanvas.height);
        
        return captureCanvas.toDataURL('image/jpeg', 0.8);
    }
    
    drawBoundingBox(x, y, width, height, color = '#00f3ff') {
        if (!this.ctx) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 3;
        
        // Draw corners instead of full box for sci-fi feel
        const cornerLen = 20;
        
        this.ctx.beginPath();
        // Top Left
        this.ctx.moveTo(x, y + cornerLen);
        this.ctx.lineTo(x, y);
        this.ctx.lineTo(x + cornerLen, y);
        
        // Top Right
        this.ctx.moveTo(x + width - cornerLen, y);
        this.ctx.lineTo(x + width, y);
        this.ctx.lineTo(x + width, y + cornerLen);
        
        // Bottom Right
        this.ctx.moveTo(x + width, y + height - cornerLen);
        this.ctx.lineTo(x + width, y + height);
        this.ctx.lineTo(x + width - cornerLen, y + height);
        
        // Bottom Left
        this.ctx.moveTo(x + cornerLen, y + height);
        this.ctx.lineTo(x, y + height);
        this.ctx.lineTo(x, y + height - cornerLen);
        
        this.ctx.stroke();
    }
    
    drawScanningEffect() {
        if (!this.ctx || !this.isStreaming) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw a scanning line moving down
        const time = new Date().getTime();
        const yPos = (time / 10) % this.canvas.height;
        
        this.ctx.fillStyle = 'rgba(0, 243, 255, 0.2)';
        this.ctx.fillRect(0, yPos, this.canvas.width, 4);
        
        requestAnimationFrame(() => this.drawScanningEffect());
    }
}

// Global utility for showing status
function updateStatus(elementId, text, type = 'detecting') {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    el.innerText = text;
    el.className = 'status-indicator status-' + type;
}
