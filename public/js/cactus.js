// Cactus - Obstacle management with pixel art rendering
class CactusManager {
    constructor(canvas, ctx, groundY = 250) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.cacti = [];
        this.groundY = groundY;

        // Cactus types with different sizes
        this.cactusTypes = [
            { width: 17, height: 35, type: 'small' },
            { width: 25, height: 50, type: 'tall' },
            { width: 40, height: 35, type: 'double' }
        ];

        // Spawn scheduling
        this.nextSpawnDistance = 0;
        this.distanceTraveled = 0;
        this.spawnedCount = 0;
    }

    getAbsoluteMinGap(speed, level) {
        const jumpDuration = 0.6;
        const framesPerSecond = 60;
        const jumpDistance = speed * framesPerSecond * jumpDuration;
        const dinoWidth = 44;
        const maxCactusWidth = 40;
        const safetyMargin = Math.max(1.15, 1.5 - (level - 1) * 0.1);
        return (jumpDistance + dinoWidth + maxCactusWidth) * safetyMargin;
    }

    getMinGap(speed, level) {
        return this.getAbsoluteMinGap(speed, level);
    }

    getMaxGap(speed, level) {
        const minGap = this.getMinGap(speed, level);
        const maxMultiplier = Math.max(2.5, 4 - (level - 1) * 0.4);
        return minGap * maxMultiplier;
    }

    getRandomGap(speed, level) {
        const minGap = this.getMinGap(speed, level);
        const maxGap = this.getMaxGap(speed, level);
        const roll = Math.random();

        let gap;
        if (roll < 0.3) {
            gap = minGap + Math.random() * (maxGap - minGap) * 0.25;
        } else if (roll < 0.8) {
            gap = minGap + (maxGap - minGap) * (0.25 + Math.random() * 0.45);
        } else {
            gap = minGap + (maxGap - minGap) * (0.7 + Math.random() * 0.3);
        }
        return gap;
    }

    initSpawning(speed, level, totalTime, targetCacti) {
        this.spawnedCount = 0;
        this.distanceTraveled = 0;
        this.nextSpawnDistance = 300 + Math.random() * 200;
        this.currentLevel = level;
        this.targetCacti = targetCacti;
        this.totalTime = totalTime;
    }

    spawnCactus(speed, cactusType = null) {
        const type = cactusType || this.cactusTypes[Math.floor(Math.random() * this.cactusTypes.length)];

        this.cacti.push({
            x: this.canvas.width + 50,
            y: this.groundY - type.height,
            width: type.width,
            height: type.height,
            type: type.type,
            passed: false
        });

        this.spawnedCount++;
        this.nextSpawnDistance = this.getRandomGap(speed, this.currentLevel || 1);

        return type; // Return the type for syncing with other lanes
    }

    shouldSpawn(speed, elapsedTime, totalTime, targetCacti, level) {
        this.currentLevel = level || 1;
        this.targetCacti = targetCacti;
        this.totalTime = totalTime;

        if (this.cacti.length === 0 && this.spawnedCount === 0) {
            if (this.distanceTraveled < (this.nextSpawnDistance || 300)) {
                return false;
            }
            return true;
        }

        const lastCactus = this.cacti[this.cacti.length - 1];
        if (!lastCactus) {
            return this.distanceTraveled >= this.nextSpawnDistance;
        }

        const distanceFromLast = this.canvas.width + 50 - lastCactus.x;
        const absoluteMin = this.getAbsoluteMinGap(speed, this.currentLevel);

        if (distanceFromLast < absoluteMin) {
            return false;
        }

        if (distanceFromLast >= this.nextSpawnDistance) {
            if (this.spawnedCount >= targetCacti) {
                return false;
            }

            const remainingTime = totalTime - elapsedTime;
            const remainingCacti = targetCacti - this.spawnedCount;

            if (remainingCacti > 0 && remainingTime > 0) {
                const idealCactiByNow = (elapsedTime / totalTime) * targetCacti;
                if (this.spawnedCount < idealCactiByNow - 2) {
                    return true;
                }
            }
            return true;
        }
        return false;
    }

    getTotalSpawned() {
        return this.spawnedCount;
    }

    update(speed, dino) {
        let scored = false;

        for (let i = this.cacti.length - 1; i >= 0; i--) {
            const cactus = this.cacti[i];
            cactus.x -= speed;

            if (dino && dino.isAlive && !cactus.passed && cactus.x + cactus.width < dino.x) {
                cactus.passed = true;
                scored = true;
            }

            if (cactus.x + cactus.width < 0) {
                this.cacti.splice(i, 1);
            }
        }
        return scored;
    }

    checkCollision(dino) {
        if (!dino.isAlive) return false;

        const dinoBox = dino.getHitbox();

        for (let cactus of this.cacti) {
            const cactusBox = {
                x: cactus.x + 3,
                y: cactus.y + 3,
                width: cactus.width - 6,
                height: cactus.height - 6
            };

            if (
                dinoBox.x < cactusBox.x + cactusBox.width &&
                dinoBox.x + dinoBox.width > cactusBox.x &&
                dinoBox.y < cactusBox.y + cactusBox.height &&
                dinoBox.y + dinoBox.height > cactusBox.y
            ) {
                return true;
            }
        }
        return false;
    }

    draw() {
        const ctx = this.ctx;
        ctx.fillStyle = '#535353';

        for (let cactus of this.cacti) {
            this.drawCactus(ctx, cactus);
        }
    }

    drawCactus(ctx, cactus) {
        const x = Math.floor(cactus.x);
        const y = Math.floor(cactus.y);

        if (cactus.type === 'small') {
            this.drawSmallCactus(ctx, x, y);
        } else if (cactus.type === 'tall') {
            this.drawTallCactus(ctx, x, y);
        } else {
            this.drawDoubleCactus(ctx, x, y);
        }
    }

    drawSmallCactus(ctx, x, y) {
        ctx.fillRect(x + 6, y, 5, 35);
        ctx.fillRect(x, y + 10, 6, 4);
        ctx.fillRect(x, y + 6, 4, 8);
        ctx.fillRect(x + 11, y + 15, 6, 4);
        ctx.fillRect(x + 13, y + 11, 4, 8);
        ctx.fillRect(x + 5, y - 2, 2, 3);
        ctx.fillRect(x + 10, y - 2, 2, 3);
    }

    drawTallCactus(ctx, x, y) {
        ctx.fillRect(x + 9, y, 7, 50);
        ctx.fillRect(x, y + 8, 9, 5);
        ctx.fillRect(x, y + 3, 5, 10);
        ctx.fillRect(x + 16, y + 25, 9, 5);
        ctx.fillRect(x + 20, y + 20, 5, 10);
        ctx.fillRect(x + 8, y - 3, 2, 4);
        ctx.fillRect(x + 15, y - 3, 2, 4);
        ctx.fillRect(x - 2, y + 2, 3, 2);
        ctx.fillRect(x + 24, y + 19, 3, 2);
    }

    drawDoubleCactus(ctx, x, y) {
        ctx.fillRect(x + 4, y + 5, 5, 30);
        ctx.fillRect(x, y + 12, 4, 4);
        ctx.fillRect(x, y + 8, 3, 8);
        ctx.fillRect(x + 9, y + 18, 4, 4);
        ctx.fillRect(x + 10, y + 14, 3, 8);
        ctx.fillRect(x + 22, y, 5, 35);
        ctx.fillRect(x + 16, y + 8, 6, 4);
        ctx.fillRect(x + 16, y + 4, 4, 8);
        ctx.fillRect(x + 27, y + 15, 6, 4);
        ctx.fillRect(x + 29, y + 11, 4, 8);
        ctx.fillRect(x + 8, y + 32, 15, 3);
        ctx.fillRect(x + 3, y + 2, 2, 4);
        ctx.fillRect(x + 21, y - 3, 2, 4);
        ctx.fillRect(x + 26, y - 3, 2, 4);
    }

    reset() {
        this.cacti = [];
        this.spawnedCount = 0;
        this.distanceTraveled = 0;
        this.nextSpawnDistance = 300 + Math.random() * 200;
    }
}

