import React, { useState, useEffect, useRef, useCallback } from 'react';

const RacingGame = () => {
  const canvasRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [gameState, setGameState] = useState({
    gameStatus: 'waiting',
    gameStarted: false,
    time: 180,
    betAmount: 0,
    winAmount: 0,
    minPlayer: 1,
    playerCount: 2,
    roadWidth: 600,
    laneCount: 4,
    players: new Map(),
    obstacles: []
  });
  const [playerId, setPlayerId] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [countdown, setCountdown] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [joinOptions, setJoinOptions] = useState({
    uniqueId: '',
    userId: '',
    useBonus: false,
    matchOptionId: '',
    playerCount: 2,
    isPrivate: false
  });
  const [error, setError] = useState('');
  const [showJoinForm, setShowJoinForm] = useState(true);

  // Game constants
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;
  const ROAD_WIDTH = 600;
  const LANE_COUNT = 4;
  const LANE_WIDTH = ROAD_WIDTH / LANE_COUNT;

  // Initialize WebSocket connection
  useEffect(() => {
    return () => {
      if (socket) {
        socket.close();
      }
    };
  }, []);

  // Mock game state for demonstration
  useEffect(() => {
    // Simulate some initial players
    const mockPlayers = new Map();
    mockPlayers.set('player1', {
      uniqueId: 'user123',
      lane: 1,
      x: 150,
      y: 800,
      speed: 300,
      score: 0,
      isGameOver: false,
      canEarnScore: true,
      scoreAchievedAt: Date.now(),
      lastScoreUpdateTime: Date.now(),
      passedObstacleIds: new Set()
    });

    setGameState(prev => ({
      ...prev,
      players: mockPlayers
    }));
    setPlayerId('player1');
  }, []);

  // Join room function (mock implementation)
  const joinRoom = async () => {
    setError('');
    setConnectionStatus('connecting');
    
    try {
      // Simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock WebSocket connection
      const mockSocket = {
        send: (type, data) => {
          console.log('Sending:', type, data);
          // Simulate server response
          if (type === 'move') {
            handlePlayerMove(data.lane);
          } else if (type === 'accelerate') {
            handlePlayerAccelerate(data.speed);
          }
        },
        close: () => {
          setConnectionStatus('disconnected');
        }
      };
      
      setSocket(mockSocket);
      setConnectionStatus('connected');
      setShowJoinForm(false);
      
      // Start mock game after connection
      setTimeout(() => {
        startMockGame();
      }, 2000);
      
    } catch (err) {
      setError(err.message);
      setConnectionStatus('disconnected');
    }
  };

  // Mock game functions
  const handlePlayerMove = (newLane) => {
    setGameState(prev => {
      const newPlayers = new Map(prev.players);
      const player = newPlayers.get(playerId);
      if (player && !player.isGameOver) {
        player.lane = newLane;
        player.x = newLane * LANE_WIDTH + LANE_WIDTH / 2;
        player.score += 5;
        player.scoreAchievedAt = Date.now();
      }
      return { ...prev, players: newPlayers };
    });
  };

  const handlePlayerAccelerate = (speed) => {
    setGameState(prev => {
      const newPlayers = new Map(prev.players);
      const player = newPlayers.get(playerId);
      if (player && !player.isGameOver) {
        player.speed = Math.max(200, Math.min(500, speed));
      }
      return { ...prev, players: newPlayers };
    });
  };

  const startMockGame = () => {
    let countdown = 3;
    const countdownTimer = setInterval(() => {
      setCountdown(countdown);
      countdown--;
      if (countdown < 0) {
        clearInterval(countdownTimer);
        setCountdown('GO');
        setTimeout(() => {
          setCountdown(null);
          setGameState(prev => ({
            ...prev,
            gameStarted: true,
            gameStatus: 'in-progress'
          }));
          startMockObstacles();
          startMockTimer();
        }, 1000);
      }
    }, 1000);
  };

  const startMockObstacles = () => {
    const obstacleInterval = setInterval(() => {
      if (gameState.gameStatus !== 'in-progress') {
        clearInterval(obstacleInterval);
        return;
      }
      
      setGameState(prev => {
        const safeLane = Math.floor(Math.random() * LANE_COUNT);
        const newObstacles = [...prev.obstacles];
        
        for (let lane = 0; lane < LANE_COUNT; lane++) {
          if (lane === safeLane) continue;
          
          newObstacles.push({
            id: Math.random().toString(36).substr(2, 9),
            lane,
            x: lane * LANE_WIDTH + LANE_WIDTH / 2,
            y: -100,
            speed: 300
          });
        }
        
        return { ...prev, obstacles: newObstacles };
      });
    }, 2000);
  };

  const startMockTimer = () => {
    const timer = setInterval(() => {
      setGameState(prev => {
        if (prev.time <= 1) {
          clearInterval(timer);
          return { ...prev, time: 0, gameStatus: 'finished' };
        }
        return { ...prev, time: prev.time - 1 };
      });
    }, 1000);
  };

  // Handle player movement
  const handleKeyPress = useCallback((event) => {
    if (!socket || !gameState.gameStarted) return;
    
    const player = gameState.players.get(playerId);
    if (!player || player.isGameOver) return;
    
    let newLane = player.lane;
    
    switch (event.key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        newLane = Math.max(0, player.lane - 1);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        newLane = Math.min(LANE_COUNT - 1, player.lane + 1);
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
        socket.send('accelerate', { speed: 500 });
        return;
      case 'ArrowDown':
      case 's':
      case 'S':
        socket.send('accelerate', { speed: 200 });
        return;
    }
    
    if (newLane !== player.lane) {
      socket.send('move', { lane: newLane });
    }
  }, [socket, gameState, playerId]);

  // Add keyboard event listeners
  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);

  // Canvas rendering and game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    const gameLoop = () => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      
      // Draw road
      ctx.fillStyle = '#333';
      ctx.fillRect((CANVAS_WIDTH - ROAD_WIDTH) / 2, 0, ROAD_WIDTH, CANVAS_HEIGHT);
      
      // Draw lane dividers
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.setLineDash([20, 20]);
      for (let i = 1; i < LANE_COUNT; i++) {
        const x = (CANVAS_WIDTH - ROAD_WIDTH) / 2 + i * LANE_WIDTH;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      
      // Draw players
      gameState.players.forEach((player, sessionId) => {
        const isCurrentPlayer = sessionId === playerId;
        const x = (CANVAS_WIDTH - ROAD_WIDTH) / 2 + player.x - 30;
        const y = CANVAS_HEIGHT - player.y - 60;
        
        // Player car
        ctx.fillStyle = isCurrentPlayer ? '#ff6b6b' : '#4ecdc4';
        if (player.isGameOver) {
          ctx.fillStyle = '#666';
        }
        
        ctx.fillRect(x, y, 60, 120);
        
        // Player info
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.fillText(`Score: ${player.score}`, x, y - 10);
        
        if (isCurrentPlayer) {
          ctx.fillText('YOU', x + 15, y + 135);
        }
      });
      
      // Draw obstacles
      gameState.obstacles.forEach((obstacle) => {
        const x = (CANVAS_WIDTH - ROAD_WIDTH) / 2 + obstacle.x - 30;
        const y = CANVAS_HEIGHT - obstacle.y - 60;
        
        ctx.fillStyle = '#e74c3c';
        ctx.fillRect(x, y, 60, 120);
      });
      
      // Update obstacles position (mock physics)
      if (gameState.gameStarted && gameState.gameStatus === 'in-progress') {
        setGameState(prev => {
          const newObstacles = prev.obstacles.map(obs => ({
            ...obs,
            y: obs.y + 5
          })).filter(obs => obs.y < 1000);
          
          // Update player score over time
          const newPlayers = new Map(prev.players);
          newPlayers.forEach((player, id) => {
            if (!player.isGameOver && player.canEarnScore) {
              player.score += 1;
            }
          });
          
          return { ...prev, obstacles: newObstacles, players: newPlayers };
        });
      }
      
      requestAnimationFrame(gameLoop);
    };
    
    gameLoop();
  }, [gameState, playerId]);

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (showJoinForm) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-96">
          <h1 className="text-3xl font-bold mb-6 text-center text-yellow-400">
            🏎️ Racing Game
          </h1>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Unique ID</label>
              <input
                type="text"
                value={joinOptions.uniqueId}
                onChange={(e) => setJoinOptions({...joinOptions, uniqueId: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:border-blue-500"
                placeholder="Enter your unique ID"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">User ID</label>
              <input
                type="text"
                value={joinOptions.userId}
                onChange={(e) => setJoinOptions({...joinOptions, userId: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:border-blue-500"
                placeholder="Enter your user ID"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Match Option ID</label>
              <input
                type="text"
                value={joinOptions.matchOptionId}
                onChange={(e) => setJoinOptions({...joinOptions, matchOptionId: e.target.value})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:border-blue-500"
                placeholder="Enter match option ID"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Player Count</label>
              <input
                type="number"
                min="1"
                max="8"
                value={joinOptions.playerCount}
                onChange={(e) => setJoinOptions({...joinOptions, playerCount: parseInt(e.target.value)})}
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded focus:border-blue-500"
              />
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="useBonus"
                checked={joinOptions.useBonus}
                onChange={(e) => setJoinOptions({...joinOptions, useBonus: e.target.checked})}
                className="mr-2"
              />
              <label htmlFor="useBonus" className="text-sm">Use Bonus</label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="isPrivate"
                checked={joinOptions.isPrivate}
                onChange={(e) => setJoinOptions({...joinOptions, isPrivate: e.target.checked})}
                className="mr-2"
              />
              <label htmlFor="isPrivate" className="text-sm">Private Room</label>
            </div>
            
            {error && (
              <div className="bg-red-600 text-white p-3 rounded">
                {error}
              </div>
            )}
            
            <button
              onClick={joinRoom}
              disabled={connectionStatus === 'connecting' || !joinOptions.uniqueId || !joinOptions.matchOptionId}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded transition-colors"
            >
              {connectionStatus === 'connecting' ? 'Connecting...' : 'Start Mock Race'}
            </button>
            
            <p className="text-xs text-gray-400 text-center mt-2">
              Note: This is a mock version for demonstration. In production, connect to your Colyseus server.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 p-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-yellow-400">🏎️ Racing Game</h1>
        <div className="flex items-center space-x-4">
          <span className={`px-3 py-1 rounded ${
            connectionStatus === 'connected' ? 'bg-green-600' : 'bg-red-600'
          }`}>
            {connectionStatus.toUpperCase()}
          </span>
          {gameState && (
            <span className="text-lg font-mono">
              Time: {formatTime(gameState.time)}
            </span>
          )}
        </div>
      </div>

      <div className="flex">
        {/* Game Canvas */}
        <div className="flex-1 flex flex-col items-center p-4">
          {countdown && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="text-8xl font-bold text-yellow-400 animate-pulse">
                {countdown}
              </div>
            </div>
          )}
          
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="border-2 border-gray-600 bg-green-600"
          />
          
          <div className="mt-4 text-center">
            <p className="text-lg mb-2">
              Status: <span className="font-bold text-yellow-400">
                {gameState?.gameStatus?.toUpperCase() || 'WAITING'}
              </span>
            </p>
            
            {gameState && (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>Bet Amount: ${gameState.betAmount}</div>
                <div>Win Amount: ${gameState.winAmount}</div>
                <div>Min Players: {gameState.minPlayer}</div>
                <div>Max Players: {gameState.playerCount}</div>
              </div>
            )}
            
            <div className="mt-4 text-sm text-gray-300">
              <p>Controls: Arrow Keys or WASD</p>
              <p>← → to change lanes | ↑ ↓ to speed up/slow down</p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-gray-800 p-4">
          {/* Player Stats */}
          {gameState && gameState.players.get(playerId) && (
            <div className="mb-6 p-4 bg-gray-700 rounded">
              <h3 className="text-lg font-bold mb-2 text-yellow-400">Your Stats</h3>
              <div className="space-y-1 text-sm">
                <div>Score: {gameState.players.get(playerId).score}</div>
                <div>Lane: {gameState.players.get(playerId).lane + 1}</div>
                <div>Speed: {gameState.players.get(playerId).speed}</div>
                <div className={`font-bold ${
                  gameState.players.get(playerId).isGameOver ? 'text-red-400' : 'text-green-400'
                }`}>
                  {gameState.players.get(playerId).isGameOver ? 'CRASHED' : 'RACING'}
                </div>
              </div>
            </div>
          )}

          {/* Leaderboard */}
          <div className="mb-6">
            <h3 className="text-lg font-bold mb-2 text-yellow-400">Leaderboard</h3>
            <div className="space-y-2">
              {leaderboard.map((entry, index) => (
                <div key={entry.sessionId} className={`p-2 rounded ${
                  entry.sessionId === playerId ? 'bg-blue-700' : 'bg-gray-700'
                }`}>
                  <div className="flex justify-between items-center">
                    <span className="font-bold">#{entry.rank}</span>
                    <span>{entry.score} pts</span>
                  </div>
                  {entry.sessionId === playerId && (
                    <div className="text-xs text-yellow-400">YOU</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Players List */}
          {gameState && (
            <div>
              <h3 className="text-lg font-bold mb-2 text-yellow-400">
                Players ({gameState.players.size})
              </h3>
              <div className="space-y-2">
                {Array.from(gameState.players.entries()).map(([sessionId, player]) => (
                  <div key={sessionId} className={`p-2 rounded text-sm ${
                    sessionId === playerId ? 'bg-blue-700' : 'bg-gray-700'
                  }`}>
                    <div className="flex justify-between">
                      <span className="truncate">
                        {player.uniqueId} {sessionId === playerId && '(You)'}
                      </span>
                      <span className={player.isGameOver ? 'text-red-400' : 'text-green-400'}>
                        {player.isGameOver ? '💥' : '🏎️'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-300">
                      Score: {player.score} | Lane: {player.lane + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RacingGame;