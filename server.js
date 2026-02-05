const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Handle room URLs - serve index.html for /room/:roomId
app.get('/room/:roomId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// In-memory room storage
const rooms = new Map();

// Player colors
// 20 distinct player colors
const PLAYER_COLORS = [
    '#2196F3', // Blue
    '#FF9800', // Orange
    '#4CAF50', // Green
    '#9C27B0', // Purple
    '#F44336', // Red
    '#00BCD4', // Cyan
    '#E91E63', // Pink
    '#CDDC39', // Lime
    '#795548', // Brown
    '#607D8B', // Blue Grey
    '#FF5722', // Deep Orange
    '#3F51B5', // Indigo
    '#009688', // Teal
    '#FFC107', // Amber
    '#673AB7', // Deep Purple
    '#8BC34A', // Light Green
    '#03A9F4', // Light Blue
    '#FFEB3B', // Yellow
    '#FF4081', // Pink Accent
    '#00E676'  // Green Accent
];

// Level configurations
const LEVEL_CONFIG = {
    1: { speed: 3, cacti: 15 },
    2: { speed: 4.5, cacti: 20 },
    3: { speed: 6, cacti: 25 },
    4: { speed: 7.5, cacti: 30 },
    5: { speed: 9, cacti: 35 }
};

// Cactus types
const CACTUS_TYPES = [
    { width: 17, height: 35, type: 'small' },
    { width: 25, height: 50, type: 'tall' },
    { width: 40, height: 35, type: 'double' }
];

// Generate random room ID
function generateRoomId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Generate unique player ID
function generatePlayerId() {
    return 'p_' + Math.random().toString(36).substr(2, 9);
}

// Create a new room
function createRoom(hostId, hostName, hostWs) {
    let roomId;
    do {
        roomId = generateRoomId();
    } while (rooms.has(roomId));

    const room = {
        id: roomId,
        hostId: hostId,
        state: 'lobby',
        difficulty: 1,
        players: new Map(),
        gameState: {
            startTime: null,
            elapsedTime: 0,
            cacti: [],
            lastCactusSpawn: 0,
            spawnedCactiCount: 0
        },
        config: { ...LEVEL_CONFIG[1], levelTime: 60 },
        gameLoop: null
    };

    // Add host as first player
    room.players.set(hostId, {
        id: hostId,
        name: hostName,
        ws: hostWs,
        lane: 0,
        groundY: 80,
        y: 80 - 47, // groundY - dino height
        velocityY: 0,
        isJumping: false,
        isAlive: true,
        score: 0,
        isReady: true,
        color: PLAYER_COLORS[0]
    });

    rooms.set(roomId, room);
    return room;
}

// Calculate lane positions based on player count
// Lane height of 160px accommodates jump height (~140px)
// Start Y of 160 gives room for first player to jump without going off-canvas
function calculateLanePositions(playerCount) {
    const laneHeight = 160;
    const startY = 160;
    const positions = [];
    for (let i = 0; i < playerCount; i++) {
        positions.push(startY + (i * laneHeight));
    }
    return positions;
}

// Update player lanes when players join/leave
function updatePlayerLanes(room) {
    const positions = calculateLanePositions(room.players.size);
    let index = 0;
    for (const player of room.players.values()) {
        player.lane = index;
        player.groundY = positions[index];
        player.y = positions[index] - 47;
        player.color = PLAYER_COLORS[index];
        index++;
    }
}

// Broadcast message to all players in a room
function broadcastToRoom(room, message, excludePlayerId = null) {
    const data = JSON.stringify(message);
    for (const player of room.players.values()) {
        if (player.id !== excludePlayerId && player.ws.readyState === WebSocket.OPEN) {
            player.ws.send(data);
        }
    }
}

// Send message to specific player
function sendToPlayer(player, message) {
    if (player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(JSON.stringify(message));
    }
}

// Get player list for lobby
function getPlayerList(room) {
    return Array.from(room.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        lane: p.lane,
        color: p.color,
        isReady: p.isReady,
        isHost: p.id === room.hostId
    }));
}