// Multi-lane cactus manager for two-player mode
class MultiLaneCactusManager {
    constructor(canvas, ctx, laneConfigs) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.lanes = laneConfigs.map(config =>
            new CactusManager(canvas, ctx, config.groundY)
        );

        // Shared spawn scheduling (same pattern for all lanes)
        this.nextSpawnDistance = 300 + Math.random() * 200;
        this.distanceTraveled = 0;
        this.spawnedCount = 0;
        this.currentLevel = 1;
    }

    // Use first lane's gap calculations (they're all the same)
    getRandomGap(speed, level) {
        return this.lanes[0].getRandomGap(speed, level);
    }

    shouldSpawn(speed, elapsedTime, totalTime, targetCacti, level) {
        this.currentLevel = level || 1;

        if (this.spawnedCount === 0) {
            if (this.distanceTraveled < this.nextSpawnDistance) {
                return false;
            }
            return true;
        }

        // Check distance from last cactus in first lane
        const firstLane = this.lanes[0];
        const lastCactus = firstLane.cacti[firstLane.cacti.length - 1];

        if (!lastCactus) {
            return this.distanceTraveled >= this.nextSpawnDistance;
        }

        const distanceFromLast = this.canvas.width + 50 - lastCactus.x;
        const absoluteMin = firstLane.getAbsoluteMinGap(speed, this.currentLevel);

        if (distanceFromLast < absoluteMin) {
            return false;
        }

        if (distanceFromLast >= this.nextSpawnDistance) {
            if (this.spawnedCount >= targetCacti) {
                return false;
            }
            return true;
        }
        return false;
    }

    spawnCactus(speed) {
        // Choose cactus type once for all lanes
        const type = this.lanes[0].cactusTypes[
            Math.floor(Math.random() * this.lanes[0].cactusTypes.length)
        ];

        // Spawn same cactus in all lanes
        this.lanes.forEach(lane => {
            lane.cacti.push({
                x: this.canvas.width + 50,
                y: lane.groundY - type.height,
                width: type.width,
                height: type.height,
                type: type.type,
                passed: false,
                passedBy: {} // Track which players passed this cactus
            });
        });

        this.spawnedCount++;
        this.nextSpawnDistance = this.getRandomGap(speed, this.currentLevel);
    }

    update(speed, dinos) {
        this.distanceTraveled += speed;

        const scores = dinos.map(() => false);

        // Update each lane
        this.lanes.forEach((lane, laneIndex) => {
            const dino = dinos[laneIndex];

            for (let i = lane.cacti.length - 1; i >= 0; i--) {
                const cactus = lane.cacti[i];
                cactus.x -= speed;

                // Check if this dino passed this cactus
                if (dino && dino.isAlive) {
                    const passKey = `player${laneIndex}`;
                    if (!cactus.passedBy[passKey] && cactus.x + cactus.width < dino.x) {
                        cactus.passedBy[passKey] = true;
                        scores[laneIndex] = true;
                    }
                }

                // Remove off-screen cacti
                if (cactus.x + cactus.width < 0) {
                    lane.cacti.splice(i, 1);
                }
            }
        });

        return scores;
    }

    checkCollision(dino, laneIndex) {
        return this.lanes[laneIndex].checkCollision(dino);
    }

    draw() {
        this.lanes.forEach(lane => lane.draw());
    }

    reset() {
        this.lanes.forEach(lane => lane.reset());
        this.spawnedCount = 0;
        this.distanceTraveled = 0;
        this.nextSpawnDistance = 300 + Math.random() * 200;
    }
}
