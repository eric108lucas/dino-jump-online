// Ground - Minecraft-style grass ground with pixel art texture
class Ground {
    constructor(canvas, ctx, groundY = 250) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.y = groundY; // Ground line position (where grass top starts)
        this.grassHeight = 50; // Height of the grass/dirt section
        this.scrollOffset = 0;

        // Minecraft grass colors
        this.grassTopColor = '#5D9B3C';
        this.grassDarkColor = '#4A7F30';
        this.grassLightColor = '#7ABF4E';
        this.dirtColor = '#8B5A2B';
        this.dirtDarkColor = '#6B4423';
        this.dirtLightColor = '#A0673D';
        this.skyColor = '#87CEEB';

        // Pre-generate noise pattern
        this.noisePattern = this.generateNoisePattern();
    }

    generateNoisePattern() {
        const pattern = [];
        const patternWidth = 200;
        const patternHeight = 60;

        for (let y = 0; y < patternHeight; y++) {
            pattern[y] = [];
            for (let x = 0; x < patternWidth; x++) {
                pattern[y][x] = Math.random();
            }
        }
        return pattern;
    }

    update(speed) {
        this.scrollOffset += speed;
        if (this.scrollOffset >= 200) {
            this.scrollOffset -= 200;
        }
    }

    draw(skyStartY = 0, skyEndY = null) {
        const ctx = this.ctx;

        // Draw sky background from skyStartY to ground
        if (skyEndY === null) {
            skyEndY = this.y;
        }

        ctx.fillStyle = this.skyColor;
        ctx.fillRect(0, skyStartY, this.canvas.width, skyEndY - skyStartY);

        // Draw grass layer
        this.drawGrassLayer(ctx);

        // Draw dirt layer
        this.drawDirtLayer(ctx);
    }

    drawGrassLayer(ctx) {
        const grassDepth = 12;
        const pixelSize = 4;

        for (let py = 0; py < grassDepth; py += pixelSize) {
            for (let px = 0; px < this.canvas.width; px += pixelSize) {
                const noiseX = Math.floor((px + this.scrollOffset) % 200);
                const noiseY = Math.floor(py % 60);
                const noise = this.noisePattern[noiseY][noiseX];

                let color;
                if (py < pixelSize) {
                    if (noise < 0.3) {
                        color = this.grassLightColor;
                    } else if (noise < 0.7) {
                        color = this.grassTopColor;
                    } else {
                        color = this.grassDarkColor;
                    }
                } else {
                    if (noise < 0.2) {
                        color = this.grassLightColor;
                    } else if (noise < 0.5) {
                        color = this.grassTopColor;
                    } else {
                        color = this.grassDarkColor;
                    }
                }

                ctx.fillStyle = color;
                ctx.fillRect(px, this.y + py, pixelSize, pixelSize);
            }
        }

        // Grass tufts on top
        ctx.fillStyle = this.grassLightColor;
        for (let px = 0; px < this.canvas.width; px += 8) {
            const noiseX = Math.floor((px + this.scrollOffset) % 200);
            const noise = this.noisePattern[0][noiseX];
            if (noise > 0.7) {
                ctx.fillRect(px, this.y - 4, 2, 4);
            }
        }
    }

    drawDirtLayer(ctx) {
        const grassDepth = 12;
        const dirtDepth = this.grassHeight - grassDepth;
        const pixelSize = 4;

        for (let py = 0; py < dirtDepth; py += pixelSize) {
            for (let px = 0; px < this.canvas.width; px += pixelSize) {
                const noiseX = Math.floor((px + this.scrollOffset * 0.5) % 200);
                const noiseY = Math.floor((py + 20) % 60);
                const noise = this.noisePattern[noiseY][noiseX];

                let color;
                if (noise < 0.25) {
                    color = this.dirtLightColor;
                } else if (noise < 0.65) {
                    color = this.dirtColor;
                } else {
                    color = this.dirtDarkColor;
                }

                ctx.fillStyle = color;
                ctx.fillRect(px, this.y + grassDepth + py, pixelSize, pixelSize);
            }
        }

        // Stone specks
        ctx.fillStyle = '#696969';
        for (let px = 0; px < this.canvas.width; px += 16) {
            const noiseX = Math.floor((px + this.scrollOffset * 0.5) % 200);
            const noise = this.noisePattern[30][noiseX];
            if (noise > 0.85) {
                const yOffset = Math.floor(noise * 30);
                ctx.fillRect(px, this.y + grassDepth + yOffset, 4, 4);
            }
        }
    }

    reset() {
        this.scrollOffset = 0;
    }
}

// Multi-lane ground manager for two-player mode
class MultiLaneGround {
    constructor(canvas, ctx, laneConfigs) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.lanes = laneConfigs.map(config => new Ground(canvas, ctx, config.groundY));
        this.laneConfigs = laneConfigs;
    }

    update(speed) {
        this.lanes.forEach(lane => lane.update(speed));
    }

    draw() {
        const ctx = this.ctx;

        // Draw sky for entire canvas first
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw each lane's ground
        this.lanes.forEach((lane, index) => {
            lane.drawGrassLayer(ctx);
            lane.drawDirtLayer(ctx);
        });
    }

    reset() {
        this.lanes.forEach(lane => lane.reset());
    }
}
