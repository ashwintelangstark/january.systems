# Dockerfile for January Local AI Agent
# Runs Node.js, Python, Faster-Whisper, and Edge-TTS

FROM python:3.11-slim-bullseye AS base

# Install system audio dependencies
RUN apt-get update && apt-get install -y \
    curl \
    sox \
    libsox-fmt-all \
    alsa-utils \
    pulseaudio \
    ffmpeg \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 22
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g npm@latest

WORKDIR /app

# Install Python STT & TTS libraries
RUN pip install --no-cache-dir \
    faster-whisper \
    edge-tts \
    sounddevice \
    scipy \
    numpy

# Copy monorepo files
COPY package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install Node dependencies
RUN npm install
RUN cd server && npm install
RUN cd client && npm install

# Copy application source
COPY . .

# Build frontend and backend
RUN npm run build

EXPOSE 3001 5173

ENV PORT=3001
ENV HOST=0.0.0.0

CMD ["npm", "run", "dev"]