// Physics constants
const GRAVITY = 0.8;
const JUMP_FORCE = -15;
const DINO_WIDTH = 44;
const DINO_HEIGHT = 47;

// Game loop tick (runs on server at 30fps)
function gameTick(room) {
    if (room.state !== 'playing') return;

    const config = room.config;
    const now = Date.now();
    const deltaTime = 1000 / 30; // 30fps

    room.gameState.elapsedTime += deltaTime / 1000;

    // Check if time is up
    if (room.gameState.elapsedTime >= config.levelTime) {
        endGame(room);
        return;
    }

    // Update each player's physics
    for (const player of room.players.values()) {
        if (!player.isAlive) continue;

        if (player.isJumping) {
            player.velocityY += GRAVITY;
            player.y += player.velocityY;

            // Land on ground
            const groundY = player.groundY - DINO_HEIGHT;
            if (player.y >= groundY) {
                player.y = groundY;
                player.velocityY = 0;
                player.isJumping = false;
            }
        }
    }

    // Update cacti positions
    for (let i = room.gameState.cacti.length - 1; i >= 0; i--) {
        room.gameState.cacti[i].x -= config.speed;

        // Remove off-screen cacti
        if (room.gameState.cacti[i].x < -50) {
            room.gameState.cacti.splice(i, 1);
        }
    }

    // Spawn new cacti
    const minGap = getMinGap(config.speed, room.difficulty);
    const lastCactus = room.gameState.cacti[room.gameState.cacti.length - 1];
    const distanceFromLast = lastCactus ? 800 + 50 - lastCactus.x : 1000;

    if (distanceFromLast >= minGap &&
        room.gameState.spawnedCactiCount < config.cacti &&
        Math.random() < 0.3) {
        spawnCactus(room);
    }

    // Check collisions and scoring for each player
    for (const player of room.players.values()) {
        if (!player.isAlive) continue;

        const playerBox = {
            x: 50 + 5,
            y: player.y + 5,
            width: DINO_WIDTH - 10,
            height: DINO_HEIGHT - 10
        };

        for (const cactus of room.gameState.cacti) {
            // Check collision
            const cactusBox = {
                x: cactus.x + 3,
                y: player.groundY - cactus.height + 3,
                width: cactus.width - 6,
                height: cactus.height - 6
            };

            if (playerBox.x < cactusBox.x + cactusBox.width &&
                playerBox.x + playerBox.width > cactusBox.x &&
                playerBox.y < cactusBox.y + cactusBox.height &&
                playerBox.y + playerBox.height > cactusBox.y) {

                player.isAlive = false;
                broadcastToRoom(room, { type: 'playerDied', playerId: player.id });
            }

            // Check scoring
            const passKey = `passed_${player.id}`;
            if (!cactus[passKey] && cactus.x + cactus.width < 50) {
                cactus[passKey] = true;
                player.score += 10;
            }
        }
    }

    // Check if all players are dead
    const alivePlayers = Array.from(room.players.values()).filter(p => p.isAlive);
    if (alivePlayers.length === 0) {
        endGame(room);
        return;
    }

    // Broadcast game state
    broadcastGameState(room);
}

function getMinGap(speed, level) {
    const jumpDuration = 0.6;
    const safetyMargin = Math.max(1.15, 1.5 - (level - 1) * 0.1);
    return (speed * 60 * jumpDuration + DINO_WIDTH + 40) * safetyMargin;
}

function spawnCactus(room) {
    const type = CACTUS_TYPES[Math.floor(Math.random() * CACTUS_TYPES.length)];
    room.gameState.cacti.push({
        x: 850,
        width: type.width,
        height: type.height,
        type: type.type
    });
    room.gameState.spawnedCactiCount++;
}

