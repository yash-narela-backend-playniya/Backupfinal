import React, { useState, useEffect, useRef } from 'react';
import { Client } from 'colyseus.js';
import './App.css';

const App = () => {
  const [connected, setConnected] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [room, setRoom] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [players, setPlayers] = useState({});
  const [error, setError] = useState('');
  const [gameObjects, setGameObjects] = useState([]);
  const [slicing, setSlicing] = useState(false);
  const [sliceStart, setSliceStart] = useState(null);
  
  const gameCanvasRef = useRef(null);
  const animationRef = useRef(null);
  
  // Colyseus client connection
  const client = new Client('ws://localhost:2567');

  // Connect to game room
  const joinGame = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    
    try {
      console.log('⌛ Connecting to game server...');
      const room = await client.joinOrCreate('fruit_ninja', {
        name: playerName
      });
      
      console.log('✅ Connected to room:', room.id);
      console.log('📡 Session ID:', room.sessionId);
      console.log('🆕 Initial room state:', room.state.toJSON());
      
      setRoom(room);
      setConnected(true);
      setError('');
      
      // Handle players collection
      room.state.players.onAdd = (player, sessionId) => {
        console.log('👤 Player added:', sessionId, player.toJSON());
        setPlayers(prev => ({...prev, [sessionId]: player.toJSON()}));
        
        player.onChange = () => {
          console.log(`👤 Player ${sessionId} changed:`, player.toJSON());
          setPlayers(prev => ({...prev, [sessionId]: player.toJSON()}));
        };
      };
      
      room.state.players.onRemove = (player, sessionId) => {
        console.log('👤 Player removed:', sessionId);
        setPlayers(prev => {
          const newPlayers = {...prev};
          delete newPlayers[sessionId];
          return newPlayers;
        });
      };
      
      // Handle game objects collection
      room.state.objects.onAdd = (obj, id) => {
        console.log('🍎 Object added:', id, obj.toJSON());
        setGameObjects(prev => [...prev, {...obj.toJSON(), id}]);
        
        obj.onChange = () => {
          console.log(`🍎 Object ${id} changed:`, obj.toJSON());
          setGameObjects(prev => prev.map(o => o.id === id ? {...o, ...obj.toJSON()} : o));
        };
      };
      
      room.state.objects.onRemove = (obj, id) => {
        console.log('🍎 Object removed:', id);
        setGameObjects(prev => prev.filter(o => o.id !== id));
      };
      
      // Listen for state changes
      room.state.onChange = (changes) => {
        console.group('🔄 STATE UPDATE');
        console.log('📋 Changes:', changes);
        console.log('🎮 Full state:', room.state.toJSON());
        console.groupEnd();
        
        setGameState(room.state.toJSON());
      };
      
      // Listen for errors
      room.onError = (code, message) => {
        console.error('❌ Room error:', { code, message });
        setError(`Room error: ${message}`);
      };
      
      // Handle disconnection
      room.onLeave = (code) => {
        console.warn('🚫 Disconnected from room. Code:', code);
        setConnected(false);
        setError('Disconnected from server');
      };
      
      // Listen for custom messages
      room.onMessage('*', (type, message) => {
        console.log(`📨 Message [${type}]:`, message);
      });
      
    } catch (e) {
      console.error('🔥 Connection error:', e);
      setError(`Connection failed: ${e.message}`);
    }
  };
  
  // Handle slice action
  const handleSliceStart = (e) => {
    if (!connected || !room) return;
    
    const rect = gameCanvasRef.current.getBoundingClientRect();
    const start = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    setSlicing(true);
    setSliceStart(start);
  };
  
  const handleSliceEnd = (e) => {
    if (!slicing || !sliceStart || !room) return;
    
    const rect = gameCanvasRef.current.getBoundingClientRect();
    const end = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    console.log('🔪 Sending slice:', { start: sliceStart, end });
    room.send('slice', {
      start: sliceStart,
      end: end
    });
    
    setSlicing(false);
    setSliceStart(null);
    
    // Clear slice line
    const canvas = gameCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };
  
  const handleSliceMove = (e) => {
    if (!slicing || !room) return;
    
    const rect = gameCanvasRef.current.getBoundingClientRect();
    const current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    
    // Visual feedback for slicing
    drawSliceLine(sliceStart, current);
  };
  
  // Draw slice line on canvas
  const drawSliceLine = (start, end) => {
    const canvas = gameCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw slice line
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.closePath();
  };
  
  // Render game objects
  const renderGame = () => {
    if (!gameCanvasRef.current) return;
    
    const canvas = gameCanvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    console.log(`🎨 Rendering ${gameObjects.length} objects`);
    
    // Draw game objects
    gameObjects.forEach(obj => {
      // Skip if object is missing required properties
      if (typeof obj.x === 'undefined' || typeof obj.y === 'undefined' || typeof obj.radius === 'undefined') {
        console.warn('⚠️ Skipping invalid object:', obj);
        return;
      }
      
      if (obj.isSliced && obj.type === 'fruit') {
        // Draw sliced fruit particles
        for (let i = 0; i < 4; i++) {
          const angle = (Math.PI / 2) * i;
          const offsetX = Math.cos(angle) * 15;
          const offsetY = Math.sin(angle) * 15;
          
          ctx.beginPath();
          ctx.arc(
            obj.x + offsetX, 
            obj.y + offsetY, 
            obj.radius / 2, 
            0, 
            Math.PI * 2
          );
          
          if (obj.fruitType === 'apple') ctx.fillStyle = 'rgba(255, 60, 60, 0.8)';
          else if (obj.fruitType === 'orange') ctx.fillStyle = 'rgba(255, 165, 0, 0.8)';
          else if (obj.fruitType === 'banana') ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
          else ctx.fillStyle = 'rgba(60, 180, 75, 0.8)';
          
          ctx.fill();
          ctx.closePath();
        }
      } else {
        // Draw whole objects
        ctx.beginPath();
        ctx.arc(obj.x, obj.y, obj.radius, 0, Math.PI * 2);
        
        if (obj.type === 'fruit') {
          if (obj.fruitType === 'apple') ctx.fillStyle = 'rgba(255, 60, 60, 0.9)';
          else if (obj.fruitType === 'orange') ctx.fillStyle = 'rgba(255, 165, 0, 0.9)';
          else if (obj.fruitType === 'banana') ctx.fillStyle = 'rgba(255, 255, 0, 0.9)';
          else ctx.fillStyle = 'rgba(60, 180, 75, 0.9)';
        } else if (obj.type === 'bomb') {
          ctx.fillStyle = 'rgba(40, 40, 40, 0.9)';
          // Draw bomb fuse
          ctx.beginPath();
          ctx.moveTo(obj.x + obj.radius / 2, obj.y - obj.radius);
          ctx.lineTo(obj.x + obj.radius, obj.y - obj.radius - 10);
          ctx.strokeStyle = 'rgba(255, 100, 0, 0.9)';
          ctx.lineWidth = 3;
          ctx.stroke();
          ctx.closePath();
        } else if (obj.type === 'particle') {
          if (obj.fruitType === 'apple') ctx.fillStyle = 'rgba(255, 60, 60, 0.7)';
          else if (obj.fruitType === 'orange') ctx.fillStyle = 'rgba(255, 165, 0, 0.7)';
          else if (obj.fruitType === 'banana') ctx.fillStyle = 'rgba(255, 255, 0, 0.7)';
          else ctx.fillStyle = 'rgba(60, 180, 75, 0.7)';
        }
        
        ctx.fill();
        ctx.closePath();
      }
    });
    
    animationRef.current = requestAnimationFrame(renderGame);
  };
  
  // Initialize game rendering
  useEffect(() => {
    if (connected && gameCanvasRef.current) {
      console.log('🖌️ Starting game rendering');
      animationRef.current = requestAnimationFrame(renderGame);
    }
    
    return () => {
      if (animationRef.current) {
        console.log('🛑 Stopping game rendering');
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [connected]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (room) {
        console.log('👋 Leaving room');
        room.leave();
      }
    };
  }, [room]);
  
  // Get player color based on ID
  const getPlayerColor = (id) => {
    const colors = ['#FF5252', '#FFD740', '#7C4DFF', '#18FFFF', '#69F0AE'];
    const index = Object.keys(players).indexOf(id) % colors.length;
    return colors[index];
  };

  return (
    <div className="game-container">
      <h1>Fruit Ninja</h1>
      
      {!connected ? (
        <div className="login-panel">
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            maxLength={20}
          />
          <button onClick={joinGame}>Join Game</button>
          {error && <div className="error">{error}</div>}
        </div>
      ) : (
        <div className="game-content">
          <div className="game-header">
            <div className="player-info">
              {Object.entries(players).map(([id, player]) => (
                <div 
                  key={id} 
                  className={`player ${player.isGameOver ? 'game-over' : ''}`}
                  style={{ borderColor: getPlayerColor(id) }}
                >
                  <div className="player-name" style={{ color: getPlayerColor(id) }}>
                    {player.name}
                  </div>
                  <div className="player-stats">
                    <span>Score: {player.score}</span>
                    <span>Lives: {player.lives}</span>
                  </div>
                </div>
              ))}
            </div>
            
            {gameState && (
              <div className="game-timer">
                Time: {gameState.gameTime}s
                {!gameState.isGameActive && (
                  <button 
                    className="restart-button"
                    onClick={() => room && room.send('restart')}
                  >
                    Restart
                  </button>
                )}
              </div>
            )}
          </div>
          
          <div 
            className="game-canvas-container"
            onMouseDown={handleSliceStart}
            onMouseUp={handleSliceEnd}
            onMouseMove={handleSliceMove}
            onMouseLeave={() => setSlicing(false)}
            onTouchStart={(e) => {
              e.preventDefault();
              handleSliceStart(e.touches[0]);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              if (slicing) handleSliceEnd(e.changedTouches[0]);
            }}
            onTouchMove={(e) => {
              e.preventDefault();
              if (slicing) handleSliceMove(e.touches[0]);
            }}
          >
            <canvas
              ref={gameCanvasRef}
              width={800}
              height={600}
            />
            
            {!gameState?.isGameActive && gameState?.gameTime <= 0 && (
              <div className="game-over-screen">
                <h2>Game Over!</h2>
                <p>Final Scores:</p>
                <ul>
                  {Object.entries(players).map(([id, player]) => (
                    <li key={id} style={{ color: getPlayerColor(id) }}>
                      {player.name}: {player.score} points
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          <div className="game-instructions">
            <p>Slice fruits to score points! Avoid bombs.</p>
            <div className="legend">
              <div className="legend-item">
                <div className="fruit-demo apple"></div>
                <span>Apple (+10)</span>
              </div>
              <div className="legend-item">
                <div className="fruit-demo orange"></div>
                <span>Orange (+10)</span>
              </div>
              <div className="legend-item">
                <div className="fruit-demo banana"></div>
                <span>Banana (+10)</span>
              </div>
              <div className="legend-item">
                <div className="fruit-demo watermelon"></div>
                <span>Watermelon (+10)</span>
              </div>
              <div className="legend-item">
                <div className="bomb-demo"></div>
                <span>Bomb (-1 life)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;