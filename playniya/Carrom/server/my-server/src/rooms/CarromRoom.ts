
const { Room } = require('colyseus');

const { CarromPhysics } = require('./CarromPhysics');


const { Schema, MapSchema, type } = require('@colyseus/schema');

class Player extends Schema {
  @type('string') id;
  @type('string') playerId;
  @type('number') position;
  @type('boolean') ready;
  @type('number') score;
}

class Piece extends Schema {
  @type('string') id;
  @type('string') type; // 'coin', 'queen', 'striker'
  @type('string') color; // 'white', 'black', 'red'
  @type('number') x;
  @type('number') y;
  @type('number') angle;
  @type('boolean') active;
  @type('boolean') pocketed;
}

class CarromState extends Schema {
  @type('string') gamePhase;
  @type('string') turn;
  @type('string') winner;
  @type('boolean') canShoot;
  @type('number') shotPower;
  @type({ map: Player }) players = new MapSchema();
  @type({ map: Piece }) pieces = new MapSchema();
  @type(Piece) striker = new Piece();
  @type('object') scores = { player1: 0, player2: 0 };
  @type('object') strikerAim = { angle: 0, power: 0 };
}




class CarromRoom extends Room {
  maxClients = 2;
  
  onCreate(options) {
    this.setState(new CarromState());
    this.physics = new CarromPhysics();
    
    // Initialize game state
    this.state.gamePhase = 'waiting'; // waiting, playing, ended
    this.state.currentPlayer = 0;
    this.state.scores = { player1: 0, player2: 0 };
    this.state.turn = 'player1';
    this.state.shotPower = 0;
    this.state.canShoot = false;
    
    // Initialize physics world
    this.physics.createWorld();
    this.physics.setupCarromBoard();
    
    // Update physics at 60fps
    this.setSimulationInterval(() => this.updatePhysics(), 1000 / 60);
    
    // Message handlers
    this.onMessage('shoot', (client, data) => this.handleShoot(client, data));
    this.onMessage('aim', (client, data) => this.handleAim(client, data));
    this.onMessage('ready', (client, data) => this.handleReady(client, data));
    
    console.log('Carrom room created!');
  }
  
  onJoin(client, options) {
    console.log(`Player ${client.sessionId} joined`);
    
    // Assign player position
    const playerIndex = this.clients.length - 1;
    const playerId = `player${playerIndex + 1}`;
    
    this.state.players.set(client.sessionId, {
      id: client.sessionId,
      playerId: playerId,
      position: playerIndex,
      ready: false,
      score: 0
    });
    
    // Start game if we have 2 players
    if (this.clients.length === 2) {
      this.state.gamePhase = 'ready';
      this.broadcast('game-ready', { message: 'Game ready to start!' });
    }
  }
  
  onLeave(client, consented) {
    console.log(`Player ${client.sessionId} left`);
    this.state.players.delete(client.sessionId);
    
    if (this.clients.length === 0) {
      this.state.gamePhase = 'waiting';
    }
  }
  
  handleReady(client, data) {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      player.ready = true;
      
      // Check if all players are ready
      let allReady = true;
      this.state.players.forEach(p => {
        if (!p.ready) allReady = false;
      });
      
      if (allReady && this.clients.length === 2) {
        this.startGame();
      }
    }
  }
  
  handleAim(client, data) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !this.isPlayerTurn(client.sessionId)) return;
    
    // Update striker aim
    this.state.strikerAim = {
      angle: data.angle,
      power: Math.min(data.power, 100) // Clamp power to max 100
    };
    
    this.broadcast('striker-aim', {
      playerId: player.playerId,
      angle: data.angle,
      power: data.power
    });
  }
  
  handleShoot(client, data) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !this.isPlayerTurn(client.sessionId) || !this.state.canShoot) return;
    
    console.log(`Player ${player.playerId} shoots with power ${data.power}`);
    
    // Apply shot to physics
    this.physics.shootStriker(data.angle, data.power);
    this.state.canShoot = false;
    
    // Broadcast shot
    this.broadcast('shot-fired', {
      playerId: player.playerId,
      angle: data.angle,
      power: data.power
    });
  }
  
  startGame() {
    console.log('Starting Carrom game!');
    this.state.gamePhase = 'playing';
    this.state.turn = 'player1';
    this.state.canShoot = true;
    
    // Reset physics
    this.physics.resetGame();
    
    this.broadcast('game-started', {
      currentTurn: this.state.turn,
      message: 'Game started! Player 1 goes first.'
    });
  }
  
  updatePhysics() {
    if (this.state.gamePhase !== 'playing') return;
    
    // Update physics world
    this.physics.update();
    
    // Get current state from physics
    const physicsState = this.physics.getState();
    
    // Update game state
    this.state.pieces = physicsState.pieces;
    this.state.striker = physicsState.striker;
    
    // Check if pieces are moving
    const isMoving = this.physics.isAnyPieceMoving();
    
    if (!isMoving && !this.state.canShoot) {
      // Turn is over, check for scoring
      this.checkScoring();
      this.nextTurn();
    }
  }
  
  checkScoring() {
    const pocketedPieces = this.physics.getPocketedPieces();
    let scoreChange = 0;
    
    pocketedPieces.forEach(piece => {
      if (piece.type === 'coin') {
        scoreChange += (piece.color === 'white') ? 1 : 1;
      } else if (piece.type === 'queen') {
        scoreChange += 3;
      }
    });
    
    if (scoreChange > 0) {
      const currentPlayer = this.state.turn;
      this.state.scores[currentPlayer] += scoreChange;
      
      this.broadcast('score-update', {
        player: currentPlayer,
        points: scoreChange,
        total: this.state.scores[currentPlayer]
      });
    }
    
    // Check win condition
    this.checkWinCondition();
  }
  
  checkWinCondition() {
    const player1Score = this.state.scores.player1;
    const player2Score = this.state.scores.player2;
    
    
    if (player1Score >= 25 || player2Score >= 25) {
      this.endGame(player1Score > player2Score ? 'player1' : 'player2');
    }
  }
  
  nextTurn() {
    this.state.turn = this.state.turn === 'player1' ? 'player2' : 'player1';
    this.state.canShoot = true;
    
    this.broadcast('turn-change', {
      currentTurn: this.state.turn,
      canShoot: this.state.canShoot
    });
  }
  
  endGame(winner) {
    this.state.gamePhase = 'ended';
    this.state.winner = winner;
    
    this.broadcast('game-ended', {
      winner: winner,
      finalScores: this.state.scores
    });
  }
  
  isPlayerTurn(clientId) {
    const player = this.state.players.get(clientId);
    return player && player.playerId === this.state.turn;
  }
  
  onDispose() {
    console.log('Carrom room disposed');
    if (this.physics) {
      this.physics.destroy();
    }
  }
}

module.exports = { CarromRoom };
