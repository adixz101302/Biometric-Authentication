FROM python:3.10-slim

# Install system dependencies required for dlib and opencv
RUN apt-get update -y && apt-get install -y \
    build-essential \
    cmake \
    pkg-config \
    libx11-dev \
    libatlas-base-dev \
    libgtk-3-dev \
    libboost-python-dev \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the code
COPY . .

# Expose port 7860 which is required by Hugging Face Spaces, and works for Render
EXPOSE 7860

# Start the Flask app via Gunicorn
CMD ["gunicorn", "-b", "0.0.0.0:7860", "app:app"]
