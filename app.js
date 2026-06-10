import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/vision_bundle.mjs";
import { Gestures } from './gestures.js';
import { CanvasRenderer } from './visuals.js';
import { Synth } from './synth.js';
import { Game, GAME_LEVELS } from './game.js';

// DOM Elements Selection
const video = document.getElementById('webcam');
const drawingCanvas = document.getElementById('drawing-canvas');
const uiCanvas = document.getElementById('ui-canvas');

const statusDot = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const gestureHint = document.getElementById('gesture-hint');
const hintMsg = document.getElementById('hint-msg');
const loadingOverlay = document.getElementById('loading-overlay');
const victoryScreen = document.getElementById('victory-screen');
const victoryTime = document.getElementById('victory-time');
const victoryAccuracy = document.getElementById('victory-accuracy');

// Control Buttons & Inputs
const btnDoodle = document.getElementById('mode-doodle');
const btnConnect = document.getElementById('mode-connect');
const btnConstellation = document.getElementById('mode-constellation');

const colorSwatches = document.querySelectorAll('.color-swatch');
const sliderSize = document.getElementById('brush-size');
const valSize = document.getElementById('brush-size-val');
const brushSegments = document.querySelectorAll('.segment');

const btnClear = document.getElementById('clear-btn');
const btnUndo = document.getElementById('undo-btn');
const btnSnapshot = document.getElementById('snapshot-btn');
const btnAudio = document.getElementById('audio-toggle');

const configPanel = document.getElementById('config-panel');
const gamePanel = document.getElementById('game-panel');
const dropdownLevels = document.getElementById('level-select');
const gameTarget = document.getElementById('game-target');
const gameScore = document.getElementById('game-score');
const gameTimerVal = document.getElementById('game-timer');
const btnResetLevel = document.getElementById('reset-level-btn');
const btnVictoryNext = document.getElementById('next-level-btn-victory');

// Global Application State
let handLandmarker = null;
let renderer = null;
let currentMode = 'doodle'; // doodle, connect, constellation
let trackingActive = false;
let lastVideoTime = -1;
let drawingState = 'hover'; // hover, draw, erase
let lastDrawState = 'hover';

// 1. Setup Audio & User Interaction Hook
function initAudioOnInteraction() {
    const startAudio = () => {
        Synth.init();
        window.removeEventListener('click', startAudio);
        window.removeEventListener('touchstart', startAudio);
    };
    window.addEventListener('click', startAudio);
    window.addEventListener('touchstart', startAudio);
}

// 2. Initialize MediaPipe Hand Tracker
async function initHandLandmarker() {
    try {
        statusText.innerText = "Loading vision models...";
        
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
        );
        
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 2
        });

        statusText.innerText = "Connecting camera feed...";
        await startWebcam();
    } catch (error) {
        console.error("HandLandmarker initialization failed:", error);
        statusText.innerText = "Hardware/Model loading failure!";
        statusDot.className = "status-dot disconnected";
        alert("Could not load AI models. Please ensure you are running on localhost/HTTPS and have an active internet connection.");
    }
}

// 3. Connect User Webcam
async function startWebcam() {
    const constraints = {
        video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: "user"
        },
        audio: false
    };

    try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        video.addEventListener('loadeddata', setupViewports);
    } catch (err) {
        console.error("Camera access blocked:", err);
        statusText.innerText = "Camera access denied!";
        statusDot.className = "status-dot disconnected";
        alert("Webcam permission is required to detect hand coordinates and draw.");
    }
}

// 4. Align and Size Canvas Viewports
function setupViewports() {
    const rect = video.getBoundingClientRect();
    const width = video.videoWidth || rect.width || 640;
    const height = video.videoHeight || rect.height || 480;

    // Set canvas dimensions matching native stream aspect ratio
    drawingCanvas.width = width;
    drawingCanvas.height = height;
    uiCanvas.width = width;
    uiCanvas.height = height;

    renderer = new CanvasRenderer(drawingCanvas, uiCanvas);
    renderer.resize(width, height);

    // Hide loader overlay once initialized
    loadingOverlay.classList.add('fade-out');
    
    statusDot.className = "status-dot connected";
    statusText.innerText = "Tracking Engine Active";
    trackingActive = true;

    // Start Main Request Animation Frame Loop
    requestAnimationFrame(renderLoop);
}

// 5. Main Processing Loop
async function renderLoop() {
    if (!trackingActive) return;

    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        const now = performance.now();
        
        // Detect landmarks
        const result = handLandmarker.detectForVideo(video, now);
        
        processHandTracking(result);
    }

    requestAnimationFrame(renderLoop);
}

