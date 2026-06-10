// Helper module for calculating spatial hand relationships and identifying gestures
export const Gestures = {
    // Utility to calculate Euclidean distance in 3D
    distance(pt1, pt2) {
        if (!pt1 || !pt2) return Infinity;
        const dx = pt1.x - pt2.x;
        const dy = pt1.y - pt2.y;
        const dz = pt1.z - pt2.z || 0;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    },

    // Estimate the scale of the hand to normalize distances
    getHandScale(landmarks) {
        // Wrist to Middle Finger MCP (knuckle) is a stable metric for hand size
        const wrist = landmarks[0];
        const middleKnuckle = landmarks[9];
        return this.distance(wrist, middleKnuckle);
    },

    // Detect if Thumb and Index finger tips are pinching
    isPinching(landmarks) {
        if (!landmarks || landmarks.length < 21) return false;

        const thumbTip = landmarks[4];
        const indexTip = landmarks[8];
        const scale = this.getHandScale(landmarks);

        if (scale === 0) return false;

        const rawDist = this.distance(thumbTip, indexTip);
        const ratio = rawDist / scale;

        // Ratio below 0.35 typically signals a pinch.
        // Let's return both boolean state and the ratio for visualization/fine-tuning.
        return {
            active: ratio < 0.38,
            ratio: ratio
        };
    },

    // Detect if the hand is closed in a fist (Erase gesture)
    isFist(landmarks) {
        if (!landmarks || landmarks.length < 21) return false;

        const wrist = landmarks[0];
        const scale = this.getHandScale(landmarks);

        // Check if index, middle, ring, pinky finger tips are retracted
        // A finger is retracted if its tip is closer to the wrist than its corresponding MCP joint (knuckle)
        const jointsToCheck = [
            { tip: 8, mcp: 5 },   // Index
            { tip: 12, mcp: 9 },  // Middle
            { tip: 16, mcp: 13 }, // Ring
            { tip: 20, mcp: 17 }  // Pinky
        ];

        let retractedCount = 0;
        jointsToCheck.forEach(joint => {
            const tipDist = this.distance(landmarks[joint.tip], wrist);
            const mcpDist = this.distance(landmarks[joint.mcp], wrist);
            
            // If the tip is closer or almost as close to wrist as the knuckle
            if (tipDist < mcpDist * 1.1) {
                retractedCount++;
            }
        });

        // If all 4 fingers are retracted, it's a fist
        return retractedCount === 4;
    },

    // Detect if the hand is fully open (Palm)
    isPalm(landmarks) {
        if (!landmarks || landmarks.length < 21) return false;

        const wrist = landmarks[0];
        
        const jointsToCheck = [
            { tip: 8, mcp: 5 },   // Index
            { tip: 12, mcp: 9 },  // Middle
            { tip: 16, mcp: 13 }, // Ring
            { tip: 20, mcp: 17 }  // Pinky
        ];

        let extendedCount = 0;
        jointsToCheck.forEach(joint => {
            const tipDist = this.distance(landmarks[joint.tip], wrist);
            const mcpDist = this.distance(landmarks[joint.mcp], wrist);
            
            // If tip is significantly further from the wrist than the knuckle
            if (tipDist > mcpDist * 1.3) {
                extendedCount++;
            }
        });

        // 3 or 4 fingers extended is considered an open palm
        return extendedCount >= 3 && !this.isPinching(landmarks).active;
    },

    // Helper to get active brush position (middle point of pinch, or index tip)
    getBrushPosition(landmarks, canvasWidth, canvasHeight) {
        if (!landmarks || landmarks.length < 21) return null;

        const indexTip = landmarks[8];
        const thumbTip = landmarks[4];
        
        // Return mirrored coordinates for standard mirrored video preview
        // Since the camera is mirrored horizontally (scaleX(-1)),
        // indexTip.x goes from 0 (left of camera frame, which is right side of screen) to 1.
        // We mirror it to match the screen's visual coordinate space:
        // x_screen = (1 - x_raw) * width
        const x = (1 - indexTip.x) * canvasWidth;
        const y = indexTip.y * canvasHeight;
        
        return { x, y, z: indexTip.z };
    }
};
