// Visuals and Canvas Rendering Module
export class CanvasRenderer {
    constructor(drawingCanvas, uiCanvas) {
        this.drawCanvas = drawingCanvas;
        this.uiCanvas = uiCanvas;
        this.drawCtx = drawingCanvas.getContext('2d');
        this.uiCtx = uiCanvas.getContext('2d');
        
        // Stroke state management
        this.strokes = []; // Active persistent/ghost drawing strokes
        this.currentStroke = null;
        
        // Brush configurations
        this.brushColor = '#00f0ff';
        this.brushSize = 8;
        this.brushStyle = 'normal'; // normal, glow, ghost
        
        // Holographic visual options
        this.connectFingerVFX = false;
    }

    resize(width, height) {
        this.drawCanvas.width = width;
        this.drawCanvas.height = height;
        this.uiCanvas.width = width;
        this.uiCanvas.height = height;
        
        // Re-render drawings after resize
        this.renderDrawings();
    }

    setBrushColor(color) {
        this.brushColor = color;
    }

    setBrushSize(size) {
        this.brushSize = size;
    }

    setBrushStyle(style) {
        this.brushStyle = style;
    }

    // Begin a new drawing stroke
    startStroke(pt) {
        if (!pt) return;
        this.currentStroke = {
            points: [ { x: pt.x, y: pt.y, time: Date.now() } ],
            color: this.brushColor,
            size: this.brushSize,
            style: this.brushStyle,
            isGhost: this.brushStyle === 'ghost',
            createdAt: Date.now()
        };
        this.strokes.push(this.currentStroke);
    }

    // Append points to active stroke
    addPointToStroke(pt) {
        if (!this.currentStroke || !pt) return;
        this.currentStroke.points.push({
            x: pt.x,
            y: pt.y,
            time: Date.now()
        });
        this.renderDrawings();
    }

    endStroke() {
        this.currentStroke = null;
    }

    undo() {
        this.strokes.pop();
        this.renderDrawings();
    }

    clear() {
        this.strokes = [];
        this.currentStroke = null;
        this.drawCtx.clearRect(0, 0, this.drawCanvas.width, this.drawCanvas.height);
    }

    // Erase drawing lines intersecting with pointer
    eraseAt(pt, radius = 25) {
        if (!pt) return;
        let modified = false;

        for (let i = this.strokes.length - 1; i >= 0; i--) {
            const stroke = this.strokes[i];
            const originalLength = stroke.points.length;
            
            // Filter out points within erasing radius
            stroke.points = stroke.points.filter(p => {
                const dist = Math.hypot(p.x - pt.x, p.y - pt.y);
                return dist > radius;
            });

            if (stroke.points.length !== originalLength) {
                modified = true;
            }

            // Remove stroke entirely if no points left
            if (stroke.points.length === 0) {
                this.strokes.splice(i, 1);
            }
        }

        if (modified) {
            this.renderDrawings();
        }
    }