// 6. Process Frame Landmark Output
function processHandTracking(result) {
    let activeHandLandmarks = null;
    let mainHandedness = 'Right';

    // Prioritize processing the main user hand (defaulting to the first detected)
    if (result && result.landmarks && result.landmarks.length > 0) {
        activeHandLandmarks = result.landmarks[0];
        mainHandedness = result.handednesses[0]?.[0]?.categoryName || 'Right';
        
        gestureHint.classList.remove('hidden');
    } else {
        gestureHint.classList.add('hidden');
        if (drawingState === 'draw') {
            Synth.stopDrawSound();
        }
        drawingState = 'hover';
        renderer.endStroke();
        
        // Clear UI canvas overlay when no hands detected
        renderer.renderUI(null, null, 'hover');
        return;
    }

    const width = uiCanvas.width;
    const height = uiCanvas.height;

    // Get primary pointing pointer position (mirrored index finger tip coordinates)
    const pointer = Gestures.getBrushPosition(activeHandLandmarks, width, height);

    // Determine current gesture state
    const pinch = Gestures.isPinching(activeHandLandmarks);
    const fist = Gestures.isFist(activeHandLandmarks);
    const palm = Gestures.isPalm(activeHandLandmarks);

    // Update state flags
    if (fist) {
        drawingState = 'erase';
        hintMsg.innerText = "Erase Mode: Holding Fist";
    } else if (pinch.active) {
        drawingState = 'draw';
        hintMsg.innerText = "Drawing: Pinch Active";
    } else {
        drawingState = 'hover';
        hintMsg.innerText = "Hovering: Point Finger";
    }

    // Trigger state changes / lines creation in Air Doodle mode
    if (currentMode === 'doodle' || currentMode === 'constellation') {
        if (drawingState === 'draw') {
            if (lastDrawState !== 'draw') {
                renderer.startStroke(pointer);
                Synth.startDrawSound();
            } else {
                renderer.addPointToStroke(pointer);
                // Adjust audio frequency pitch based on drawing coordinates height
                const pitchFreq = 400 - (pointer.y / height) * 250;
                Synth.updateDrawSound(pitchFreq);
            }
        } else if (drawingState === 'erase') {
            if (lastDrawState === 'draw') {
                Synth.stopDrawSound();
            }
            renderer.endStroke();
            renderer.eraseAt(pointer, 25);
        } else {
            if (lastDrawState === 'draw') {
                Synth.stopDrawSound();
            }
            renderer.endStroke();
        }
    }

    // Trigger state changes in Hand Connect Puzzle Game mode
    if (currentMode === 'connect') {
        if (drawingState === 'draw' || drawingState === 'hover') {
            Game.checkCollisions(pointer, width, height);
            
            // Draw temporary connector trailing line from last connected node to index finger
            if (Game.connectedIndices.length > 0 && !Game.isFinished) {
                const lastIdx = Game.connectedIndices[Game.connectedIndices.length - 1];
                const lastDot = Game.dots[lastIdx];
                
                // Draw trailing path temporarily on UI overlay
                const uiCtx = renderer.uiCtx;
                uiCtx.save();
                uiCtx.beginPath();
                uiCtx.moveTo(lastDot.x * width, lastDot.y * height);
                uiCtx.lineTo(pointer.x, pointer.y);
                uiCtx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
                uiCtx.lineWidth = 3;
                uiCtx.setLineDash([6, 6]);
                uiCtx.stroke();
                uiCtx.restore();
            }
        }
        
        // Update Game HUD values
        gameScore.innerText = `${Game.connectedIndices.length} / ${Game.dots.length}`;
        const gameTime = Game.updateTimer();
        gameTimerVal.innerText = `${gameTime.toFixed(1)}s`;

        // Handle Game level finished triggers
        if (Game.isFinished && !victoryScreen.offsetParent) {
            victoryTime.innerText = `${gameTime.toFixed(1)}s`;
            // Calculate accuracy metric: standard 100% since points are sequential
            victoryAccuracy.innerText = "100%";
            victoryScreen.classList.remove('hidden');
        }
    }

    lastDrawState = drawingState;

    // Render drawings on every frame (to handle real-time ghost brush fading)
    if (currentMode === 'doodle' || currentMode === 'constellation') {
        renderer.renderDrawings();
    }

    // Render Skeletal graphics, lightning arcs, and pointer trackers
    renderer.renderUI(result, pointer, drawingState);

    // Call game engine render for points overlays
    if (currentMode === 'connect') {
        Game.updateParticles();
        Game.render(renderer.uiCtx, width, height);
    }
}

// 7. Bind Game Levels Selector dropdown
function loadLevelsDropdown() {
    dropdownLevels.innerHTML = '';
    GAME_LEVELS.forEach((level, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.text = `Lvl ${index + 1}: ${level.name} (${level.difficulty})`;
        dropdownLevels.appendChild(option);
    });
}

