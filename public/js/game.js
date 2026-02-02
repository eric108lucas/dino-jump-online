// Main Game Class
class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.ctx.imageSmoothingEnabled = false;

        // Mobile detection
        this.isMobile = window.innerWidth <= 850 || 'ontouchstart' in window;
        this.mobileTapArea = document.getElementById('mobile-tap-area');

        // Game mode: 'single', 'two-player', or 'online'
        this.gameMode = null;

        // Single player objects (initialized on mode select)
        this.ground = null;
        this.dino = null;
        this.cactusManager = null;

        // Two player objects
        this.multiGround = null;
        this.dinos = [];
        this.multiCactusManager = null;
        this.scores = [0, 0];

        // Lane configurations for two-player mode
        this.laneConfigs = [
            { groundY: 140, color: '#2196F3', playerId: 1 }, // Blue - top lane
            { groundY: 290, color: '#FF9800', playerId: 2 }  // Orange - bottom lane
        ];

        // Online mode
        this.onlineManager = new OnlineManager(this);
        this.onlinePlayers = [];
        this.onlinePlayerId = null;
        this.onlineCacti = [];
        this.onlineElapsedTime = 0;
        this.onlineConfig = null;

        // Game state
        this.state = 'start';
        this.score = 0;
        this.level = 1;
        this.levelTime = 60;
        this.elapsedTime = 0;
        this.lastTimestamp = 0;

        // Level configuration
        this.levelConfig = {
            1: { speed: 3, cacti: 15 },
            2: { speed: 4.5, cacti: 20 },
            3: { speed: 6, cacti: 25 },
            4: { speed: 7.5, cacti: 30 },
            5: { speed: 9, cacti: 35 }
        };

        // UI elements
        this.screens = {
            start: document.getElementById('start-screen'),
            offline: document.getElementById('offline-screen'),
            onlineMenu: document.getElementById('online-menu-screen'),
            connecting: document.getElementById('connecting-screen'),
            lobby: document.getElementById('lobby-screen'),
            gameover: document.getElementById('gameover-screen'),
            twoplayerGameover: document.getElementById('twoplayer-gameover-screen'),
            onlineGameover: document.getElementById('online-gameover-screen'),
            disconnected: document.getElementById('disconnected-screen'),
            levelcomplete: document.getElementById('levelcomplete-screen'),
            ranking: document.getElementById('ranking-screen')
        };

        this.displays = {
            level: document.getElementById('level-display'),
            score: document.getElementById('score-display'),
            p1Score: document.getElementById('p1-score-display'),
            p2Score: document.getElementById('p2-score-display'),
            time: document.getElementById('time-display'),
            room: document.getElementById('room-display'),
            gameoverScore: document.getElementById('gameover-score'),
            levelCompleteMsg: document.getElementById('level-complete-msg'),
            levelScore: document.getElementById('level-score'),
            winnerText: document.getElementById('winner-text'),
            p1FinalScore: document.getElementById('p1-final-score'),
            p2FinalScore: document.getElementById('p2-final-score')
        };

        this.bindEvents();
        this.checkRoomUrl();
        this.setupMobile();

        // Start game loop
        this.gameLoop = this.gameLoop.bind(this);
        requestAnimationFrame(this.gameLoop);
    }

    setupMobile() {
        // Update mobile detection on resize
        window.addEventListener('resize', () => {
            this.isMobile = window.innerWidth <= 850 || 'ontouchstart' in window;
            this.updateOverlaySize();
        });

        // Initial overlay size update
        this.updateOverlaySize();
    }

    updateOverlaySize() {
        const overlay = document.getElementById('overlay');
        if (this.isMobile) {
            // Get the actual rendered height of the canvas
            const canvasRect = this.canvas.getBoundingClientRect();
            overlay.style.height = canvasRect.height + 'px';
            overlay.style.top = document.getElementById('hud').offsetHeight + 'px';
        }
    }

    showMobileTapArea() {
        if (this.isMobile && this.mobileTapArea) {
            this.mobileTapArea.classList.remove('hidden');
        }
    }

    hideMobileTapArea() {
        if (this.mobileTapArea) {
            this.mobileTapArea.classList.add('hidden');
        }
    }

    checkRoomUrl() {
        // Check if URL contains room code
        const path = window.location.pathname;
        const match = path.match(/\/room\/([A-Z0-9]{6})/i);
        if (match) {
            const roomCode = match[1].toUpperCase();
            document.getElementById('room-code-input').value = roomCode;
            this.showOnlineMenu();
        }
    }

    bindEvents() {
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.handleInput('space');
            } else if (e.code === 'ArrowUp') {
                e.preventDefault();
                this.handleInput('up');
            } else if (e.code === 'Digit1' || e.code === 'Numpad1') {
                e.preventDefault();
                if (this.state === 'offline-select') {
                    this.selectMode('single');
                }
            } else if (e.code === 'Digit2' || e.code === 'Numpad2') {
                e.preventDefault();
                if (this.state === 'offline-select') {
                    this.selectMode('two-player');
                }
            }
        });

        // Touch/click controls
        this.canvas.addEventListener('click', () => this.handleInput('click'));
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handleInput('touch');
        });

        // Mobile tap area
        if (this.mobileTapArea) {
            this.mobileTapArea.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.handleInput('touch');
            });
            this.mobileTapArea.addEventListener('click', () => this.handleInput('click'));
        }

        // Main menu buttons
        document.getElementById('online-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.showOnlineMenu();
        });

        document.getElementById('offline-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.showOfflineMenu();
        });

        // Offline mode buttons
        document.getElementById('single-player-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectMode('single');
        });

        document.getElementById('two-player-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectMode('two-player');
        });

        document.getElementById('offline-back-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.returnToMainMenu();
        });

        // Online menu buttons
        document.getElementById('create-room-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.createRoom();
        });

        document.getElementById('join-room-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.joinRoom();
        });

        document.getElementById('online-back-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.returnToMainMenu();
        });

        // Room code input - auto uppercase
        document.getElementById('room-code-input').addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });

        // Lobby buttons
        document.getElementById('copy-link-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.copyRoomLink();
        });

        document.getElementById('ready-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleReady();
        });

        document.getElementById('start-game-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.onlineManager.startGame();
        });

        document.getElementById('leave-room-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.leaveRoom();
        });

        // Difficulty buttons
        document.querySelectorAll('.diff-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const level = parseInt(btn.dataset.level);
                this.onlineManager.setDifficulty(level);
            });
        });

        // Online game over buttons
        document.getElementById('restart-online-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.onlineManager.restart();
        });

        document.getElementById('return-lobby-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.onlineManager.restart();
        });

        // Disconnected screen
        document.getElementById('reconnect-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.returnToMainMenu();
        });

        // Click on overlay screens
        document.getElementById('overlay').addEventListener('click', (e) => {
            if (e.target.id !== 'ranking-btn' &&
                e.target.id !== 'ranking-close-btn' &&
                !e.target.classList.contains('mode-btn') &&
                !e.target.classList.contains('back-btn') &&
                !e.target.classList.contains('copy-btn') &&
                !e.target.classList.contains('diff-btn') &&
                !e.target.classList.contains('kick-btn') &&
                !document.getElementById('ranking-screen').contains(e.target) &&
                !document.getElementById('lobby-screen').contains(e.target) &&
                !document.getElementById('online-menu-screen').contains(e.target) &&
                !document.getElementById('online-gameover-screen').contains(e.target)) {
                this.handleInput('click');
            }
        });

        // Ranking button
        document.getElementById('ranking-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.showRanking();
        });

        // Ranking close button
        document.getElementById('ranking-close-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.hideRanking();
        });
    }

    showOnlineMenu() {
        this.state = 'online-menu';
        this.showScreen('onlineMenu');
    }

    showOfflineMenu() {
        this.state = 'offline-select';
        this.showScreen('offline');
    }

    returnToMainMenu() {
        this.state = 'start';
        this.gameMode = null;

        // Disconnect from online if connected
        if (this.onlineManager.connected) {
            this.onlineManager.disconnect();
        }

        // Reset canvas to default
        this.canvas.height = 300;
        document.getElementById('overlay').classList.remove('two-player-overlay', 'online-overlay');

        // Show default HUD
        this.displays.level.classList.remove('hidden');
        this.displays.score.classList.remove('hidden');
        this.displays.p1Score.classList.add('hidden');
        this.displays.p2Score.classList.add('hidden');
        this.displays.room.classList.add('hidden');
        document.getElementById('ranking-btn').classList.remove('hidden');

        // Clear URL if on room page
        if (window.location.pathname.includes('/room/')) {
            window.history.pushState({}, '', '/');
        }

        this.hideMobileTapArea();
        this.showScreen('start');

        // Update overlay size
        setTimeout(() => this.updateOverlaySize(), 50);
    }

    async createRoom() {
        const name = document.getElementById('player-name').value.trim() || 'Host';

        this.showScreen('connecting');

        try {
            await this.onlineManager.connect();
            this.onlineManager.createRoom(name);
        } catch (error) {
            alert('Failed to connect to server');
            this.showScreen('onlineMenu');
        }
    }

    async joinRoom() {
        const name = document.getElementById('player-name').value.trim() || 'Player';
        const roomCode = document.getElementById('room-code-input').value.trim().toUpperCase();

        if (!roomCode || roomCode.length !== 6) {
            alert('Please enter a valid 6-character room code');
            return;
        }

        this.showScreen('connecting');

        try {
            await this.onlineManager.connect();
            this.onlineManager.joinRoom(roomCode, name);
        } catch (error) {
            alert('Failed to connect to server');
            this.showScreen('onlineMenu');
        }
    }

    showLobby(roomId, players, isHost, difficulty) {
        this.state = 'lobby';
        this.gameMode = 'online';

        // Update URL
        window.history.pushState({}, '', `/room/${roomId}`);

        document.getElementById('lobby-room-code').textContent = `Room: ${roomId}`;

        // Set host status
        const lobbyScreen = document.getElementById('lobby-screen');
        if (isHost) {
            lobbyScreen.classList.remove('not-host');
            document.getElementById('ready-btn').classList.add('hidden');
            document.getElementById('start-game-btn').classList.remove('hidden');
        } else {
            lobbyScreen.classList.add('not-host');
            document.getElementById('ready-btn').classList.remove('hidden');
            document.getElementById('start-game-btn').classList.add('hidden');
        }

        this.updateLobby(players, isHost, difficulty);
        this.showScreen('lobby');
    }

    updateLobby(players, isHost, difficulty) {
        const playersContainer = document.getElementById('lobby-players');
        playersContainer.innerHTML = '';

        players.forEach(player => {
            const playerEl = document.createElement('div');
            playerEl.className = 'lobby-player';

            const isMe = player.id === this.onlineManager.playerId;

            playerEl.innerHTML = `
                <div class="player-info">
                    <div class="player-color" style="background-color: ${player.color}"></div>
                    <span class="player-name">${player.name}${isMe ? ' (You)' : ''}</span>
                    ${player.isHost ? '<span class="player-host">(Host)</span>' : ''}
                </div>
                <span class="player-status ${player.isReady ? 'ready' : 'waiting'}">
                    ${player.isReady ? 'Ready' : 'Waiting'}
                </span>
                ${isHost && !player.isHost ? `<button class="kick-btn" data-player-id="${player.id}">Kick</button>` : ''}
            `;

            playersContainer.appendChild(playerEl);
        });

        // Add kick button listeners
        playersContainer.querySelectorAll('.kick-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.onlineManager.kickPlayer(btn.dataset.playerId);
            });
        });

        // Update difficulty buttons
        document.querySelectorAll('.diff-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.level) === difficulty);
            btn.disabled = !isHost;
        });

        // Update ready button state
        const myPlayer = players.find(p => p.id === this.onlineManager.playerId);
        if (myPlayer) {
            const readyBtn = document.getElementById('ready-btn');
            readyBtn.classList.toggle('is-ready', myPlayer.isReady);
            readyBtn.textContent = myPlayer.isReady ? 'NOT READY' : 'READY';
        }

        // Update start button state (need at least 2 players)
        const startBtn = document.getElementById('start-game-btn');
        startBtn.disabled = players.length < 2;

        // Update status text
        const allReady = players.filter(p => !p.isHost).every(p => p.isReady);
        const statusText = document.getElementById('lobby-status');
        if (players.length < 2) {
            statusText.textContent = 'Waiting for more players...';
        } else if (!allReady) {
            statusText.textContent = 'Waiting for players to ready up...';
        } else {
            statusText.textContent = isHost ? 'All players ready! Click START GAME' : 'Waiting for host to start...';
        }
    }

    copyRoomLink() {
        const roomId = this.onlineManager.roomId;
        const url = `${window.location.origin}/room/${roomId}`;

        navigator.clipboard.writeText(url).then(() => {
            const btn = document.getElementById('copy-link-btn');
            btn.textContent = 'Copied!';
            setTimeout(() => {
                btn.textContent = 'Copy Link';
            }, 2000);
        });
    }

    toggleReady() {
        this.onlineManager.toggleReady();
    }

    leaveRoom() {
        this.onlineManager.leave();
        this.returnToMainMenu();
    }

    startOnlineGame(config, players, myPlayerId) {
        this.state = 'playing';
        this.gameMode = 'online';
        this.onlineConfig = config;
        this.onlinePlayerId = myPlayerId;
        this.onlinePlayers = players;
        this.onlineCacti = [];
        this.onlineElapsedTime = 0;

        // Calculate canvas height based on player count
        const canvasHeight = 80 + (players.length * 120);
        this.canvas.height = canvasHeight;

        // Update overlay height
        const overlay = document.getElementById('overlay');
        overlay.classList.remove('two-player-overlay');
        overlay.classList.add('online-overlay');
        overlay.style.setProperty('--overlay-height', canvasHeight + 'px');

        // Update HUD
        this.displays.level.classList.add('hidden');
        this.displays.score.classList.add('hidden');
        this.displays.p1Score.classList.add('hidden');
        this.displays.p2Score.classList.add('hidden');
        this.displays.room.classList.remove('hidden');
        this.displays.room.textContent = `Room: ${this.onlineManager.roomId}`;
        document.getElementById('ranking-btn').classList.add('hidden');

        // Create ground for online mode
        const laneConfigs = players.map((p, i) => ({
            groundY: 80 + (i * 120),
            color: p.color,
            playerId: p.id
        }));
        this.multiGround = new MultiLaneGround(this.canvas, this.ctx, laneConfigs);

        this.hideAllScreens();
        this.showMobileTapArea();

        // Update overlay size for mobile
        setTimeout(() => this.updateOverlaySize(), 50);
    }

    updateOnlineGameState(state) {
        if (this.gameMode !== 'online' || this.state !== 'playing') return;

        this.onlinePlayers = state.players;
        this.onlineCacti = state.cacti;
        this.onlineElapsedTime = state.elapsedTime;

        // Update time display
        const remainingTime = Math.max(0, this.onlineConfig.levelTime - state.elapsedTime);
        const minutes = Math.floor(remainingTime / 60);
        const seconds = Math.floor(remainingTime % 60);
        this.displays.time.textContent = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    handlePlayerDied(playerId) {
        // Play death sound if it's not this player
        if (playerId !== this.onlinePlayerId) {
            soundManager.playGameOver();
        }
    }

    showOnlineGameOver(rankings) {
        this.state = 'online-gameover';

        const rankingsContainer = document.getElementById('online-rankings');
        rankingsContainer.innerHTML = '';

        rankings.forEach((player, index) => {
            const isMe = player.id === this.onlinePlayerId;
            const rankEl = document.createElement('div');
            rankEl.className = `online-rank-item ${index === 0 ? 'first-place' : ''} ${isMe ? 'you' : ''}`;

            rankEl.innerHTML = `
                <span class="rank-position">#${index + 1}</span>
                <div class="rank-player-info">
                    <div class="rank-color" style="background-color: ${player.color}"></div>
                    <span class="rank-name">${player.name}${isMe ? ' (You)' : ''}</span>
                </div>
                <span class="rank-score">${player.score}</span>
            `;

            rankingsContainer.appendChild(rankEl);
        });

        // Show/hide host controls
        const gameoverScreen = document.getElementById('online-gameover-screen');
        if (this.onlineManager.isHost) {
            gameoverScreen.classList.remove('not-host');
        } else {
            gameoverScreen.classList.add('not-host');
        }

        this.hideMobileTapArea();
        this.showScreen('onlineGameover');
    }

    showDisconnectedScreen() {
        this.state = 'disconnected';
        this.hideMobileTapArea();
        this.showScreen('disconnected');
    }

    selectMode(mode) {
        soundManager.init();
        this.gameMode = mode;

        if (mode === 'single') {
            this.initSinglePlayer();
        } else {
            this.initTwoPlayer();
        }

        this.startGame();
    }

    initSinglePlayer() {
        // Reset canvas to single player size
        this.canvas.height = 300;
        document.getElementById('overlay').classList.remove('two-player-overlay', 'online-overlay');

        // Show single player HUD elements
        this.displays.level.classList.remove('hidden');
        this.displays.score.classList.remove('hidden');
        this.displays.p1Score.classList.add('hidden');
        this.displays.p2Score.classList.add('hidden');
        this.displays.room.classList.add('hidden');
        document.getElementById('ranking-btn').classList.remove('hidden');

        // Create single player objects
        this.ground = new Ground(this.canvas, this.ctx, 250);
        this.dino = new Dino(this.canvas, this.ctx, { groundY: 250 });
        this.cactusManager = new CactusManager(this.canvas, this.ctx, 250);

        this.score = 0;
        this.level = 1;
    }

    initTwoPlayer() {
        // Set canvas to two player size
        this.canvas.height = 400;
        document.getElementById('overlay').classList.add('two-player-overlay');
        document.getElementById('overlay').classList.remove('online-overlay');

        // Show two player HUD elements
        this.displays.level.classList.add('hidden');
        this.displays.score.classList.add('hidden');
        this.displays.p1Score.classList.remove('hidden');
        this.displays.p2Score.classList.remove('hidden');
        this.displays.room.classList.add('hidden');
        document.getElementById('ranking-btn').classList.add('hidden');

        // Create two player objects
        this.multiGround = new MultiLaneGround(this.canvas, this.ctx, this.laneConfigs);

        this.dinos = [
            new Dino(this.canvas, this.ctx, {
                playerId: 1,
                color: this.laneConfigs[0].color,
                groundY: this.laneConfigs[0].groundY
            }),
            new Dino(this.canvas, this.ctx, {
                playerId: 2,
                color: this.laneConfigs[1].color,
                groundY: this.laneConfigs[1].groundY
            })
        ];

        this.multiCactusManager = new MultiLaneCactusManager(
            this.canvas, this.ctx, this.laneConfigs
        );

        this.scores = [0, 0];
        this.level = 1; // Two player uses level 1 difficulty
    }

    handleInput(inputType) {
        soundManager.init();

        switch (this.state) {
            case 'start':
            case 'offline-select':
            case 'online-menu':
            case 'lobby':
                // Mode selection handled by buttons
                break;

            case 'playing':
                if (this.gameMode === 'single') {
                    this.dino.jump();
                } else if (this.gameMode === 'two-player') {
                    // Two player controls
                    if (inputType === 'space') {
                        this.dinos[0].jump(); // Player 1
                    } else if (inputType === 'up') {
                        this.dinos[1].jump(); // Player 2
                    } else if (inputType === 'click' || inputType === 'touch') {
                        // Click/touch makes both jump (for testing)
                        this.dinos[0].jump();
                        this.dinos[1].jump();
                    }
                } else if (this.gameMode === 'online') {
                    // Online mode - send jump to server
                    if (inputType === 'space' || inputType === 'up' || inputType === 'click' || inputType === 'touch') {
                        this.onlineManager.jump();
                    }
                }
                break;

            case 'gameover':
            case 'twoplayer-gameover':
                this.returnToStart();
                break;

            case 'levelcomplete':
                this.nextLevel();
                break;
        }
    }

    startGame() {
        this.state = 'playing';
        this.elapsedTime = 0;
        this.lastTimestamp = performance.now();
        this.hideAllScreens();
        this.showMobileTapArea();

        // Update overlay size after canvas height might have changed
        setTimeout(() => this.updateOverlaySize(), 50);
    }

    returnToStart() {
        this.state = 'start';
        this.gameMode = null;

        // Reset canvas to default
        this.canvas.height = 300;
        document.getElementById('overlay').classList.remove('two-player-overlay', 'online-overlay');

        // Show default HUD
        this.displays.level.classList.remove('hidden');
        this.displays.score.classList.remove('hidden');
        this.displays.p1Score.classList.add('hidden');
        this.displays.p2Score.classList.add('hidden');
        this.displays.room.classList.add('hidden');
        document.getElementById('ranking-btn').classList.remove('hidden');

        this.hideMobileTapArea();
        this.showScreen('start');

        // Update overlay size
        setTimeout(() => this.updateOverlaySize(), 50);
    }

    resetGame() {
        if (this.gameMode === 'single') {
            this.score = 0;
            this.level = 1;
            this.elapsedTime = 0;
            this.dino.reset();
            this.cactusManager.reset();
            this.ground.reset();
        } else {
            this.scores = [0, 0];
            this.elapsedTime = 0;
            this.dinos.forEach(d => d.reset());
            this.multiCactusManager.reset();
            this.multiGround.reset();
        }
        this.updateUI();
    }

    nextLevel() {
        this.level++;
        this.elapsedTime = 0;
        this.dino.reset();
        this.cactusManager.reset();
        this.ground.reset();
        this.state = 'playing';
        this.lastTimestamp = performance.now();
        this.hideAllScreens();
        this.updateUI();
    }

    getCurrentConfig() {
        const maxLevel = Math.max(...Object.keys(this.levelConfig).map(Number));
        const configLevel = Math.min(this.level, maxLevel);
        return this.levelConfig[configLevel];
    }

    gameLoop(timestamp) {
        const deltaTime = timestamp - this.lastTimestamp;
        this.lastTimestamp = timestamp;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.state === 'playing') {
            if (this.gameMode === 'single') {
                this.updateSinglePlayer(deltaTime);
            } else if (this.gameMode === 'two-player') {
                this.updateTwoPlayer(deltaTime);
            } else if (this.gameMode === 'online') {
                this.updateOnlineGame(deltaTime);
            }
        }

        this.draw();

        requestAnimationFrame(this.gameLoop);
    }

    updateSinglePlayer(deltaTime) {
        const config = this.getCurrentConfig();
        const speed = config.speed;

        this.elapsedTime += deltaTime / 1000;

        if (this.elapsedTime >= this.levelTime) {
            this.levelComplete();
            return;
        }

        this.ground.update(speed);
        this.dino.update();
        this.cactusManager.distanceTraveled += speed;

        if (this.cactusManager.shouldSpawn(speed, this.elapsedTime, this.levelTime, config.cacti, this.level)) {
            this.cactusManager.spawnCactus(speed);
        }

        const scored = this.cactusManager.update(speed, this.dino);
        if (scored) {
            this.score += 10;
            soundManager.playScore();
        }

        if (this.cactusManager.checkCollision(this.dino)) {
            this.gameOver();
            return;
        }

        this.updateUI();
    }

    updateTwoPlayer(deltaTime) {
        const config = this.levelConfig[1]; // Always use level 1 config for two player
        const speed = config.speed;

        this.elapsedTime += deltaTime / 1000;

        // Check if time is up
        if (this.elapsedTime >= this.levelTime) {
            this.twoPlayerGameOver();
            return;
        }

        // Update ground
        this.multiGround.update(speed);

        // Update both dinos
        this.dinos.forEach(dino => dino.update());

        // Spawn cacti
        if (this.multiCactusManager.shouldSpawn(speed, this.elapsedTime, this.levelTime, config.cacti, 1)) {
            this.multiCactusManager.spawnCactus(speed);
        }

        // Update cacti and check scoring
        const scored = this.multiCactusManager.update(speed, this.dinos);
        scored.forEach((didScore, index) => {
            if (didScore && this.dinos[index].isAlive) {
                this.scores[index] += 10;
                soundManager.playScore();
            }
        });

        // Check collisions for each player
        this.dinos.forEach((dino, index) => {
            if (dino.isAlive && this.multiCactusManager.checkCollision(dino, index)) {
                dino.die();
                soundManager.playGameOver();
            }
        });

        // Check if both players are dead
        if (!this.dinos[0].isAlive && !this.dinos[1].isAlive) {
            this.twoPlayerGameOver();
            return;
        }

        this.updateUI();
    }

    updateOnlineGame(deltaTime) {
        // Online game state is updated by server via WebSocket
        // We just update the ground animation locally
        if (this.multiGround && this.onlineConfig) {
            this.multiGround.update(this.onlineConfig.speed);
        }
    }

    draw() {
        if (this.gameMode === 'single' && this.ground) {
            this.ground.draw();
            this.cactusManager.draw();
            this.dino.draw();
        } else if (this.gameMode === 'two-player' && this.multiGround) {
            this.multiGround.draw();
            this.multiCactusManager.draw();
            this.dinos.forEach(dino => dino.draw());
        } else if (this.gameMode === 'online' && this.multiGround && this.state === 'playing') {
            this.multiGround.draw();
            this.drawOnlineCacti();
            this.drawOnlinePlayers();
        } else {
            // Draw default background when no mode selected
            this.ctx.fillStyle = '#87CEEB';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    drawOnlineCacti() {
        this.ctx.fillStyle = '#228B22';

        for (const cactus of this.onlineCacti) {
            // Draw cactus for each lane
            for (let i = 0; i < this.onlinePlayers.length; i++) {
                const groundY = 80 + (i * 120);
                const y = groundY - cactus.height;

                // Draw cactus based on type
                if (cactus.type === 'small') {
                    this.ctx.fillRect(cactus.x, y, cactus.width, cactus.height);
                } else if (cactus.type === 'tall') {
                    this.ctx.fillRect(cactus.x, y, cactus.width, cactus.height);
                } else if (cactus.type === 'double') {
                    this.ctx.fillRect(cactus.x, y, 17, cactus.height);
                    this.ctx.fillRect(cactus.x + 23, y, 17, cactus.height);
                }
            }
        }
    }

    drawOnlinePlayers() {
        const DINO_WIDTH = 44;
        const DINO_HEIGHT = 47;

        for (const player of this.onlinePlayers) {
            const x = 50;
            const y = player.y;

            // Draw dino body
            this.ctx.fillStyle = player.color;
            this.ctx.fillRect(x, y, DINO_WIDTH, DINO_HEIGHT);

            // Draw eye
            this.ctx.fillStyle = '#fff';
            this.ctx.fillRect(x + 30, y + 8, 8, 8);
            this.ctx.fillStyle = player.isAlive ? '#000' : '#f44336';
            this.ctx.fillRect(x + 32, y + 10, 4, 4);

            // Draw name label
            this.ctx.fillStyle = player.color;
            this.ctx.font = 'bold 12px Courier New';
            const nameText = `${player.name}: ${player.score}`;
            this.ctx.fillText(nameText, x, y - 5);

            // Draw dead indicator
            if (!player.isAlive) {
                this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                this.ctx.fillRect(x, y, DINO_WIDTH, DINO_HEIGHT);
                this.ctx.fillStyle = '#fff';
                this.ctx.font = 'bold 14px Courier New';
                this.ctx.fillText('X', x + 18, y + 28);
            }
        }
    }

    updateUI() {
        if (this.gameMode === 'single') {
            this.displays.level.textContent = `Level: ${this.level}`;
            this.displays.score.textContent = `Score: ${this.score}`;
        } else if (this.gameMode === 'two-player') {
            this.displays.p1Score.textContent = `P1: ${this.scores[0]}`;
            this.displays.p2Score.textContent = `P2: ${this.scores[1]}`;
        }

        const remainingTime = Math.max(0, this.levelTime - this.elapsedTime);
        const minutes = Math.floor(remainingTime / 60);
        const seconds = Math.floor(remainingTime % 60);
        this.displays.time.textContent = `Time: ${minutes}:${seconds.toString().padStart(2, '0')}`;
    }

    hideAllScreens() {
        Object.values(this.screens).forEach(screen => {
            if (screen) screen.classList.add('hidden');
        });
    }

    showScreen(screenName) {
        this.hideAllScreens();
        if (this.screens[screenName]) {
            this.screens[screenName].classList.remove('hidden');
        }
    }

    gameOver() {
        this.state = 'gameover';
        soundManager.playGameOver();

        rankingSystem.addScore(this.score, this.level, false);

        this.displays.gameoverScore.textContent = `Score: ${this.score}`;
        this.hideMobileTapArea();
        this.showScreen('gameover');
    }

    twoPlayerGameOver() {
        this.state = 'twoplayer-gameover';

        // Determine winner
        const winnerText = this.displays.winnerText;
        const p1Result = document.querySelector('.p1-result');
        const p2Result = document.querySelector('.p2-result');

        p1Result.classList.remove('winner');
        p2Result.classList.remove('winner');
        winnerText.classList.remove('p1-wins', 'p2-wins', 'tie-game');

        if (this.scores[0] > this.scores[1]) {
            winnerText.textContent = 'PLAYER 1 WINS!';
            winnerText.classList.add('p1-wins');
            p1Result.classList.add('winner');
        } else if (this.scores[1] > this.scores[0]) {
            winnerText.textContent = 'PLAYER 2 WINS!';
            winnerText.classList.add('p2-wins');
            p2Result.classList.add('winner');
        } else {
            winnerText.textContent = "IT'S A TIE!";
            winnerText.classList.add('tie-game');
        }

        this.displays.p1FinalScore.textContent = this.scores[0];
        this.displays.p2FinalScore.textContent = this.scores[1];

        this.hideMobileTapArea();
        this.showScreen('twoplayerGameover');
    }

    levelComplete() {
        this.state = 'levelcomplete';
        soundManager.playLevelComplete();

        // Save score for single player
        rankingSystem.addScore(this.score, this.level, true);

        this.displays.levelCompleteMsg.textContent = `Level ${this.level} cleared!`;
        this.displays.levelScore.textContent = `Score: ${this.score}`;
        this.hideMobileTapArea();
        this.showScreen('levelcomplete');
    }

    showRanking() {
        const rankings = rankingSystem.getRankings();
        const tbody = document.getElementById('ranking-body');

        tbody.innerHTML = '';

        if (rankings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">No scores yet!</td></tr>';
        } else {
            rankings.forEach((entry, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>#${index + 1}</td>
                    <td>${entry.score}</td>
                    <td>${entry.level}</td>
                    <td>${entry.timestamp}</td>
                `;
                tbody.appendChild(row);
            });
        }

        this.screens.ranking.classList.remove('hidden');
    }

    hideRanking() {
        this.screens.ranking.classList.add('hidden');
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new Game();
});
