import { Synth } from './synth.js';

// Game level definitions using normalized coordinates (0.0 to 1.0)
export const GAME_LEVELS = [
    {
        name: "Electric Star",
        difficulty: "Easy",
        dots: [
            { x: 0.50, y: 0.18, label: "1" },
            { x: 0.63, y: 0.42, label: "2" },
            { x: 0.90, y: 0.42, label: "3" },
            { x: 0.68, y: 0.60, label: "4" },
            { x: 0.77, y: 0.88, label: "5" },
            { x: 0.50, y: 0.72, label: "6" },
            { x: 0.23, y: 0.88, label: "7" },
            { x: 0.32, y: 0.60, label: "8" },
            { x: 0.10, y: 0.42, label: "9" },
            { x: 0.37, y: 0.42, label: "10" }
        ],
        closedLoop: true
    },
    {
        name: "Cyber Heart",
        difficulty: "Medium",
        dots: [
            { x: 0.50, y: 0.32, label: "1" },
            { x: 0.62, y: 0.18, label: "2" },
            { x: 0.78, y: 0.18, label: "3" },
            { x: 0.85, y: 0.32, label: "4" },
            { x: 0.78, y: 0.52, label: "5" },
            { x: 0.50, y: 0.82, label: "6" },
            { x: 0.22, y: 0.52, label: "7" },
            { x: 0.15, y: 0.32, label: "8" },
            { x: 0.22, y: 0.18, label: "9" },
            { x: 0.38, y: 0.18, label: "10" }
        ],
        closedLoop: true
    },
    {
        name: "Cyber Rocket",
        difficulty: "Hard",
        dots: [
            { x: 0.50, y: 0.12, label: "1" }, // Nose cone
            { x: 0.62, y: 0.35, label: "2" }, // Right body top
            { x: 0.62, y: 0.65, label: "3" }, // Right body bottom
            { x: 0.78, y: 0.78, label: "4" }, // Right wing tip
            { x: 0.62, y: 0.78, label: "5" }, // Right body edge
            { x: 0.55, y: 0.88, label: "6" }, // Thruster right
            { x: 0.45, y: 0.88, label: "7" }, // Thruster left
            { x: 0.38, y: 0.78, label: "8" }, // Left body edge
            { x: 0.22, y: 0.78, label: "9" }, // Left wing tip
            { x: 0.38, y: 0.65, label: "10" }, // Left body bottom
            { x: 0.38, y: 0.35, label: "11" }  // Left body top
        ],
        closedLoop: true
    },
    {
        name: "Neon Smile",
        difficulty: "Easy",
        dots: [
            { x: 0.25, y: 0.35, label: "1" }, // Left Eye
            { x: 0.32, y: 0.35, label: "2" }, // Left Eye End
            { x: 0.68, y: 0.35, label: "3" }, // Right Eye
            { x: 0.75, y: 0.35, label: "4" }, // Right Eye End
            { x: 0.20, y: 0.58, label: "5" }, // Smile Start
            { x: 0.35, y: 0.75, label: "6" }, // Smile curve bottom-left
            { x: 0.50, y: 0.80, label: "7" }, // Smile center
            { x: 0.65, y: 0.75, label: "8" }, // Smile curve bottom-right
            { x: 0.80, y: 0.58, label: "9" }  // Smile End
        ],
        closedLoop: false
    }
];

export class GameEngine {
    constructor() {
        this.currentLevelIndex = 0;
        this.dots = [];
        this.connectedIndices = [];
        this.activeDotIndex = 0;
        
        this.startTime = null;
        this.elapsedTime = 0;
        this.isFinished = false;
        
        this.particles = [];
        this.hoverTimer = 0;
        this.hoveredDotIndex = -1;
    }

    loadLevel(levelIndex) {
        this.currentLevelIndex = levelIndex;
        const lvl = GAME_LEVELS[levelIndex];
        this.dots = lvl.dots.map(dot => ({ ...dot }));
        this.connectedIndices = [];
        this.activeDotIndex = 0;
        this.startTime = null;
        this.elapsedTime = 0;
        this.isFinished = false;
        this.particles = [];
        this.hoverTimer = 0;
        this.hoveredDotIndex = -1;
    }

    getCurrentLevel() {
        return GAME_LEVELS[this.currentLevelIndex];
    }

    startTimer() {
        if (!this.startTime) {
            this.startTime = performance.now();
        }
    }

    updateTimer() {
        if (this.startTime && !this.isFinished) {
            this.elapsedTime = (performance.now() - this.startTime) / 1000;
        }
        return this.elapsedTime;
    }

    // Process finger tip positions to detect if a dot is connected
    checkCollisions(pointer, width, height) {
        if (this.isFinished || !pointer) return;

        this.startTimer();

        const collisionRadius = 32; // Pixels
        const activeDot = this.dots[this.activeDotIndex];
        const dotX = activeDot.x * width;
        const dotY = activeDot.y * height;

        const dist = Math.hypot(pointer.x - dotX, pointer.y - dotY);

        // Hover ticking effect when getting close
        if (dist < collisionRadius * 2 && dist >= collisionRadius) {
            if (Math.random() < 0.15) {
                Synth.playHover();
            }
        }

        // Complete connection if pointer enters collision boundary
        if (dist < collisionRadius) {
            this.connectDot(this.activeDotIndex, dotX, dotY);
        }
    }