// 8. Handle UI Game Mode Changes
function switchGameMode(mode) {
    currentMode = mode;
    
    // De-activate tab selections
    btnDoodle.classList.remove('active');
    btnConnect.classList.remove('active');
    btnConstellation.classList.remove('active');

    // Add UI toggles conditional settings panels
    configPanel.classList.add('hidden');
    gamePanel.classList.add('hidden');
    victoryScreen.classList.add('hidden');

    // Mute synthesizer audio humming
    Synth.stopDrawSound();

    if (mode === 'doodle') {
        btnDoodle.classList.add('active');
        configPanel.classList.remove('hidden');
        renderer.connectFingerVFX = false;
    } else if (mode === 'connect') {
        btnConnect.classList.add('active');
        gamePanel.classList.remove('hidden');
        renderer.connectFingerVFX = false;
        
        // Load default active level
        loadActiveLevel();
    } else if (mode === 'constellation') {
        btnConstellation.classList.add('active');
        configPanel.classList.remove('hidden');
        renderer.connectFingerVFX = true; // Activate electric trails!
    }
}

function loadActiveLevel() {
    renderer.clear();
    const lvlIdx = parseInt(dropdownLevels.value, 10);
    Game.loadLevel(lvlIdx);
    
    // Set active stats targets
    const lvl = Game.getCurrentLevel();
    gameTarget.innerText = lvl.name;
    gameScore.innerText = `0 / ${lvl.dots.length}`;
    gameTimerVal.innerText = '0.0s';
    victoryScreen.classList.add('hidden');
}

// 9. Bind UI Controls Event Handlers
function setupEventListeners() {
    // Mode Switch Cards
    btnDoodle.addEventListener('click', () => switchGameMode('doodle'));
    btnConnect.addEventListener('click', () => switchGameMode('connect'));
    btnConstellation.addEventListener('click', () => switchGameMode('constellation'));

    // Colors Swatches
    colorSwatches.forEach(swatch => {
        swatch.addEventListener('click', (e) => {
            colorSwatches.forEach(s => s.classList.remove('active'));
            e.target.classList.add('active');
            renderer.setBrushColor(e.target.getAttribute('data-color'));
        });
    });

    // Brush Sizes
    sliderSize.addEventListener('input', (e) => {
        valSize.innerText = `${e.target.value}px`;
        renderer.setBrushSize(parseInt(e.target.value, 10));
    });

    // Brush Style modes (Normal, Glow, Ghost)
    brushSegments.forEach(seg => {
        seg.addEventListener('click', (e) => {
            brushSegments.forEach(s => s.classList.remove('active'));
            e.target.classList.add('active');
            renderer.setBrushStyle(e.target.getAttribute('data-style'));
        });
    });

    // Drawing Canvas action buttons
    btnClear.addEventListener('click', () => {
        renderer.clear();
        if (currentMode === 'connect') {
            loadActiveLevel();
        }
    });
    
    btnUndo.addEventListener('click', () => renderer.undo());
    
    btnSnapshot.addEventListener('click', () => {
        // Create an temporary merged canvas to capture both camera overlay & drawing paths
        const mergeCanvas = document.createElement('canvas');
        mergeCanvas.width = drawingCanvas.width;
        mergeCanvas.height = drawingCanvas.height;
        const mergeCtx = mergeCanvas.getContext('2d');

        // Draw camera frame mirrored
        mergeCtx.save();
        mergeCtx.translate(mergeCanvas.width, 0);
        mergeCtx.scale(-1, 1);
        mergeCtx.drawImage(video, 0, 0, mergeCanvas.width, mergeCanvas.height);
        mergeCtx.restore();

        // Overlay drawing lines
        mergeCtx.drawImage(drawingCanvas, 0, 0);
        
        // Export image download trigger
        const link = document.createElement('a');
        link.download = `airdoodle-${Date.now()}.png`;
        link.href = mergeCanvas.toDataURL('image/png');
        link.click();
    });

    // Synthesizer Muted settings button
    btnAudio.addEventListener('click', () => {
        const isMuted = Synth.toggleMute();
        btnAudio.classList.toggle('active', isMuted);
        
        // Toggle sound icons
        const soundIcon = document.getElementById('audio-icon-unmuted');
        if (isMuted) {
            soundIcon.style.opacity = '0.35';
        } else {
            soundIcon.style.opacity = '1.0';
        }
    });

    // Game level changes and resets
    dropdownLevels.addEventListener('change', loadActiveLevel);
    btnResetLevel.addEventListener('click', loadActiveLevel);
    
    btnVictoryNext.addEventListener('click', () => {
        let nextLvl = (Game.currentLevelIndex + 1) % GAME_LEVELS.length;
        dropdownLevels.value = nextLvl;
        loadActiveLevel();
    });
}

// Window resizing adjustments handler
window.addEventListener('resize', () => {
    if (renderer && video.readyState >= 2) {
        const rect = video.getBoundingClientRect();
        const width = video.videoWidth || rect.width || 640;
        const height = video.videoHeight || rect.height || 480;
        renderer.resize(width, height);
    }
});

// App Initialization entry point
window.addEventListener('DOMContentLoaded', () => {
    initAudioOnInteraction();
    loadLevelsDropdown();
    setupEventListeners();
    initHandLandmarker();
});