function broadcastGameState(room) {
    const players = Array.from(room.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        lane: p.lane,
        y: p.y,
        groundY: p.groundY,
        isJumping: p.isJumping,
        isAlive: p.isAlive,
        score: p.score,
        color: p.color
    }));

    broadcastToRoom(room, {
        type: 'gameState',
        elapsedTime: room.gameState.elapsedTime,
        players: players,
        cacti: room.gameState.cacti
    });
}

function startGame(room) {
    room.state = 'playing';
    room.config = { ...LEVEL_CONFIG[room.difficulty], levelTime: 60 };
    room.gameState = {
        startTime: Date.now(),
        elapsedTime: 0,
        cacti: [],
        spawnedCactiCount: 0
    };

    // Reset all players
    for (const player of room.players.values()) {
        player.y = player.groundY - DINO_HEIGHT;
        player.velocityY = 0;
        player.isJumping = false;
        player.isAlive = true;
        player.score = 0;
    }

    broadcastToRoom(room, {
        type: 'gameStart',
        config: room.config,
        players: getPlayerList(room)
    });

    // Start game loop at 30fps
    room.gameLoop = setInterval(() => gameTick(room), 1000 / 30);
}

function endGame(room) {
    room.state = 'gameover';

    if (room.gameLoop) {
        clearInterval(room.gameLoop);
        room.gameLoop = null;
    }

    // Sort players by score
    const rankings = Array.from(room.players.values())
        .map(p => ({ id: p.id, name: p.name, score: p.score, color: p.color }))
        .sort((a, b) => b.score - a.score);

    broadcastToRoom(room, {
        type: 'gameOver',
        rankings: rankings
    });
}

function cleanupRoom(roomId) {
    const room = rooms.get(roomId);
    if (room) {
        if (room.gameLoop) {
            clearInterval(room.gameLoop);
        }
        rooms.delete(roomId);
    }
}

