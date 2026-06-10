// Web Audio API Synthesizer for retro sci-fi sound effects
class SoundEngine {
    constructor() {
        this.ctx = null;
        this.muted = false;
        this.drawingOsc = null;
        this.drawingGain = null;
    }

    init() {
        if (this.ctx) return;
        // AudioContext initialization requires a user gesture. We trigger this on first interaction.
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            this.ctx = new AudioContextClass();
        }
    }

    playHover() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const time = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, time);
        osc.frequency.exponentialRampToValueAtTime(600, time + 0.08);

        gain.gain.setValueAtTime(0.08, time);
        gain.gain.linearRampToValueAtTime(0.001, time + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(time);
        osc.stop(time + 0.08);
    }

    playConnect() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const time = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Laser "pew" sound effect
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, time);
        osc.frequency.exponentialRampToValueAtTime(200, time + 0.15);

        gain.gain.setValueAtTime(0.12, time);
        gain.gain.linearRampToValueAtTime(0.001, time + 0.15);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(time);
        osc.stop(time + 0.15);
    }

    playVictory() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const time = this.ctx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50]; // Arpeggio: C4, E4, G4, C5, E5, G5, C6
        
        notes.forEach((freq, index) => {
            const noteTime = time + (index * 0.1);
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, noteTime);

            gain.gain.setValueAtTime(0, noteTime);
            gain.gain.linearRampToValueAtTime(0.15, noteTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.45);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(noteTime);
            osc.stop(noteTime + 0.5);
        });
    }

    startDrawSound() {
        if (this.muted) return;
        this.init();
        if (!this.ctx || this.drawingOsc) return;

        try {
            const time = this.ctx.currentTime;
            this.drawingOsc = this.ctx.createOscillator();
            this.drawingGain = this.ctx.createGain();

            this.drawingOsc.type = 'sine';
            // Start at lower tone
            this.drawingOsc.frequency.setValueAtTime(120, time);

            this.drawingGain.gain.setValueAtTime(0, time);
            this.drawingGain.gain.linearRampToValueAtTime(0.04, time + 0.1);

            this.drawingOsc.connect(this.drawingGain);
            this.drawingGain.connect(this.ctx.destination);

            this.drawingOsc.start(time);
        } catch (e) {
            console.error("Failed to start draw sound:", e);
        }
    }

    updateDrawSound(frequency) {
        if (this.muted || !this.ctx || !this.drawingOsc) return;
        // Clamp frequency to pleasant ranges
        const targetFreq = Math.min(Math.max(frequency, 100), 500);
        this.drawingOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.05);
    }

    stopDrawSound() {
        if (!this.drawingOsc) return;
        try {
            const time = this.ctx.currentTime;
            this.drawingGain.gain.cancelScheduledValues(time);
            this.drawingGain.gain.setValueAtTime(this.drawingGain.gain.value, time);
            this.drawingGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
            
            const osc = this.drawingOsc;
            setTimeout(() => {
                try {
                    osc.stop();
                    osc.disconnect();
                } catch (err) {}
            }, 150);

            this.drawingOsc = null;
            this.drawingGain = null;
        } catch (e) {
            console.error("Failed to stop draw sound:", e);
            this.drawingOsc = null;
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        if (this.muted && this.drawingOsc) {
            this.stopDrawSound();
        }
        return this.muted;
    }
}

export const Synth = new SoundEngine();
