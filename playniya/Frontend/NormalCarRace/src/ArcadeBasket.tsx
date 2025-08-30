// src/App.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Client, Room } from 'colyseus.js';
import './App.css';

// Define types for game state
interface Player {
  sessionId: string;
  name: string;
  xPosition: number;
  score: number;
}

interface Ball {
  x: number;
  y: number;
  visible: boolean;
}

interface GameState {
  phase: 'waiting' | 'playing' | 'ended';
  players: Map<string, Player>;
  ball: Ball;
  basketX: number;
  remainingTime: number;
  winner: string;
  betAmount: number;
  winAmount: number;
  minPlayers: number;
  basketDirection: number;
}

const ArcadeBasketballGame: React.FC = () => {
  const [client] = useState<Client>(new Client('ws://localhost:2567'));
  const [room, setRoom] = useState<Room<GameState> | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerName, setPlayerName] = useState<string>('Player');
  const [userId] = useState<string>(`user_${Math.random().toString(36).substr(2, 9)}`);
  const [uniqueId] = useState<string>(`unique_${Math.random().toString(36).substr(2, 9)}`);
  const [angle, setAngle] = useState<number>(45);
  const [power, setPower] = useState<number>(5);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  
  // Connect to the game room
  const connectToRoom = async () => {
    try {
      const room = await client.joinOrCreate<GameState>('arcade_basketball', {
        name: playerName,
        userId,
        uniqueId:"1749703909450",
        matchOptionId: '684bf9e16f5197dae4e38715',
        useBonus: false
      });
      
      setRoom(room);
      setIsConnected(true);
      
      room.onStateChange((state) => {
        setGameState(state);
      });
      
      room.onMessage('scoreUpdate', (message) => {
        setMessage(`${gameState?.players.get(message.playerId)?.name} scored ${message.points} points!`);
        setTimeout(() => setMessage(''), 2000);
      });
      
      room.onMessage('gameEnd', (message) => {
        setMessage(`Game ended! Winner: ${gameState?.players.get(message.winnerId)?.name}`);
      });
      
      room.onError((code, message) => {
        console.error('Room error:', code, message);
        setMessage(`Error: ${message}`);
      });
      
      room.onLeave((code) => {
        console.log('Left room:', code);
        setIsConnected(false);
        setMessage('Disconnected from game server');
      });
      
    } catch (e) {
      console.error('Connection error:', e);
      setMessage(`Connection failed: ${e.message}`);
    }
  };
  
  // Draw game elements
  const drawGame = () => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw court
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw center line
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    
    // Draw basket
    const basketX = (gameState.basketX / 800) * canvas.width;
    ctx.fillStyle = '#FF5722';
    ctx.fillRect(basketX - 20, 30, 40, 10);
    ctx.fillStyle = '#795548';
    ctx.fillRect(basketX, 40, 5, 50);
    
    // Draw players
    gameState.players.forEach((player) => {
      const playerX = (player.xPosition / 800) * canvas.width;
      ctx.fillStyle = player.sessionId === room?.sessionId ? '#2196F3' : '#F44336';
      ctx.beginPath();
      ctx.arc(playerX, canvas.height - 30, 15, 0, Math.PI * 2);
      ctx.fill();
      
      // Player name
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(player.name, playerX, canvas.height - 50);
      
      // Player score
      ctx.fillText(`Score: ${player.score}`, playerX, canvas.height - 65);
    });
    
    // Draw ball if visible
    if (gameState.ball.visible) {
      const ballX = (gameState.ball.x / 800) * canvas.width;
      const ballY = (gameState.ball.y / 500) * canvas.height;
      
      ctx.fillStyle = '#FFEB3B';
      ctx.beginPath();
      ctx.arc(ballX, ballY, 10, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw trajectory
      if (room?.sessionId) {
        const player = gameState.players.get(room.sessionId);
        if (player) {
          const playerX = (player.xPosition / 800) * canvas.width;
          const playerY = canvas.height - 30;
          
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(playerX, playerY);
          ctx.lineTo(ballX, ballY);
          ctx.stroke();
        }
      }
    }
    
    // Draw power bar
    if (gameState.phase === 'playing' && room?.sessionId) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(20, 20, 200, 20);
      ctx.fillStyle = '#FF5722';
      ctx.fillRect(20, 20, power * 20, 20);
      ctx.fillStyle = '#000000';
      ctx.font = '14px Arial';
      ctx.fillText(`Power: ${power}`, 25, 35);
      
      // Angle indicator
      const player = gameState.players.get(room.sessionId);
      if (player) {
        const playerX = (player.xPosition / 800) * canvas.width;
        const playerY = canvas.height - 30;
        
        ctx.strokeStyle = '#2196F3';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playerX, playerY);
        
        const radians = angle * (Math.PI / 180);
        const lineLength = 50;
        ctx.lineTo(
          playerX + Math.cos(radians) * lineLength,
          playerY - Math.sin(radians) * lineLength
        );
        ctx.stroke();
      }
    }
    
    // Draw timer
    if (gameState.phase === 'playing') {
      const minutes = Math.floor(gameState.remainingTime / 60);
      const seconds = gameState.remainingTime % 60;
      
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`Time: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`, canvas.width / 2, 30);
      
      // Draw bet info
      ctx.fillText(`Bet: $${gameState.betAmount} | Win: $${gameState.winAmount}`, canvas.width / 2, 60);
    }
    
    animationRef.current = requestAnimationFrame(drawGame);
  };
  
  // Handle player movement
  const handleMove = (direction: 'left' | 'right') => {
    if (!room || !gameState || gameState.phase !== 'playing') return;
    
    const player = gameState.players.get(room.sessionId);
    if (!player) return;
    
    let newX = player.xPosition;
    if (direction === 'left') newX = Math.max(50, player.xPosition - 20);
    if (direction === 'right') newX = Math.min(750, player.xPosition + 20);
    
    room.send('move', { x: newX });
  };
  
  // Handle shooting
  const handleShoot = () => {
    if (!room || !gameState || gameState.phase !== 'playing') return;
    room.send('shoot', { angle, power });
  };
  
  // Handle auto-shoot
  const handleAutoShoot = () => {
    if (!room || !gameState || gameState.phase !== 'playing') return;
    room.send('autoShoot');
  };
  
  // Handle rematch
  const handleRematch = () => {
    if (!room) return;
    room.send('rematch_request');
  };
  
  // Handle disconnect
  const handleDisconnect = () => {
    if (room) {
      room.leave();
      setRoom(null);
      setIsConnected(false);
    }
  };
  
  // Effect for game rendering
  useEffect(() => {
    if (gameState && canvasRef.current) {
      animationRef.current = requestAnimationFrame(drawGame);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState]);
  
  // Effect for keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isConnected || !gameState || gameState.phase !== 'playing') return;
      
      if (e.key === 'ArrowLeft') handleMove('left');
      if (e.key === 'ArrowRight') handleMove('right');
      if (e.key === ' ') handleShoot();
      if (e.key === 'a') handleAutoShoot();
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConnected, gameState]);
  
  return (
    <div className="game-container">
      <h1>Arcade Basketball</h1>
      
      {message && <div className="message">{message}</div>}
      
      {!isConnected ? (
        <div className="connection-panel">
          <div>
            <label>
              Player Name:
              <input 
                type="text" 
                value={playerName} 
                onChange={(e) => setPlayerName(e.target.value)} 
              />
            </label>
          </div>
          <button onClick={connectToRoom}>Join Game</button>
        </div>
      ) : (
        <div className="game-wrapper">
          <canvas 
            ref={canvasRef} 
            width={800} 
            height={500} 
            className="game-canvas"
          />
          
          <div className="game-controls">
            {gameState?.phase === 'waiting' && (
              <div className="waiting-message">
                <p>Waiting for players... ({gameState.players.size}/{gameState.minPlayers})</p>
                <p>Current players: {Array.from(gameState.players.values()).map(p => p.name).join(', ')}</p>
              </div>
            )}
            
            {gameState?.phase === 'playing' && (
              <div className="playing-controls">
                <div className="movement-controls">
                  <button onClick={() => handleMove('left')}>Move Left</button>
                  <button onClick={() => handleMove('right')}>Move Right</button>
                </div>
                
                <div className="shoot-controls">
                  <div className="angle-control">
                    <label>Angle: {angle}°</label>
                    <input 
                      type="range" 
                      min="30" 
                      max="80" 
                      value={angle} 
                      onChange={(e) => setAngle(parseInt(e.target.value))}
                    />
                  </div>
                  
                  <div className="power-control">
                    <label>Power: {power}</label>
                    <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      value={power} 
                      onChange={(e) => setPower(parseInt(e.target.value))}
                    />
                  </div>
                  
                  <button onClick={handleShoot}>Shoot</button>
                  <button onClick={handleAutoShoot}>Auto-Align & Shoot</button>
                </div>
              </div>
            )}
            
            {gameState?.phase === 'ended' && (
              <div className="end-game">
                <h2>Game Over!</h2>
                <p>Winner: {gameState.winner ? gameState.players.get(gameState.winner)?.name : 'None'}</p>
                <div className="scores">
                  <h3>Scores:</h3>
                  <ul>
                    {Array.from(gameState.players.values()).map(player => (
                      <li key={player.sessionId}>
                        {player.name}: {player.score} points
                      </li>
                    ))}
                  </ul>
                </div>
                <button onClick={handleRematch}>Rematch</button>
              </div>
            )}
            
            <button onClick={handleDisconnect} className="disconnect-button">
              Disconnect
            </button>
          </div>
        </div>
      )}
      
      <div className="instructions">
        <h3>How to Play:</h3>
        <ul>
          <li>Use Arrow Keys or buttons to move left/right</li>
          <li>Adjust angle and power for shooting</li>
          <li>Press Space or Shoot button to shoot</li>
          <li>Press 'A' or Auto-Shoot button to auto-align and shoot</li>
          <li>Score by shooting the ball into the moving basket</li>
        </ul>
      </div>
    </div>
  );
};

export default ArcadeBasketballGame;