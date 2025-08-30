import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Target, Users, Trophy, Clock, Coins } from 'lucide-react';

const ArcadeBasketballGame = () => {
  // WebSocket connection
  const [ws, setWs] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  
  // Game state
  const [gameState, setGameState] = useState(null);
  const [roomId, setRoomId] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [players, setPlayers] = useState(new Map());
  const [currentPlayer, setCurrentPlayer] = useState(null);
  
  // UI state
  const [joinForm, setJoinForm] = useState({
    name: '',
    matchOptionId: '684bf9e16f5197dae4e38715', // Default match option ID
    uniqueId: '',
    useBonus: false
  });
  const [showJoinForm, setShowJoinForm] = useState(true);
  const [shootingControls, setShootingControls] = useState({
    angle: 50,
    power: 8
  });
  const [lastScore, setLastScore] = useState(null);
  const [gameMessages, setGameMessages] = useState([]);
  
  // Canvas ref for game visualization
  const canvasRef = useRef(null);
  const wsRef = useRef(null);

  // Initialize WebSocket connection
  const connectWebSocket = useCallback(() => {
    try {
      const socket = new WebSocket('ws://localhost:5000');
      wsRef.current = socket;
      
      socket.onopen = () => {
        setConnectionStatus('connected');
        setWs(socket);
        addMessage('Connected to game server', 'success');
      };
      
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };
      
      socket.onclose = () => {
        setConnectionStatus('disconnected');
        setWs(null);
        addMessage('Disconnected from server', 'error');
      };
      
      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        addMessage('Connection error occurred', 'error');
      };
    } catch (err) {
      console.error('Failed to create WebSocket connection:', err);
      addMessage('Failed to connect to server', 'error');
    }
  }, []);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message) => {
    const { type, data } = message;
    
    switch (type) {
      case 'joined':
        setRoomId(data.roomId);
        setSessionId(data.sessionId);
        setShowJoinForm(false);
        addMessage(`Joined room: ${data.roomId}`, 'success');
        break;
        
      case 'state':
        setGameState(data);
        if (data.players) {
          const playersMap = new Map();
          Object.entries(data.players).forEach(([id, player]) => {
            playersMap.set(id, player);
            if (id === sessionId) {
              setCurrentPlayer(player);
            }
          });
          setPlayers(playersMap);
        }
        break;
        
      case 'scoreUpdate':
        setLastScore({
          playerId: data.playerId,
          points: data.points,
          totalScore: data.totalScore
        });
        addMessage(`Player scored ${data.points} points!`, 'success');
        setTimeout(() => setLastScore(null), 3000);
        break;
        
      case 'shotTaken':
        addMessage(`Player shot at angle ${data.angle}° with power ${data.power}`, 'info');
        break;
        
      case 'shotReset':
        addMessage('Shot completed, ready for next shot', 'info');
        break;
        
      case 'playerMoved':
        // Handle player movement updates
        break;
        
      case 'gameEnd':
        addMessage(`Game ended: ${data.reason}`, 'warning');
        const winner = Array.from(players.values()).find(p => p.sessionId === data.winnerId);
        if (winner) {
          addMessage(`🏆 Winner: ${winner.name}`, 'success');
        }
        break;
        
      case 'left':
        addMessage('Left the game', 'info');
        setShowJoinForm(true);
        setGameState(null);
        break;
        
      case 'error':
        addMessage(`Error: ${data}`, 'error');
        break;
        
      default:
        console.log('Unknown message type:', type, data);
    }
  }, [sessionId, players]);

  // Add message to game log
  const addMessage = (text, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setGameMessages(prev => [...prev.slice(-9), { text, type, timestamp }]);
  };

  // Join game room
  const joinGame = () => {
    if (!ws || !joinForm.name || !joinForm.uniqueId) {
      addMessage('Please fill in all required fields', 'error');
      return;
    }
    
    ws.send(JSON.stringify({
      type: 'join',
      data: {
        name: joinForm.name,
        matchOptionId: joinForm.matchOptionId,
        uniqueId: joinForm.uniqueId,
        useBonus: joinForm.useBonus
      }
    }));
  };

  // Shoot the ball
  const shootBall = () => {
    if (!ws || !gameState || gameState.phase !== 'playing') {
      addMessage('Cannot shoot: Game not active', 'error');
      return;
    }
    
    ws.send(JSON.stringify({
      type: 'shoot',
      data: {
        angle: shootingControls.angle,
        power: shootingControls.power
      }
    }));
  };

  // Auto align and shoot
  const autoShoot = () => {
    if (!ws || !gameState || gameState.phase !== 'playing') {
      addMessage('Cannot auto-shoot: Game not active', 'error');
      return;
    }
    
    ws.send(JSON.stringify({
      type: 'autoShoot'
    }));
  };

  // Leave game
  const leaveGame = () => {
    if (ws) {
      ws.send(JSON.stringify({ type: 'exit' }));
    }
  };

  // Draw game canvas
  const drawGame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !gameState) return;
    
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    // Draw court
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(50, height - 100, width - 100, 80);
    
    // Draw basket
    const basketX = (gameState.basketX / 800) * width;
    const basketY = 200;
    
    ctx.fillStyle = '#ff6b35';
    ctx.fillRect(basketX - 30, basketY, 60, 10);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(basketX, basketY, 25, 0, Math.PI, true);
    ctx.stroke();
    
    // Draw backboard
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(basketX + 25, basketY - 50, 5, 60);
    
    // Draw players
    players.forEach((player, playerId) => {
      const playerX = (player.xPosition / 800) * width;
      const playerY = height - 120;
      
      ctx.fillStyle = playerId === sessionId ? '#4CAF50' : '#2196F3';
      ctx.beginPath();
      ctx.arc(playerX, playerY, 15, 0, 2 * Math.PI);
      ctx.fill();
      
      // Player name
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(player.name, playerX, playerY - 25);
      
      // Score
      ctx.fillText(`${player.score}`, playerX, playerY + 35);
    });
    
    // Draw ball
    if (gameState.ball && gameState.ball.visible) {
      const ballX = (gameState.ball.x / 800) * width;
      const ballY = height - gameState.ball.y;
      
      ctx.fillStyle = '#FF9800';
      ctx.beginPath();
      ctx.arc(ballX, ballY, 8, 0, 2 * Math.PI);
      ctx.fill();
      
      // Ball shadow
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(ballX, height - 50, 15, 5, 0, 0, 2 * Math.PI);
      ctx.fill();
    }
  }, [gameState, players, sessionId]);

  // Initialize WebSocket on component mount
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  // Draw game loop
  useEffect(() => {
    const interval = setInterval(drawGame, 50);
    return () => clearInterval(interval);
  }, [drawGame]);

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
            🏀 Arcade Basketball
          </h1>
          <div className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
            connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
          }`}>
            {connectionStatus === 'connected' ? '🟢 Connected' : '🔴 Disconnected'}
          </div>
        </div>

        {/* Join Form */}
        {showJoinForm && (
          <div className="max-w-md mx-auto bg-white/10 backdrop-blur-md rounded-xl p-6 mb-8">
            <h2 className="text-2xl font-bold mb-4 text-center">Join Game</h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Your Name"
                value={joinForm.name}
                onChange={(e) => setJoinForm({...joinForm, name: e.target.value})}
                className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
              <input
                type="text"
                placeholder="Unique ID"
                value={joinForm.uniqueId}
                onChange={(e) => setJoinForm({...joinForm, uniqueId: e.target.value})}
                className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
              <input
                type="text"
                placeholder="Match Option ID"
                value={joinForm.matchOptionId}
                onChange={(e) => setJoinForm({...joinForm, matchOptionId: e.target.value})}
                className="w-full px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-yellow-400"
              />
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={joinForm.useBonus}
                  onChange={(e) => setJoinForm({...joinForm, useBonus: e.target.checked})}
                  className="rounded"
                />
                <span>Use Bonus</span>
              </label>
              <button
                onClick={joinGame}
                disabled={connectionStatus !== 'connected'}
                className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold py-3 px-6 rounded-lg hover:from-yellow-500 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Play className="inline mr-2" size={16} />
                Join Game
              </button>
            </div>
          </div>
        )}

        {/* Game Interface */}
        {!showJoinForm && gameState && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Game Canvas */}
            <div className="lg:col-span-2">
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4">
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={600}
                  className="w-full border border-white/30 rounded-lg"
                />
              </div>
              
              {/* Shooting Controls */}
              {gameState.phase === 'playing' && (
                <div className="mt-4 bg-white/10 backdrop-blur-md rounded-xl p-4">
                  <h3 className="text-lg font-bold mb-4">🎯 Shooting Controls</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Angle: {shootingControls.angle}°
                      </label>
                      <input
                        type="range"
                        min="10"
                        max="80"
                        value={shootingControls.angle}
                        onChange={(e) => setShootingControls({
                          ...shootingControls,
                          angle: parseInt(e.target.value)
                        })}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Power: {shootingControls.power}
                      </label>
                      <input
                        type="range"
                        min="3"
                        max="12"
                        value={shootingControls.power}
                        onChange={(e) => setShootingControls({
                          ...shootingControls,
                          power: parseInt(e.target.value)
                        })}
                        className="w-full"
                      />
                    </div>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={shootBall}
                      className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-bold py-2 px-4 rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all"
                    >
                      🏀 Shoot
                    </button>
                    <button
                      onClick={autoShoot}
                      className="flex-1 bg-gradient-to-r from-blue-500 to-cyan-600 text-white font-bold py-2 px-4 rounded-lg hover:from-blue-600 hover:to-cyan-700 transition-all"
                    >
                      <Target className="inline mr-1" size={16} />
                      Auto
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Game Info Sidebar */}
            <div className="space-y-4">
              {/* Game Status */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4">
                <h3 className="text-lg font-bold mb-3">🎮 Game Status</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Phase:</span>
                    <span className={`font-bold ${
                      gameState.phase === 'playing' ? 'text-green-400' :
                      gameState.phase === 'waiting' ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {gameState.phase.toUpperCase()}
                    </span>
                  </div>
                  {gameState.phase === 'playing' && (
                    <div className="flex justify-between">
                      <span><Clock className="inline mr-1" size={14} />Time:</span>
                      <span className="font-bold">{formatTime(gameState.remainingTime)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span><Coins className="inline mr-1" size={14} />Bet:</span>
                    <span className="font-bold">${gameState.betAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span><Trophy className="inline mr-1" size={14} />Win:</span>
                    <span className="font-bold">${gameState.winAmount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Room:</span>
                    <span className="font-mono text-xs">{roomId}</span>
                  </div>
                </div>
              </div>

              {/* Players */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4">
                <h3 className="text-lg font-bold mb-3">
                  <Users className="inline mr-2" size={18} />
                  Players ({players.size}/{gameState.minPlayers})
                </h3>
                <div className="space-y-2">
                  {Array.from(players.values()).map((player) => (
                    <div
                      key={player.sessionId}
                      className={`flex justify-between items-center p-2 rounded-lg ${
                        player.sessionId === sessionId 
                          ? 'bg-green-500/20 border border-green-500/50' 
                          : 'bg-white/10'
                      }`}
                    >
                      <span className="font-medium">
                        {player.name}
                        {player.sessionId === sessionId && ' (You)'}
                      </span>
                      <span className="font-bold text-yellow-400">
                        {player.score} pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Last Score Alert */}
              {lastScore && (
                <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-black rounded-xl p-4 animate-pulse">
                  <div className="text-center font-bold">
                    🎉 SCORE! +{lastScore.points} points!
                  </div>
                </div>
              )}

              {/* Game Messages */}
              <div className="bg-white/10 backdrop-blur-md rounded-xl p-4">
                <h3 className="text-lg font-bold mb-3">📜 Game Log</h3>
                <div className="space-y-1 text-xs max-h-48 overflow-y-auto">
                  {gameMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded ${
                        msg.type === 'success' ? 'bg-green-500/20 text-green-300' :
                        msg.type === 'error' ? 'bg-red-500/20 text-red-300' :
                        msg.type === 'warning' ? 'bg-yellow-500/20 text-yellow-300' :
                        'bg-blue-500/20 text-blue-300'
                      }`}
                    >
                      <div className="flex justify-between">
                        <span>{msg.text}</span>
                        <span className="opacity-70">{msg.timestamp}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Leave Game */}
              <button
                onClick={leaveGame}
                className="w-full bg-gradient-to-r from-red-500 to-pink-600 text-white font-bold py-2 px-4 rounded-lg hover:from-red-600 hover:to-pink-700 transition-all"
              >
                🚪 Leave Game
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ArcadeBasketballGame;