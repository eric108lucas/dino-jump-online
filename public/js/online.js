// Online multiplayer client module
class OnlineManager {
    constructor(game) {
        this.game = game;
        this.ws = null;
        this.playerId = null;
        this.roomId = null;
        this.isHost = false;
        this.players = [];
        this.difficulty = 1;
        this.connected = false;
    }

    connect() {
        return new Promise((resolve, reject) => {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}`;

            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                this.connected = true;
                console.log('Connected to server');
                resolve();
            };

            this.ws.onclose = () => {
                this.connected = false;
                console.log('Disconnected from server');
                if (this.game.gameMode === 'online') {
                    this.game.showDisconnectedScreen();
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                reject(error);
            };

            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (e) {
                    console.error('Error parsing message:', e);
                }
            };
        });
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    createRoom(name) {
        this.send({ type: 'createRoom', name: name });
    }

    joinRoom(roomId, name) {
        this.send({ type: 'joinRoom', roomId: roomId, name: name });
    }

    toggleReady() {
        this.send({ type: 'ready' });
    }

    setDifficulty(level) {
        this.send({ type: 'setDifficulty', level: level });
    }

    kickPlayer(playerId) {
        this.send({ type: 'kickPlayer', playerId: playerId });
    }

    startGame() {
        this.send({ type: 'startGame' });
    }

    jump() {
        this.send({ type: 'jump' });
    }

    restart() {
        this.send({ type: 'restartGame' });
    }

    leave() {
        this.send({ type: 'leaveRoom' });
        this.roomId = null;
        this.playerId = null;
        this.isHost = false;
    }

    handleMessage(message) {
        switch (message.type) {
            case 'roomCreated':
                this.roomId = message.roomId;
                this.playerId = message.playerId;
                this.isHost = true;
                this.players = message.players;
                this.game.showLobby(message.roomId, message.players, true, 1);
                break;

            case 'joinedRoom':
                this.roomId = message.roomId;
                this.playerId = message.playerId;
                this.isHost = message.isHost;
                this.players = message.players;
                this.difficulty = message.difficulty;
                this.game.showLobby(message.roomId, message.players, false, message.difficulty);
                break;

            case 'playerJoined':
            case 'lobbyUpdate':
            case 'playerLeft':
                this.players = message.players;
                if (message.difficulty !== undefined) {
                    this.difficulty = message.difficulty;
                }
                this.game.updateLobby(message.players, this.isHost, this.difficulty);
                break;

            case 'gameStart':
                this.players = message.players;
                this.game.startOnlineGame(message.config, message.players, this.playerId);
                break;

            case 'gameState':
                this.game.updateOnlineGameState(message);
                break;

            case 'playerDied':
                this.game.handlePlayerDied(message.playerId);
                break;

            case 'gameOver':
                this.game.showOnlineGameOver(message.rankings);
                break;

            case 'returnToLobby':
                this.players = message.players;
                this.difficulty = message.difficulty;
                this.game.showLobby(this.roomId, message.players, this.isHost, message.difficulty);
                break;

            case 'kicked':
                alert('You have been kicked from the room');
                this.game.returnToMainMenu();
                break;

            case 'roomClosed':
                alert('Room closed: ' + message.reason);
                this.game.returnToMainMenu();
                break;

            case 'error':
                alert('Error: ' + message.message);
                break;
        }
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
        this.roomId = null;
        this.playerId = null;
        this.isHost = false;
    }
}

// Export for use in game.js
window.OnlineManager = OnlineManager;