    // Clean drawing update loop
    renderDrawings() {
        const ctx = this.drawCtx;
        const width = this.drawCanvas.width;
        const height = this.drawCanvas.height;
        const now = Date.now();

        ctx.clearRect(0, 0, width, height);

        // Filter out expired ghost points or whole strokes
        this.strokes = this.strokes.filter(stroke => {
            if (stroke.isGhost) {
                // Keep points that are newer than 2 seconds (2000ms)
                stroke.points = stroke.points.filter(pt => now - pt.time < 2000);
                return stroke.points.length > 0;
            }
            return true;
        });

        this.strokes.forEach(stroke => {
            if (stroke.points.length < 1) return;

            // Apply special brush styles
            let strokeColor = stroke.color;
            const isRainbow = strokeColor === 'rainbow';

            ctx.save();
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = stroke.size;

            if (stroke.style === 'glow') {
                ctx.shadowBlur = stroke.size * 1.8;
            }

            if (!stroke.isGhost) {
                // Persistent strokes can be rendered in a single path for efficiency
                ctx.beginPath();
                ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
                
                if (isRainbow) {
                    const hue = (stroke.createdAt / 10) % 360;
                    ctx.strokeStyle = `hsl(${hue}, 100%, 50%)`;
                    ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
                } else {
                    ctx.strokeStyle = strokeColor;
                    ctx.shadowColor = strokeColor;
                }

                for (let i = 1; i < stroke.points.length; i++) {
                    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
                }
                ctx.stroke();
            } else {
                // Ghost strokes are rendered segment-by-segment to apply individual point fading!
                for (let i = 1; i < stroke.points.length; i++) {
                    const p1 = stroke.points[i - 1];
                    const p2 = stroke.points[i];
                    
                    const age = now - p2.time;
                    const alpha = Math.max(0, 1 - age / 2000);

                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    
                    if (isRainbow) {
                        const hue = (p2.time / 10) % 360;
                        ctx.strokeStyle = `hsla(${hue}, 100%, 50%, ${alpha})`;
                        ctx.shadowColor = `hsla(${hue}, 100%, 50%, ${alpha})`;
                    } else {
                        ctx.strokeStyle = strokeColor;
                        ctx.shadowColor = strokeColor;
                        ctx.globalAlpha = alpha;
                    }

                    ctx.shadowBlur = stroke.size * 1.5 * alpha;
                    ctx.stroke();
                }
            }

            ctx.restore();
        });
    }

    // Main real-time UI/Overlays drawing loop
    renderUI(handsData, activePointer, pointerState) {
        const ctx = this.uiCtx;
        const width = this.uiCanvas.width;
        const height = this.uiCanvas.height;

        ctx.clearRect(0, 0, width, height);

        // 1. Draw Holographic Hand Skeletal Structures
        if (handsData && handsData.landmarks) {
            handsData.landmarks.forEach((hand, handIdx) => {
                const handedness = handsData.handednesses[handIdx]?.[0]?.categoryName || 'Unknown';
                this.drawHolographicHand(ctx, hand, handedness, width, height);
            });

            // 2. VFX Constellation Mode (Double Hand Connection / Lightning Effect)
            if (this.connectFingerVFX && handsData.landmarks.length > 0) {
                this.drawConstellationVFX(ctx, handsData.landmarks, width, height);
            }
        }

        // 3. Draw Brush Pointer Target
        if (activePointer) {
            this.drawCursor(ctx, activePointer, pointerState);
        }
    }

    // Draws a beautiful cyberpunk/Jarvis-style hand skeleton
    drawHolographicHand(ctx, landmarks, handedness, width, height) {
        ctx.save();
        
        // Theme colors for hands (Cyan for Left, Magenta for Right)
        const isLeft = handedness.toLowerCase() === 'left';
        const colorMain = isLeft ? 'rgba(0, 240, 255, 0.45)' : 'rgba(255, 0, 127, 0.45)';
        const colorJoint = isLeft ? 'rgba(0, 240, 255, 0.8)' : 'rgba(255, 0, 127, 0.8)';
        
        // Define Hand Bones mapping connections
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8],       // Index
            [0, 9], [9, 10], [10, 11], [11, 12],   // Middle
            [0, 13], [13, 14], [14, 15], [15, 16], // Ring
            [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
            [5, 9], [9, 13], [13, 17]             // Palm knuckles
        ];

        // Draw connections (bones)
        ctx.beginPath();
        ctx.strokeStyle = colorMain;
        ctx.lineWidth = 1.5;
        connections.forEach(([i, j]) => {
            // Mirror x coordinate because video feed is mirrored
            const x1 = (1 - landmarks[i].x) * width;
            const y1 = landmarks[i].y * height;
            const x2 = (1 - landmarks[j].x) * width;
            const y2 = landmarks[j].y * height;
            
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
        });
        ctx.stroke();

        // Draw joints (dots)
        landmarks.forEach((landmark, index) => {
            const x = (1 - landmark.x) * width;
            const y = landmark.y * height;

            ctx.beginPath();
            // Highlight tips slightly more
            const isTip = [4, 8, 12, 16, 20].includes(index);
            const size = isTip ? 4.5 : 2.5;
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fillStyle = colorJoint;
            
            if (isTip) {
                ctx.shadowBlur = 8;
                ctx.shadowColor = colorJoint;
            }
            ctx.fill();
            ctx.shadowBlur = 0;
        });

