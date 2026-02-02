// Dino - The player character with pixel art rendering
class Dino {
    constructor(canvas, ctx, options = {}) {
        this.canvas = canvas;
        this.ctx = ctx;

        // Player identification
        this.playerId = options.playerId || 1;
        this.color = options.color || '#535353';
        this.deadColor = '#999999';

        // Position and size
        this.width = 44;
        this.height = 47;
        this.x = options.x || 50;
        this.baseGroundY = options.groundY || 250;
        this.groundY = this.baseGroundY - this.height;
        this.y = this.groundY;

        // Physics
        this.velocityY = 0;
        this.gravity = 0.8;
        this.jumpForce = -15;
        this.isJumping = false;

        // State
        this.isAlive = true;

        // Animation
        this.animationFrame = 0;
        this.animationTimer = 0;
        this.animationSpeed = 6;
    }

    jump() {
        if (!this.isJumping && this.isAlive) {
            this.velocityY = this.jumpForce;
            this.isJumping = true;
            soundManager.playJump();
        }
    }

    update() {
        if (!this.isAlive) return;

        // Apply gravity
        if (this.isJumping) {
            this.velocityY += this.gravity;
            this.y += this.velocityY;

            // Land on ground
            if (this.y >= this.groundY) {
                this.y = this.groundY;
                this.velocityY = 0;
                this.isJumping = false;
            }
        }

        // Update running animation
        if (!this.isJumping) {
            this.animationTimer++;
            if (this.animationTimer >= this.animationSpeed) {
                this.animationTimer = 0;
                this.animationFrame = (this.animationFrame + 1) % 2;
            }
        }
    }

    draw() {
        const ctx = this.ctx;
        const x = Math.floor(this.x);
        const y = Math.floor(this.y);

        // Use dead color if not alive
        const mainColor = this.isAlive ? this.color : this.deadColor;

        if (this.isJumping) {
            this.drawJumpingDino(ctx, x, y, mainColor);
        } else {
            this.drawRunningDino(ctx, x, y, this.animationFrame, mainColor);
        }

        // Draw X eyes if dead
        if (!this.isAlive) {
            this.drawDeadEyes(ctx, x, y);
        }
    }

    drawRunningDino(ctx, x, y, frame, color) {
        ctx.fillStyle = color;

        // Head
        ctx.fillRect(x + 22, y, 22, 4);
        ctx.fillRect(x + 18, y + 4, 26, 4);
        ctx.fillRect(x + 18, y + 8, 26, 4);

        // Eye (white pixel) - only if alive
        if (this.isAlive) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(x + 32, y + 6, 4, 4);
            ctx.fillStyle = color;
        }

        // Mouth area
        ctx.fillRect(x + 18, y + 12, 26, 4);
        ctx.fillRect(x + 30, y + 16, 14, 3);

        // Neck
        ctx.fillRect(x + 14, y + 16, 16, 4);

        // Body
        ctx.fillRect(x + 6, y + 20, 28, 4);
        ctx.fillRect(x + 2, y + 24, 32, 4);
        ctx.fillRect(x + 2, y + 28, 28, 4);
        ctx.fillRect(x + 6, y + 32, 20, 4);

        // Arm
        ctx.fillRect(x + 26, y + 24, 4, 8);
        ctx.fillRect(x + 28, y + 28, 4, 4);

        // Tail
        ctx.fillRect(x, y + 24, 4, 4);
        ctx.fillRect(x - 4, y + 20, 6, 4);
        ctx.fillRect(x - 8, y + 16, 6, 4);

        // Legs (animated)
        if (frame === 0) {
            ctx.fillRect(x + 8, y + 36, 4, 8);
            ctx.fillRect(x + 6, y + 42, 6, 5);
            ctx.fillRect(x + 20, y + 36, 4, 6);
            ctx.fillRect(x + 18, y + 40, 6, 4);
        } else {
            ctx.fillRect(x + 8, y + 36, 4, 6);
            ctx.fillRect(x + 6, y + 40, 6, 4);
            ctx.fillRect(x + 20, y + 36, 4, 8);
            ctx.fillRect(x + 18, y + 42, 6, 5);
        }
    }

    drawJumpingDino(ctx, x, y, color) {
        ctx.fillStyle = color;

        // Head
        ctx.fillRect(x + 22, y, 22, 4);
        ctx.fillRect(x + 18, y + 4, 26, 4);
        ctx.fillRect(x + 18, y + 8, 26, 4);

        // Eye - only if alive
        if (this.isAlive) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(x + 32, y + 6, 4, 4);
            ctx.fillStyle = color;
        }

        // Mouth
        ctx.fillRect(x + 18, y + 12, 26, 4);
        ctx.fillRect(x + 30, y + 16, 14, 3);

        // Neck
        ctx.fillRect(x + 14, y + 16, 16, 4);

        // Body
        ctx.fillRect(x + 6, y + 20, 28, 4);
        ctx.fillRect(x + 2, y + 24, 32, 4);
        ctx.fillRect(x + 2, y + 28, 28, 4);
        ctx.fillRect(x + 6, y + 32, 20, 4);

        // Arm
        ctx.fillRect(x + 26, y + 24, 4, 8);
        ctx.fillRect(x + 28, y + 28, 4, 4);

        // Tail
        ctx.fillRect(x, y + 24, 4, 4);
        ctx.fillRect(x - 4, y + 20, 6, 4);
        ctx.fillRect(x - 8, y + 16, 6, 4);

        // Legs tucked
        ctx.fillRect(x + 8, y + 36, 4, 4);
        ctx.fillRect(x + 10, y + 38, 6, 4);
        ctx.fillRect(x + 20, y + 36, 4, 4);
        ctx.fillRect(x + 22, y + 38, 6, 4);
    }

    drawDeadEyes(ctx, x, y) {
        // Draw X eyes when dead
        ctx.fillStyle = '#ff0000';
        // X shape for eye
        ctx.fillRect(x + 32, y + 6, 2, 2);
        ctx.fillRect(x + 34, y + 8, 2, 2);
        ctx.fillRect(x + 34, y + 6, 2, 2);
        ctx.fillRect(x + 32, y + 8, 2, 2);
    }

    die() {
        this.isAlive = false;
    }

    getHitbox() {
        return {
            x: this.x + 5,
            y: this.y + 5,
            width: this.width - 10,
            height: this.height - 10
        };
    }

    reset() {
        this.y = this.groundY;
        this.velocityY = 0;
        this.isJumping = false;
        this.isAlive = true;
        this.animationFrame = 0;
        this.animationTimer = 0;
    }
}
