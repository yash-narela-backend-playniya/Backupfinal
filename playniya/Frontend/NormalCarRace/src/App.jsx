import React, { useState, useEffect, useRef, useCallback } from 'react';

const RacingGame = () => {
  const [ws, setWs] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [mySessionId, setMySessionId] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [countdown, setCountdown] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const gameCanvasRef = useRef(null);
  const animationRef = useRef(null);
  const keysRef = useRef({ left: false, right: false, up: false });

  // Connection form state
  const [connectionForm, setConnectionForm] = useState({
    serverUrl: 'ws://localhost:2567',
    uniqueId: '1749703909450',
    userId: 'user_' + Math.random().toString(36).substr(2, 9),
    matchOptionId: '684bf9e16f5197dae4e38715',
    useBonus: false
  });

  // WebSocket message handler
  const handleWebSocketMessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'join':
          setMySessionId(message.sessionId);
          setConnectionStatus('connected');
          break;
          
        case 'state':
          setGameState(message.data);
          break;
          
        case 'countdown':
          setCountdown(message.data.countdown);
          if (message.data.countdown === 'GO') {
            setTimeout(() => setCountdown(null), 1000);
          }
          break;
          
        case 'leaderboard_update':
          setLeaderboard(message.data.leaderboard || []);
          break;
          
        case 'error':
          console.error('Server error:', message.message);
          setConnectionStatus('error');
          break;
          
        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  };

  // Connect to game server
  const connectToGame = async () => {
    if (isConnecting) return;
    
    setIsConnecting(true);
    setConnectionStatus('connecting');
    
    try {
      // Convert HTTP URL to WebSocket URL if needed
      let wsUrl = connectionForm.serverUrl;
      if (wsUrl.startsWith('http://')) {
        wsUrl = wsUrl.replace('http://', 'ws://');
      } else if (wsUrl.startsWith('https://')) {
        wsUrl = wsUrl.replace('https://', 'wss://');
      }
      
      // Add room path
      if (!wsUrl.includes('/race_room')) {
        wsUrl += '/race_room';
      }

      const websocket = new WebSocket(wsUrl);
      
      websocket.onopen = () => {
        console.log('WebSocket connected');
        
        // Send join message
        websocket.send(JSON.stringify({
          type: 'join',
          data: {
            uniqueId: connectionForm.uniqueId,
            userId: connectionForm.userId,
            matchOptionId: connectionForm.matchOptionId,
            useBonus: connectionForm.useBonus
          }
        }));
      };

      websocket.onmessage = handleWebSocketMessage;

      websocket.onclose = () => {
        console.log('WebSocket disconnected');
        setConnectionStatus('disconnected');
        setGameState(null);
        setMySessionId(null);
        setWs(null);
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('error');
      };

      setWs(websocket);

    } catch (error) {
      console.error('Connection failed:', error);
      setConnectionStatus('error');
    } finally {
      setIsConnecting(false);
    }
  };

  // Disconnect from game
  const disconnect = () => {
    if (ws) {
      ws.close();
    }
    setWs(null);
    setGameState(null);
    setMySessionId(null);
    setConnectionStatus('disconnected');
    setCountdown(null);
    setLeaderboard([]);
  };

  // Send message to server
  const sendMessage = (type, data) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, data }));
    }
  };

  // Handle player movement
  const movePlayer = useCallback((lane) => {
    if (ws && gameState?.gameStarted) {
      sendMessage('move', { lane });
    }
  }, [ws, gameState?.gameStarted]);

  // Handle player acceleration
  const acceleratePlayer = useCallback((speed) => {
    if (ws && gameState?.gameStarted) {
      sendMessage('accelerate', { speed });
    }
  }, [ws, gameState?.gameStarted]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!gameState?.players?.[mySessionId]) return;
      
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (!keysRef.current.left) {
            keysRef.current.left = true;
            const currentLane = gameState.players[mySessionId].lane;
            if (currentLane > 0) {
              movePlayer(currentLane - 1);
            }
          }
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (!keysRef.current.right) {
            keysRef.current.right = true;
            const currentLane = gameState.players[mySessionId].lane;
            const maxLane = (gameState.laneCount || 3) - 1;
            if (currentLane < maxLane) {
              movePlayer(currentLane + 1);
            }
          }
          e.preventDefault();
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (!keysRef.current.up) {
            keysRef.current.up = true;
            acceleratePlayer(500); // Max speed
          }
          e.preventDefault();
          break;
      }
    };

    const handleKeyUp = (e) => {
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          keysRef.current.left = false;
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          keysRef.current.right = false;
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
          keysRef.current.up = false;
          acceleratePlayer(200); // Normal speed
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [movePlayer, acceleratePlayer, gameState, mySessionId]);

  // Game rendering
  useEffect(() => {
    if (!gameState || !gameCanvasRef.current) return;

    const canvas = gameCanvasRef.current;
    const ctx = canvas.getContext('2d');
    
    const roadWidth = gameState.roadWidth || 600;
    const laneCount = gameState.laneCount || 3;
    const laneWidth = roadWidth / laneCount;
    
    canvas.width = roadWidth;
    canvas.height = 800;

    const render = () => {
      // Clear canvas
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw road background
      ctx.fillStyle = '#333';
      ctx.fillRect(0, 0, roadWidth, canvas.height);

      // Draw road lanes
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.setLineDash([30, 20]);
      
      for (let i = 1; i < laneCount; i++) {
        const x = i * laneWidth;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // Reset line dash for other elements
      ctx.setLineDash([]);

      // Draw obstacles
      if (gameState.obstacles) {
        const obstacles = Array.isArray(gameState.obstacles) ? gameState.obstacles : Object.values(gameState.obstacles);
        
        obstacles.forEach(obstacle => {
          const obsX = obstacle.x - obstacle.width / 2;
          const obsY = obstacle.y - obstacle.height / 2;
          
          // Main obstacle body
          ctx.fillStyle = '#ff3333';
          ctx.fillRect(obsX, obsY, obstacle.width, obstacle.height);
          
          // Obstacle details
          ctx.fillStyle = '#cc0000';
          ctx.fillRect(obsX + 8, obsY + 8, obstacle.width - 16, obstacle.height - 16);
          
          // Add some texture
          ctx.fillStyle = '#ff6666';
          ctx.fillRect(obsX + 5, obsY + 5, obstacle.width - 10, 10);
          ctx.fillRect(obsX + 5, obsY + obstacle.height - 15, obstacle.width - 10, 10);
        });
      }

      // Draw players
      if (gameState.players) {
        const players = Array.isArray(gameState.players) ? gameState.players : Object.entries(gameState.players);
        
        players.forEach(([sessionId, player]) => {
          if (typeof player !== 'object') return;
          
          const isMe = sessionId === mySessionId;
          const isGameOver = player.isGameOver;
          
          const carX = player.x - player.width / 2;
          const carY = player.y - player.height / 2;
          
          // Car shadow
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(carX + 3, carY + 3, player.width, player.height);
          
          // Main car body
          if (isGameOver) {
            ctx.fillStyle = '#666';
          } else if (isMe) {
            ctx.fillStyle = '#00ff00';
          } else {
            ctx.fillStyle = '#0066ff';
          }
          
          ctx.fillRect(carX, carY, player.width, player.height);
          
          // Car details
          if (!isGameOver) {
            ctx.fillStyle = isMe ? '#66ff66' : '#3399ff';
            ctx.fillRect(carX + 10, carY + 10, player.width - 20, player.height - 20);
            
            // Car windows
            ctx.fillStyle = '#111';
            ctx.fillRect(carX + 15, carY + 15, player.width - 30, 20);
            ctx.fillRect(carX + 15, carY + player.height - 35, player.width - 30, 20);
          }
          
          // Player info
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 14px Arial';
          ctx.textAlign = 'center';
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 3;
          
          const playerText = `${isMe ? 'YOU' : 'P' + sessionId.slice(-2)} - ${player.score || 0}`;
          ctx.strokeText(playerText, player.x, carY - 15);
          ctx.fillText(playerText, player.x, carY - 15);
          
          if (isGameOver) {
            ctx.fillStyle = '#ff0000';
            ctx.font = 'bold 16px Arial';
            ctx.strokeText('CRASHED!', player.x, carY + player.height + 25);
            ctx.fillText('CRASHED!', player.x, carY + player.height + 25);
          }
        });
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [gameState, mySessionId]);

  const myPlayer = gameState?.players?.[mySessionId];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 text-blue-400">
          🏎️ Racing Game
        </h1>

        {connectionStatus === 'disconnected' && (
          <div className="bg-gray-800 p-6 rounded-lg mb-6 max-w-2xl mx-auto">
            <h2 className="text-xl font-semibold mb-4">Connect to Game</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <input
                type="text"
                placeholder="Server URL (ws://localhost:2567)"
                className="bg-gray-700 p-3 rounded border border-gray-600 focus:border-blue-500 outline-none"
                value={connectionForm.serverUrl}
                onChange={(e) => setConnectionForm(prev => ({...prev, serverUrl: e.target.value}))}
              />
              <input
                type="text"
                placeholder="Your Unique ID"
                className="bg-gray-700 p-3 rounded border border-gray-600 focus:border-blue-500 outline-none"
                value={connectionForm.uniqueId}
                onChange={(e) => setConnectionForm(prev => ({...prev, uniqueId: e.target.value}))}
              />
              <input
                type="text"
                placeholder="User ID"
                className="bg-gray-700 p-3 rounded border border-gray-600 focus:border-blue-500 outline-none"
                value={connectionForm.userId}
                onChange={(e) => setConnectionForm(prev => ({...prev, userId: e.target.value}))}
              />
              <input
                type="text"
                placeholder="Match Option ID"
                className="bg-gray-700 p-3 rounded border border-gray-600 focus:border-blue-500 outline-none"
                value={connectionForm.matchOptionId}
                onChange={(e) => setConnectionForm(prev => ({...prev, matchOptionId: e.target.value}))}
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={connectionForm.useBonus}
                  onChange={(e) => setConnectionForm(prev => ({...prev, useBonus: e.target.checked}))}
                  className="w-4 h-4"
                />
                <span>Use Bonus</span>
              </label>
              <button
                onClick={connectToGame}
                disabled={isConnecting}
                className="bg-blue-600 hover:bg-blue-700 px-8 py-3 rounded font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isConnecting ? 'Connecting...' : 'Join Game'}
              </button>
            </div>
          </div>
        )}

        {connectionStatus === 'connected' && (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Game Canvas */}
            <div className="flex-1">
              <div className="relative bg-gray-800 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">🏁 Race Track</h2>
                  <button
                    onClick={disconnect}
                    className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
                
                {countdown && (
                  <div className="absolute inset-0 bg-black bg-opacity-80 flex items-center justify-center z-10 rounded-lg">
                    <div className="text-8xl font-bold text-yellow-400 animate-pulse">
                      {countdown}
                    </div>
                  </div>
                )}
                
                <div className="flex justify-center">
                  <canvas
                    ref={gameCanvasRef}
                    className="border-2 border-gray-600 rounded-lg bg-gray-900"
                    style={{ maxWidth: '100%', height: 'auto' }}
                  />
                </div>
                
                <div className="mt-4 p-4 bg-gray-700 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <strong>🎮 Keyboard:</strong><br />
                      ← → (A/D) Move lanes<br />
                      ↑ (W) Accelerate
                    </div>
                    <div>
                      <strong>🎯 Objective:</strong><br />
                      Avoid obstacles<br />
                      Score points by surviving
                    </div>
                    <div>
                      <strong>💡 Tips:</strong><br />
                      Stay alert!<br />
                      Use acceleration wisely
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Game Info Sidebar */}
            <div className="w-full lg:w-80 space-y-4">
              {/* Game Status */}
              <div className="bg-gray-800 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-3 text-blue-400">🎮 Game Status</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className="text-blue-400 font-semibold capitalize">
                      {gameState?.gameStatus || 'Unknown'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Time Left:</span>
                    <span className="text-green-400 font-bold">{gameState?.time || 0}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Players:</span>
                    <span className="text-yellow-400">{Object.keys(gameState?.players || {}).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Bet Amount:</span>
                    <span className="text-purple-400">${gameState?.betAmount || 0}</span>
                  </div>
                </div>
              </div>

              {/* Player Info */}
              {myPlayer && (
                <div className="bg-gray-800 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold mb-3 text-green-400">👤 Your Stats</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Score:</span>
                      <span className="text-green-400 font-bold text-lg">{myPlayer.score || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Lane:</span>
                      <span className="text-blue-400 font-semibold">{(myPlayer.lane || 0) + 1}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Speed:</span>
                      <span className="text-yellow-400">{myPlayer.speed || 0} km/h</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className={myPlayer.isGameOver ? 'text-red-400 font-bold' : 'text-green-400 font-bold'}>
                        {myPlayer.isGameOver ? '💥 Crashed' : '🏃 Racing'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Leaderboard */}
              <div className="bg-gray-800 p-4 rounded-lg">
                <h3 className="text-lg font-semibold mb-3 text-yellow-400">🏆 Leaderboard</h3>
                {leaderboard.length > 0 ? (
                  <div className="space-y-2">
                    {leaderboard.map((entry, index) => (
                      <div key={entry.sessionId} className="flex justify-between items-center text-sm p-2 rounded bg-gray-700">
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-400 font-bold">#{entry.rank}</span>
                          <span className={entry.sessionId === mySessionId ? 'text-green-400 font-bold' : 'text-gray-300'}>
                            {entry.sessionId === mySessionId ? '👤 YOU' : `🎮 Player ${entry.sessionId.slice(-4)}`}
                          </span>
                        </div>
                        <span className="text-yellow-400 font-bold">{entry.score}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm text-center">No leaderboard data yet</p>
                )}
              </div>

              {/* Mobile Controls */}
              <div className="bg-gray-800 p-4 rounded-lg lg:hidden">
                <h3 className="text-lg font-semibold mb-3 text-purple-400">📱 Touch Controls</h3>
                <div className="flex justify-center gap-3">
                  <button
                    onTouchStart={(e) => {
                      e.preventDefault();
                      if (myPlayer && myPlayer.lane > 0) {
                        movePlayer(myPlayer.lane - 1);
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 p-4 rounded-lg text-2xl font-bold transition-colors active:scale-95"
                  >
                    ←
                  </button>
                  <button
                    onTouchStart={(e) => {
                      e.preventDefault();
                      acceleratePlayer(500);
                    }}
                    onTouchEnd={(e) => {
                      e.preventDefault();
                      acceleratePlayer(200);
                    }}
                    className="bg-green-600 hover:bg-green-700 p-4 rounded-lg text-2xl font-bold transition-colors active:scale-95"
                  >
                    ↑
                  </button>
                  <button
                    onTouchStart={(e) => {
                      e.preventDefault();
                      if (myPlayer && myPlayer.lane < (gameState?.laneCount || 3) - 1) {
                        movePlayer(myPlayer.lane + 1);
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 p-4 rounded-lg text-2xl font-bold transition-colors active:scale-95"
                  >
                    →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {connectionStatus === 'connecting' && (
          <div className="text-center py-12">
            <div className="text-3xl mb-4">🔄 Connecting to game server...</div>
            <div className="text-gray-400">Please wait while we establish connection</div>
          </div>
        )}

        {connectionStatus === 'error' && (
          <div className="bg-red-900 border border-red-600 p-6 rounded-lg text-center max-w-md mx-auto">
            <div className="text-2xl text-red-400 mb-3">❌ Connection Failed</div>
            <p className="text-red-300 mb-4">Please check your server URL and try again.</p>
            <button
              onClick={() => setConnectionStatus('disconnected')}
              className="bg-red-600 hover:bg-red-700 px-6 py-3 rounded font-semibold transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RacingGame;