        ctx.restore();
    }

    // Connects finger tips together with electrical lines
    drawConstellationVFX(ctx, allHands, width, height) {
        ctx.save();
        ctx.strokeStyle = 'rgba(57, 255, 20, 0.6)'; // Green energy
        ctx.shadowColor = '#39ff14';
        ctx.shadowBlur = 8;
        
        const tips = [4, 8, 12, 16, 20];

        // Case A: Two hands detected - draw electric lightning arcs between corresponding finger tips!
        if (allHands.length >= 2) {
            const hand1 = allHands[0];
            const hand2 = allHands[1];

            tips.forEach(tip => {
                const x1 = (1 - hand1[tip].x) * width;
                const y1 = hand1[tip].y * height;
                const x2 = (1 - hand2[tip].x) * width;
                const y2 = hand2[tip].y * height;

                this.drawElectricArc(ctx, x1, y1, x2, y2);
            });
        } 
        // Case B: Single hand detected - draw connections forming a glowing web between fingers
        else if (allHands.length === 1) {
            const hand = allHands[0];
            
            // Loop through tips and connect them sequentially
            for (let i = 0; i < tips.length - 1; i++) {
                const x1 = (1 - hand[tips[i]].x) * width;
                const y1 = hand[tips[i]].y * height;
                const x2 = (1 - hand[tips[i+1]].x) * width;
                const y2 = hand[tips[i+1]].y * height;

                this.drawElectricArc(ctx, x1, y1, x2, y2);
            }
            
            // Connect thumb tip to pinky tip to close loop
            const x1 = (1 - hand[4].x) * width;
            const y1 = hand[4].y * height;
            const x2 = (1 - hand[20].x) * width;
            const y2 = hand[20].y * height;
            this.drawElectricArc(ctx, x1, y1, x2, y2);
        }

        ctx.restore();
    }

    // Draws a dynamic lightning/plasma spark line
    drawElectricArc(ctx, x1, y1, x2, y2) {
        const dist = Math.hypot(x2 - x1, y2 - y1);
        const segments = Math.max(5, Math.floor(dist / 25));
        
        ctx.beginPath();
        ctx.lineWidth = 1.5;
        ctx.moveTo(x1, y1);

        for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const lx = x1 + (x2 - x1) * t;
            const ly = y1 + (y2 - y1) * t;

            // Add perpendicular electrical jitter
            const offset = (Math.random() - 0.5) * 12;
            const angle = Math.atan2(y2 - y1, x2 - x1) + Math.PI / 2;
            
            ctx.lineTo(
                lx + Math.cos(angle) * offset,
                ly + Math.sin(angle) * offset
            );
        }

        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    // Draw glowing cursor based on finger state
    drawCursor(ctx, pointer, state) {
        ctx.save();
        const { x, y } = pointer;

        if (state === 'draw') {
            // Pulsing solid brush point
            ctx.beginPath();
            ctx.arc(x, y, this.brushSize / 2 + 2, 0, Math.PI * 2);
            ctx.fillStyle = this.brushColor === 'rainbow' ? '#ffffff' : this.brushColor;
            ctx.shadowBlur = 12;
            ctx.shadowColor = this.brushColor === 'rainbow' ? 'violet' : this.brushColor;
            ctx.fill();
        } else if (state === 'erase') {
            // Large red warning circle for eraser
            ctx.beginPath();
            ctx.arc(x, y, 25, 0, Math.PI * 2);
            ctx.strokeStyle = '#ff0055';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = '#ff0055';
            ctx.shadowBlur = 8;
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, Math.PI * 2);
            ctx.fillStyle = '#ff0055';
            ctx.fill();
        } else {
            // Hover: pulsing outer ring with inner dot
            const pulse = 1 + Math.sin(performance.now() * 0.01) * 0.15;
            
            ctx.beginPath();
            ctx.arc(x, y, 14 * pulse, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(x, y, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
        }

        ctx.restore();
    }
}