    connectDot(index, x, y) {
        this.connectedIndices.push(index);
        this.spawnParticleBurst(x, y);
        Synth.playConnect();

        // Advance to next dot
        if (this.activeDotIndex < this.dots.length - 1) {
            this.activeDotIndex++;
        } else {
            // Level Completed!
            this.isFinished = true;
            Synth.playVictory();
            this.spawnVictoryBurst(x, y);
        }
    }

    // Custom Particle burst on success
    spawnParticleBurst(x, y) {
        const colors = ["#00f0ff", "#ff007f", "#39ff14", "#ffaa00", "#ffffff"];
        const color = colors[Math.floor(Math.random() * colors.length)];
        
        for (let i = 0; i < 25; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 6;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 2 + Math.random() * 4,
                color: color,
                alpha: 1.0,
                decay: 0.02 + Math.random() * 0.03
            });
        }
    }

    spawnVictoryBurst(centerX, centerY) {
        const colors = ["#00f0ff", "#ff007f", "#39ff14", "#ffaa00"];
        for (let burst = 0; burst < 3; burst++) {
            const bx = centerX + (Math.random() - 0.5) * 150;
            const by = centerY + (Math.random() - 0.5) * 150;
            setTimeout(() => {
                for (let i = 0; i < 40; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 1 + Math.random() * 8;
                    const color = colors[Math.floor(Math.random() * colors.length)];
                    this.particles.push({
                        x: bx,
                        y: by,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        size: 3 + Math.random() * 5,
                        color: color,
                        alpha: 1.0,
                        decay: 0.01 + Math.random() * 0.015
                    });
                }
            }, burst * 250);
        }
    }

    // Particle updater loop
    updateParticles() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            // Apply light gravity/friction
            p.vx *= 0.98;
            p.vy *= 0.98;
            p.vy += 0.05; // Light gravity drift
            p.alpha -= p.decay;

            if (p.alpha <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    // Renders the level nodes and connection lines
    render(ctx, width, height) {
        const lvl = this.getCurrentLevel();

        // 1. Draw completed connection lines
        if (this.connectedIndices.length > 0) {
            ctx.beginPath();
            ctx.strokeStyle = "rgba(0, 240, 255, 0.85)";
            ctx.lineWidth = 4;
            ctx.shadowBlur = 12;
            ctx.shadowColor = "#00f0ff";
            ctx.lineCap = "round";
            ctx.lineJoin = "round";

            const firstDot = this.dots[this.connectedIndices[0]];
            ctx.moveTo(firstDot.x * width, firstDot.y * height);

            for (let i = 1; i < this.connectedIndices.length; i++) {
                const dot = this.dots[this.connectedIndices[i]];
                ctx.lineTo(dot.x * width, dot.y * height);
            }
            ctx.stroke();

            // Handle closed loop visual rendering if finished
            if (this.isFinished && lvl.closedLoop) {
                ctx.beginPath();
                ctx.strokeStyle = "rgba(0, 240, 255, 0.85)";
                ctx.lineWidth = 4;
                const lastDot = this.dots[this.dots.length - 1];
                ctx.moveTo(lastDot.x * width, lastDot.y * height);
                ctx.lineTo(firstDot.x * width, firstDot.y * height);
                ctx.stroke();
            }

            ctx.shadowBlur = 0; // Reset
        }

        // 2. Draw game nodes
        this.dots.forEach((dot, index) => {
            const x = dot.x * width;
            const y = dot.y * height;
            const isConnected = this.connectedIndices.includes(index);
            const isActive = index === this.activeDotIndex && !this.isFinished;

            ctx.beginPath();
            ctx.arc(x, y, isConnected ? 10 : isActive ? 14 : 8, 0, Math.PI * 2);

            // Coloring rules: Connected = Cyan, Active = Pulse Magenta, Upcoming = Faint white
            if (isConnected) {
                ctx.fillStyle = "#00f0ff";
                ctx.shadowBlur = 10;
                ctx.shadowColor = "#00f0ff";
                ctx.fill();
            } else if (isActive) {
                // Pulse size factor
                const pulse = 1 + Math.sin(performance.now() * 0.008) * 0.15;
                ctx.shadowBlur = 15 + Math.sin(performance.now() * 0.008) * 5;
                ctx.shadowColor = "#ff007f";
                ctx.fillStyle = "#ff007f";
                
                ctx.beginPath();
                ctx.arc(x, y, 10 * pulse, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
                ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
                ctx.lineWidth = 1;
                ctx.fill();
                ctx.stroke();
            }
            ctx.shadowBlur = 0; // Reset

            // Render numbers on nodes
            ctx.fillStyle = isConnected ? "#080914" : "#ffffff";
            ctx.font = `bold ${isConnected ? "10px" : "12px"} ${getComputedStyle(document.body).fontFamily || "sans-serif"}`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(dot.label, x, y);
        });

        // 3. Render Particles
        this.particles.forEach(p => {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.shadowBlur = p.size * 2;
            ctx.shadowColor = p.color;
            ctx.fill();
            ctx.restore();
        });
    }
}

export const Game = new GameEngine();