// WebSocket connection handler
wss.on('connection', (ws) => {
    let playerId = null;
    let currentRoomId = null;

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            handleMessage(ws, message);
        } catch (e) {
            console.error('Error handling message:', e);
        }
    });

    ws.on('close', () => {
        if (currentRoomId && playerId) {
            const room = rooms.get(currentRoomId);
            if (room) {
                room.players.delete(playerId);

                if (playerId === room.hostId) {
                    // Host left - close room
                    broadcastToRoom(room, { type: 'roomClosed', reason: 'Host left' });
                    cleanupRoom(currentRoomId);
                } else if (room.players.size > 0) {
                    // Regular player left
                    updatePlayerLanes(room);
                    broadcastToRoom(room, {
                        type: 'playerLeft',
                        playerId: playerId,
                        players: getPlayerList(room)
                    });
                } else {
                    // No players left
                    cleanupRoom(currentRoomId);
                }
            }
        }
    });

    function handleMessage(ws, message) {
        switch (message.type) {
            case 'createRoom': {
                playerId = generatePlayerId();
                const room = createRoom(playerId, message.name || 'Host', ws);
                currentRoomId = room.id;

                sendToPlayer({ ws }, {
                    type: 'roomCreated',
                    roomId: room.id,
                    playerId: playerId,
                    players: getPlayerList(room)
                });
                break;
            }

            case 'joinRoom': {
                const room = rooms.get(message.roomId.toUpperCase());
                if (!room) {
                    sendToPlayer({ ws }, { type: 'error', message: 'Room not found' });
                    return;
                }
                if (room.state !== 'lobby') {
                    sendToPlayer({ ws }, { type: 'error', message: 'Game already in progress' });
                    return;
                }
                if (room.players.size >= 20) {
                    sendToPlayer({ ws }, { type: 'error', message: 'Room is full (max 20 players)' });
                    return;
                }

                playerId = generatePlayerId();
                currentRoomId = room.id;
                const laneIndex = room.players.size;
                const positions = calculateLanePositions(laneIndex + 1);

                room.players.set(playerId, {
                    id: playerId,
                    name: message.name || `Player${laneIndex + 1}`,
                    ws: ws,
                    lane: laneIndex,
                    groundY: positions[laneIndex],
                    y: positions[laneIndex] - DINO_HEIGHT,
                    velocityY: 0,
                    isJumping: false,
                    isAlive: true,
                    score: 0,
                    isReady: false,
                    color: PLAYER_COLORS[laneIndex]
                });

                updatePlayerLanes(room);

                sendToPlayer({ ws }, {
                    type: 'joinedRoom',
                    roomId: room.id,
                    playerId: playerId,
                    players: getPlayerList(room),
                    isHost: false,
                    difficulty: room.difficulty
                });

                broadcastToRoom(room, {
                    type: 'playerJoined',
                    players: getPlayerList(room)
                }, playerId);
                break;
            }

            case 'ready': {
                const room = rooms.get(currentRoomId);
                if (!room) return;

                const player = room.players.get(playerId);
                if (player) {
                    player.isReady = !player.isReady;
                    broadcastToRoom(room, {
                        type: 'lobbyUpdate',
                        players: getPlayerList(room),
                        difficulty: room.difficulty
                    });
                }
                break;
            }

            case 'setDifficulty': {
                const room = rooms.get(currentRoomId);
                if (!room || playerId !== room.hostId) return;

                room.difficulty = Math.min(5, Math.max(1, message.level));
                broadcastToRoom(room, {
                    type: 'lobbyUpdate',
                    players: getPlayerList(room),
                    difficulty: room.difficulty
                });
                break;
            }

            case 'kickPlayer': {
                const room = rooms.get(currentRoomId);
                if (!room || playerId !== room.hostId) return;

                const targetPlayer = room.players.get(message.playerId);
                if (targetPlayer && message.playerId !== room.hostId) {
                    sendToPlayer(targetPlayer, { type: 'kicked' });
                    targetPlayer.ws.close();
                    room.players.delete(message.playerId);
                    updatePlayerLanes(room);
                    broadcastToRoom(room, {
                        type: 'playerLeft',
                        playerId: message.playerId,
                        players: getPlayerList(room)
                    });
                }
                break;
            }

            case 'startGame': {
                const room = rooms.get(currentRoomId);
                if (!room || playerId !== room.hostId) return;
                if (room.players.size < 2) {
                    sendToPlayer({ ws }, { type: 'error', message: 'Need at least 2 players' });
                    return;
                }

                startGame(room);
                break;
            }

            case 'jump': {
                const room = rooms.get(currentRoomId);
                if (!room || room.state !== 'playing') return;

                const player = room.players.get(playerId);
                if (player && player.isAlive && !player.isJumping) {
                    player.velocityY = JUMP_FORCE;
                    player.isJumping = true;
                }
                break;
            }

            case 'restartGame': {
                const room = rooms.get(currentRoomId);
                if (!room || playerId !== room.hostId) return;

                room.state = 'lobby';
                for (const player of room.players.values()) {
                    player.isReady = player.id === room.hostId;
                }

                broadcastToRoom(room, {
                    type: 'returnToLobby',
                    players: getPlayerList(room),
                    difficulty: room.difficulty
                });
                break;
            }

            case 'leaveRoom': {
                const room = rooms.get(currentRoomId);
                if (room) {
                    room.players.delete(playerId);
                    if (playerId === room.hostId) {
                        broadcastToRoom(room, { type: 'roomClosed', reason: 'Host left' });
                        cleanupRoom(currentRoomId);
                    } else if (room.players.size > 0) {
                        updatePlayerLanes(room);
                        broadcastToRoom(room, {
                            type: 'playerLeft',
                            playerId: playerId,
                            players: getPlayerList(room)
                        });
                    }
                }
                currentRoomId = null;
                playerId = null;
                break;
            }
        }
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Dino Jump server running on http://localhost:${PORT}`);
});
