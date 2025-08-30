import React, { useState, useEffect, useRef, useCallback } from 'react';

const RacingGameApp = () => {
  // Game state
  const [gameState, setGameState] = useState({
    players: new Map(),
    nitroPickups: new Map(),
    gameStarted: false,
    gameEnded: false,
    timeRemaining: 120,
    winner: null,
    trackLength: 1000
  });

  // Player state
  const [playerCar, setPlayerCar] = useState({
    id: 'player1',
    x: 0,
    z: 100,
    rotation: 0,
    speed: 0,
    maxSpeed: 100,
    nitroAmount: 100,
    nitroActive: false,
    distanceCovered: 0,
    currentLap: 1,
    rank: 1,
    isRespawning: false,
    respawnTime: 0,
    acceleration: 0,
    steering: 0
  });

  // AI cars
  const [aiCars, setAiCars] = useState([]);
  const [nitroPickups, setNitroPickups] = useState([]);
  
  // Input state
  const [inputState, setInputState] = useState({
    left: false,
    right: false,
    accelerate: false,
    nitro: false
  });

  // Connection state
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');

  // Refs for game loop
  const gameLoopRef = useRef(null);
  const timerLoopRef = useRef(null);

  // Initialize AI cars
  useEffect(() => {
    const colors = ['#ff4757', '#2ed573', '#ffa502', '#3742fa', '#ff6348'];
    const startPositions = [
      { x: -60, z: 50 },
      { x: 60, z: 80 },
      { x: -30, z: 120 },
      { x: 30, z: 140 }
    ];

    const initialAICars = [];
    for (let i = 0; i < 4; i++) {
      initialAICars.push({
        id: `ai${i + 1}`,
        x: startPositions[i].x,
        z: startPositions[i].z,
        rotation: 0,
        speed: 0,
        maxSpeed: 80 + Math.random() * 20,
        distanceCovered: 0,
        currentLap: 1,
        rank: i + 2,
        color: colors[i],
        aiSpeed: 0.5 + Math.random() * 0.5,
        nitroAmount: 100,
        nitroActive: false
      });
    }
    setAiCars(initialAICars);

    // Initialize nitro pickups
    const positions = [
      { x: -100, z: 300 },
      { x: 100, z: 300 },
      { x: -80, z: 500 },
      { x: 80, z: 500 },
      { x: -60, z: 700 },
      { x: 60, z: 700 }
    ];

    const initialPickups = positions.map((pos, index) => ({
      id: `nitro${index}`,
      x: pos.x,
      z: pos.z,
      active: true
    }));
    setNitroPickups(initialPickups);
  }, []);

  // Simulate connection to Colyseus
  const connectToServer = useCallback(() => {
    setConnectionStatus('Connecting...');
    
    // Simulate connection delay
    setTimeout(() => {
      setConnected(true);
      setConnectionStatus('Connected to Racing Room');
      
      // Simulate receiving initial game state
      setGameState(prev => ({
        ...prev,
        players: new Map([['player1', playerCar]]),
        gameStarted: false
      }));
    }, 1000);
  }, [playerCar]);

  // Input handling
  const handleInputChange = useCallback((input, value) => {
    setInputState(prev => ({
      ...prev,
      [input]: value
    }));

    // Simulate sending input to server
    if (connected) {
      // In real implementation, this would be:
      // room.send("input", { [input]: value });
      console.log('Sending input to server:', { [input]: value });
    }
  }, [connected]);

  // Update player car based on input
  const updatePlayerCar = useCallback(() => {
    setPlayerCar(prev => {
      const newCar = { ...prev };

      if (newCar.isRespawning) {
        newCar.respawnTime -= 1/60;
        if (newCar.respawnTime <= 0) {
          newCar.isRespawning = false;
        }
        return newCar;
      }

      // Handle steering
      if (inputState.left) {
        newCar.steering = Math.max(newCar.steering - 0.1, -1);
      } else if (inputState.right) {
        newCar.steering = Math.min(newCar.steering + 0.1, 1);
      } else {
        newCar.steering *= 0.8;
      }

      // Handle acceleration
      if (inputState.accelerate) {
        newCar.acceleration = Math.min(newCar.acceleration + 0.05, 1);
      } else {
        newCar.acceleration = Math.max(newCar.acceleration - 0.1, 0);
      }

      // Calculate speed
      const targetSpeed = newCar.acceleration * newCar.maxSpeed;
      
      // Apply nitro
      if (inputState.nitro && newCar.nitroAmount > 0) {
        newCar.nitroActive = true;
        newCar.speed = Math.min(newCar.speed + 3, targetSpeed * 1.5);
        newCar.nitroAmount = Math.max(0, newCar.nitroAmount - 1);
      } else {
        newCar.nitroActive = false;
        newCar.speed = newCar.speed + (targetSpeed - newCar.speed) * 0.1;
        newCar.nitroAmount = Math.min(100, newCar.nitroAmount + 0.5);
      }

      // Apply physics
      newCar.speed *= 0.95; // Friction
      newCar.rotation += newCar.steering * (newCar.speed / newCar.maxSpeed) * 0.05;

      // Update position
      const speedFactor = newCar.speed / 60;
      newCar.x += Math.sin(newCar.rotation) * speedFactor;
      newCar.z += Math.cos(newCar.rotation) * speedFactor;

      // Track boundaries
      if (newCar.x < -350 || newCar.x > 350) {
        newCar.x = Math.max(-350, Math.min(350, newCar.x));
        newCar.speed *= 0.3; // Collision damping
      }
      newCar.z = Math.max(0, Math.min(1000, newCar.z));

      // Update distance
      newCar.distanceCovered += speedFactor;

      // Check lap completion
      if (newCar.distanceCovered >= gameState.trackLength * newCar.currentLap) {
        newCar.currentLap++;
        if (newCar.currentLap > 3) {
          endGame('🏆 You Win!');
        }
      }

      return newCar;
    });
  }, [inputState, gameState.trackLength]);

  // Update AI cars
  const updateAICars = useCallback(() => {
    setAiCars(prev => prev.map(car => {
      const newCar = { ...car };
      
      // Simple AI movement
      newCar.speed = newCar.maxSpeed * newCar.aiSpeed;
      newCar.z += newCar.speed * 0.1;
      
      // Simple steering
      newCar.x += (Math.random() - 0.5) * 2;
      newCar.x = Math.max(-350, Math.min(350, newCar.x));
      
      // Reset if reached end
      if (newCar.z > 1000) {
        newCar.z = 0;
        newCar.currentLap++;
        if (newCar.currentLap > 3) {
          endGame(`🏆 ${newCar.id} Wins!`);
        }
      }
      
      newCar.distanceCovered += newCar.speed * 0.1;
      
      return newCar;
    }));
  }, []);

  // Check collisions
  const checkCollisions = useCallback(() => {
    // Check nitro pickups
    setNitroPickups(prev => prev.map(pickup => {
      if (!pickup.active) return pickup;
      
      const distance = Math.sqrt(
        Math.pow(playerCar.x - pickup.x, 2) + 
        Math.pow(playerCar.z - pickup.z, 2)
      );
      
      if (distance < 30) {
        setPlayerCar(prevCar => ({
          ...prevCar,
          nitroAmount: Math.min(100, prevCar.nitroAmount + 25)
        }));
        
        // Respawn pickup after 10 seconds
        setTimeout(() => {
          setNitroPickups(pickups => pickups.map(p => 
            p.id === pickup.id ? { ...p, active: true } : p
          ));
        }, 10000);
        
        return { ...pickup, active: false };
      }
      
      return pickup;
    }));

    // Check AI car collisions
    aiCars.forEach(aiCar => {
      const distance = Math.sqrt(
        Math.pow(playerCar.x - aiCar.x, 2) + 
        Math.pow(playerCar.z - aiCar.z, 2)
      );
      
      if (distance < 50) {
        setPlayerCar(prev => ({
          ...prev,
          isRespawning: true,
          respawnTime: 2,
          speed: 0,
          x: prev.x - Math.sin(prev.rotation) * 50,
          z: prev.z - Math.cos(prev.rotation) * 50
        }));
      }
    });
  }, [playerCar, aiCars]);

  // Update rankings
  const updateRankings = useCallback(() => {
    const allCars = [playerCar, ...aiCars];
    allCars.sort((a, b) => {
      if (a.currentLap !== b.currentLap) {
        return b.currentLap - a.currentLap;
      }
      return b.distanceCovered - a.distanceCovered;
    });
    
    const playerRank = allCars.findIndex(car => car.id === 'player1') + 1;
    setPlayerCar(prev => ({ ...prev, rank: playerRank }));
  }, [playerCar, aiCars]);

  // Game loop
  const gameLoop = useCallback(() => {
    if (!gameState.gameStarted || gameState.gameEnded) return;
    
    updatePlayerCar();
    updateAICars();
    checkCollisions();
    updateRankings();
  }, [gameState.gameStarted, gameState.gameEnded, updatePlayerCar, updateAICars, checkCollisions, updateRankings]);

  // Start game
  const startGame = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      gameStarted: true,
      gameEnded: false,
      timeRemaining: 120
    }));

    // Start game loop
    gameLoopRef.current = setInterval(gameLoop, 1000 / 60);
    
    // Start timer
    timerLoopRef.current = setInterval(() => {
      setGameState(prev => {
        const newTime = prev.timeRemaining - 1;
        if (newTime <= 0) {
          endGame('⏰ Time Up!');
          return { ...prev, timeRemaining: 0 };
        }
        return { ...prev, timeRemaining: newTime };
      });
    }, 1000);
  }, [gameLoop]);

  // End game
  const endGame = useCallback((message) => {
    setGameState(prev => ({ ...prev, gameEnded: true, winner: message }));
    
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
    }
    if (timerLoopRef.current) {
      clearInterval(timerLoopRef.current);
    }
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      switch(e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          handleInputChange('left', true);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          handleInputChange('right', true);
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
        case ' ':
          handleInputChange('accelerate', true);
          e.preventDefault();
          break;
        case 'Shift':
        case 'n':
        case 'N':
          handleInputChange('nitro', true);
          break;
      }
    };

    const handleKeyUp = (e) => {
      switch(e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          handleInputChange('left', false);
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          handleInputChange('right', false);
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
        case ' ':
          handleInputChange('accelerate', false);
          break;
        case 'Shift':
        case 'n':
        case 'N':
          handleInputChange('nitro', false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleInputChange]);

  // Run game loop
  useEffect(() => {
    if (gameState.gameStarted && !gameState.gameEnded) {
      gameLoop();
    }
  }, [gameLoop, gameState.gameStarted, gameState.gameEnded]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
      if (timerLoopRef.current) clearInterval(timerLoopRef.current);
    };
  }, []);

  // Car component
  const Car = ({ car, isPlayer = false }) => (
    <div
      className={`absolute w-10 h-20 rounded-t-xl rounded-b-sm border-2 transition-transform duration-100 ${
        isPlayer 
          ? 'bg-gradient-to-b from-blue-500 to-blue-600 border-yellow-400 shadow-lg shadow-yellow-400/50' 
          : 'bg-gradient-to-b from-red-500 to-red-600 border-white'
      } ${car.nitroActive ? 'shadow-lg shadow-cyan-400/70 animate-pulse' : ''}`}
      style={{
        left: `${400 + car.x}px`,
        top: `${car.z}px`,
        transform: `rotate(${car.rotation}rad)`,
        backgroundColor: !isPlayer ? car.color : undefined
      }}
    >
      <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-5 h-5 bg-gray-800 rounded-full border-2 border-white"></div>
      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-7 h-2 bg-gray-800 rounded"></div>
    </div>
  );

  // Nitro pickup component
  const NitroPickup = ({ pickup }) => (
    pickup.active && (
      <div
        className="absolute w-5 h-5 bg-gradient-to-br from-green-400 to-green-500 rounded-full border-2 border-white animate-pulse shadow-lg shadow-green-400/70"
        style={{
          left: `${400 + pickup.x}px`,
          top: `${pickup.z}px`
        }}
      />
    )
  );

  return (
    <div className="w-full h-screen bg-gradient-to-br from-blue-900 to-purple-900 overflow-hidden text-white">
      {/* Game Container */}
      <div className="relative w-full h-full" style={{ perspective: '1000px' }}>
        {/* Track */}
        <div 
          className="absolute w-[800px] h-[1200px] left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-700 border-8 border-orange-500 rounded-lg shadow-2xl"
          style={{
            transform: 'translate(-50%, -50%) rotateX(60deg)',
            background: `
              linear-gradient(90deg, #333 0%, #555 50%, #333 100%),
              repeating-linear-gradient(
                0deg,
                transparent 0px,
                transparent 48px,
                #fff 48px,
                #fff 52px
              )
            `
          }}
        >
          {/* Player Car */}
          <Car car={playerCar} isPlayer={true} />
          
          {/* AI Cars */}
          {aiCars.map(car => (
            <Car key={car.id} car={car} />
          ))}
          
          {/* Nitro Pickups */}
          {nitroPickups.map(pickup => (
            <NitroPickup key={pickup.id} pickup={pickup} />
          ))}
        </div>

        {/* HUD */}
        <div className="absolute top-4 left-4 bg-black/80 p-4 rounded-lg border-2 border-orange-500 min-w-[200px]">
          <div className="text-orange-400 text-xl font-bold mb-2">
            Time: {gameState.timeRemaining}s
          </div>
          <div className="mb-2">Speed: {Math.round(playerCar.speed)} km/h</div>
          <div className="w-48 h-4 bg-gray-700 rounded-full mb-2">
            <div 
              className="h-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 rounded-full transition-all duration-300"
              style={{ width: `${(playerCar.speed / playerCar.maxSpeed) * 100}%` }}
            />
          </div>
          <div className="mb-2">Nitro: {Math.round(playerCar.nitroAmount)}%</div>
          <div className="w-36 h-3 bg-gray-700 rounded-full mb-2">
            <div 
              className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all duration-300"
              style={{ width: `${playerCar.nitroAmount}%` }}
            />
          </div>
          <div>Distance: {Math.round(playerCar.distanceCovered)}m</div>
          <div>Lap: {playerCar.currentLap}/3</div>
          <div>Rank: {playerCar.rank}</div>
        </div>

        {/* Leaderboard */}
        <div className="absolute top-4 right-4 bg-black/80 p-4 rounded-lg border-2 border-orange-500 min-w-[200px]">
          <h3 className="text-orange-400 text-lg font-bold mb-2">🏆 Leaderboard</h3>
          <div className="text-sm">
            <div className={`p-2 mb-1 rounded border-l-4 ${playerCar.rank === 1 ? 'border-yellow-400 bg-yellow-900/20' : playerCar.rank === 2 ? 'border-gray-400 bg-gray-900/20' : playerCar.rank === 3 ? 'border-orange-600 bg-orange-900/20' : 'border-gray-600 bg-gray-900/20'}`}>
              <div>{playerCar.rank}. YOU</div>
              <div>Lap: {playerCar.currentLap}/3</div>
              <div>Distance: {Math.round(playerCar.distanceCovered)}m</div>
            </div>
            {aiCars.map(car => (
              <div key={car.id} className={`p-2 mb-1 rounded border-l-4 ${car.rank === 1 ? 'border-yellow-400 bg-yellow-900/20' : car.rank === 2 ? 'border-gray-400 bg-gray-900/20' : car.rank === 3 ? 'border-orange-600 bg-orange-900/20' : 'border-gray-600 bg-gray-900/20'}`}>
                <div>{car.rank}. {car.id.toUpperCase()}</div>
                <div>Lap: {car.currentLap}/3</div>
                <div>Distance: {Math.round(car.distanceCovered)}m</div>
              </div>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="absolute bottom-4 right-4 bg-black/80 p-4 rounded-lg border-2 border-orange-500">
          <div className="flex gap-2 mb-2">
            <button
              className={`px-4 py-2 rounded font-bold transition-all ${
                inputState.left 
                  ? 'bg-green-500 shadow-lg shadow-green-400/50' 
                  : 'bg-orange-500 hover:bg-orange-600'
              }`}
              onMouseDown={() => handleInputChange('left', true)}
              onMouseUp={() => handleInputChange('left', false)}
              onMouseLeave={() => handleInputChange('left', false)}
            >
              ← Left
            </button>
            <button
              className={`px-4 py-2 rounded font-bold transition-all ${
                inputState.right 
                  ? 'bg-green-500 shadow-lg shadow-green-400/50' 
                  : 'bg-orange-500 hover:bg-orange-600'
              }`}
              onMouseDown={() => handleInputChange('right', true)}
              onMouseUp={() => handleInputChange('right', false)}
              onMouseLeave={() => handleInputChange('right', false)}
            >
              Right →
            </button>
          </div>
          <div className="flex gap-2 mb-2">
            <button
              className={`px-4 py-2 rounded font-bold transition-all ${
                inputState.accelerate 
                  ? 'bg-green-500 shadow-lg shadow-green-400/50' 
                  : 'bg-orange-500 hover:bg-orange-600'
              }`}
              onMouseDown={() => handleInputChange('accelerate', true)}
              onMouseUp={() => handleInputChange('accelerate', false)}
              onMouseLeave={() => handleInputChange('accelerate', false)}
            >
              🚀 Accelerate
            </button>
          </div>
          <div>
            <button
              className={`w-20 h-20 rounded-full font-bold transition-all ${
                inputState.nitro 
                  ? 'bg-red-500 shadow-lg shadow-red-400/50 animate-pulse' 
                  : 'bg-green-500 hover:bg-green-600'
              }`}
              onMouseDown={() => handleInputChange('nitro', true)}
              onMouseUp={() => handleInputChange('nitro', false)}
              onMouseLeave={() => handleInputChange('nitro', false)}
            >
              💨<br/>NITRO
            </button>
          </div>
        </div>

        {/* Connection Status */}
        <div className="absolute bottom-4 left-4 bg-black/80 p-4 rounded-lg border-2 border-orange-500">
          <div className="text-sm mb-2">
            Status: <span className={connected ? 'text-green-400' : 'text-red-400'}>{connectionStatus}</span>
          </div>
          {!connected && (
            <button
              onClick={connectToServer}
              className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded font-bold transition-all"
            >
              Connect to Server
            </button>
          )}
        </div>

        {/* Instructions */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/80 p-4 rounded-lg border-2 border-orange-500 max-w-sm text-center">
          <h4 className="text-orange-400 font-bold mb-2">🎮 Controls</h4>
          <p className="text-sm">
            <strong>WASD</strong> or <strong>Arrow Keys</strong>: Move<br/>
            <strong>Shift</strong> or <strong>N</strong>: Nitro<br/>
            <strong>Space</strong>: Accelerate
          </p>
        </div>

        {/* Game Status Modal */}
        {(!gameState.gameStarted || gameState.gameEnded) && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-black/90 p-8 rounded-lg border-3 border-orange-500 text-center">
              <div className="text-2xl font-bold mb-4">
                {gameState.gameEnded ? gameState.winner : 'Racing Game Demo'}
              </div>
              <div className="mb-4">
                {gameState.gameEnded ? 'Game Over!' : 'Ready to race?'}
              </div>
              <button
                onClick={startGame}
                className="bg-orange-500 hover:bg-orange-600 px-6 py-3 rounded font-bold transition-all"
              >
                {gameState.gameEnded ? 'Play Again' : 'Start Race'}
              </button>
            </div>
          </div>
        )}

        {/* Respawn Overlay */}
        {playerCar.isRespawning && (
          <div className="absolute inset-0 bg-red-500/30 flex items-center justify-center">
            <div className="text-6xl font-bold animate-pulse">
              RESPAWNING...
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RacingGameApp;