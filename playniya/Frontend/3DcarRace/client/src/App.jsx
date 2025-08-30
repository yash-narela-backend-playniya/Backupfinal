import React, { useState, useEffect, useRef } from 'react';

const CarRacingGame = () => {
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const [gameState, setGameState] = useState({ cars: new Map() });
  const [connected, setConnected] = useState(false);
  const [mySessionId, setMySessionId] = useState(null);
  const keysPressed = useRef({});

  // Define racing track path
  const trackPath = [
    { x: 100, y: 300 },
    { x: 200, y: 200 },
    { x: 350, y: 150 },
    { x: 500, y: 100 },
    { x: 650, y: 120 },
    { x: 750, y: 200 },
    { x: 780, y: 350 },
    { x: 750, y: 500 },
    { x: 650, y: 550 },
    { x: 500, y: 580 },
    { x: 350, y: 550 },
    { x: 200, y: 500 },
    { x: 150, y: 400 },
    { x: 100, y: 300 }
  ];

  // Create track boundaries
  const createTrackBoundaries = () => {
    const trackWidth = 80;
    const innerTrack = [];
    const outerTrack = [];

    for (let i = 0; i < trackPath.length; i++) {
      const current = trackPath[i];
      const next = trackPath[(i + 1) % trackPath.length];
      const prev = trackPath[i === 0 ? trackPath.length - 1 : i - 1];

      // Calculate perpendicular vector for track width
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const perpX = -dy / length;
      const perpY = dx / length;

      innerTrack.push({
        x: current.x + perpX * (trackWidth / 2),
        y: current.y + perpY * (trackWidth / 2)
      });

      outerTrack.push({
        x: current.x - perpX * (trackWidth / 2),
        y: current.y - perpY * (trackWidth / 2)
      });
    }

    return { inner: innerTrack, outer: outerTrack };
  };

  const trackBoundaries = createTrackBoundaries();

  // Check if point is inside track
  const isPointInTrack = (x, y) => {
    const isInsideOuter = isPointInPolygon(x, y, trackBoundaries.outer);
    const isInsideInner = isPointInPolygon(x, y, trackBoundaries.inner);
    return isInsideOuter && !isInsideInner;
  };

  // Point in polygon algorithm
  const isPointInPolygon = (x, y, polygon) => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  };

  // Get closest point on track
  const getClosestTrackPoint = (x, y) => {
    let minDistance = Infinity;
    let closestPoint = trackPath[0];

    for (let i = 0; i < trackPath.length; i++) {
      const point = trackPath[i];
      const distance = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = point;
      }
    }

    return closestPoint;
  };

  // Initialize WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const ws = new WebSocket('ws://localhost:3001');
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected');
          ws.send(JSON.stringify({ type: 'join', room: 'game' }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'room_joined') {
              setMySessionId(data.sessionId);
              setConnected(true);
            } else if (data.type === 'state_update') {
              const carsMap = new Map();
              Object.entries(data.state.cars || {}).forEach(([sessionId, car]) => {
                carsMap.set(sessionId, car);
              });
              setGameState({ cars: carsMap });
            }
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected');
          setConnected(false);
          setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e) => {
      keysPressed.current[e.key] = true;
      e.preventDefault();
    };

    const handleKeyUp = (e) => {
      keysPressed.current[e.key] = false;
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Send input to server
  useEffect(() => {
    if (!connected || !wsRef.current) return;

    const sendInput = () => {
      const input = {
        left: keysPressed.current['ArrowLeft'] || keysPressed.current['a'] || keysPressed.current['A'],
        right: keysPressed.current['ArrowRight'] || keysPressed.current['d'] || keysPressed.current['D'],
        accelerate: keysPressed.current['ArrowUp'] || keysPressed.current['w'] || keysPressed.current['W'],
        brake: keysPressed.current['ArrowDown'] || keysPressed.current['s'] || keysPressed.current['S'],
        nitro: keysPressed.current[' '] || keysPressed.current['Shift']
      };

      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'input',
          data: input
        }));
      }
    };

    const interval = setInterval(sendInput, 16);
    return () => clearInterval(interval);
  }, [connected]);

  // Draw track
  const drawTrack = (ctx) => {
    // Draw grass background
    ctx.fillStyle = '#2d5a27';
    ctx.fillRect(0, 0, 800, 600);

    // Draw track surface
    ctx.fillStyle = '#404040';
    ctx.beginPath();
    ctx.moveTo(trackBoundaries.outer[0].x, trackBoundaries.outer[0].y);
    trackBoundaries.outer.forEach(point => {
      ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.fill();

    // Cut out inner track
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(trackBoundaries.inner[0].x, trackBoundaries.inner[0].y);
    trackBoundaries.inner.forEach(point => {
      ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    // Draw track boundaries
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(trackBoundaries.outer[0].x, trackBoundaries.outer[0].y);
    trackBoundaries.outer.forEach(point => {
      ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(trackBoundaries.inner[0].x, trackBoundaries.inner[0].y);
    trackBoundaries.inner.forEach(point => {
      ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.stroke();

    // Draw center line
    ctx.strokeStyle = '#ffff00';
    ctx.lineWidth = 2;
    ctx.setLineDash([15, 10]);
    ctx.beginPath();
    ctx.moveTo(trackPath[0].x, trackPath[0].y);
    trackPath.forEach(point => {
      ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw start/finish line
    const startPoint = trackPath[0];
    const nextPoint = trackPath[1];
    const dx = nextPoint.x - startPoint.x;
    const dy = nextPoint.y - startPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const perpX = -dy / length;
    const perpY = dx / length;

    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(
      startPoint.x + perpX * 40,
      startPoint.y + perpY * 40
    );
    ctx.lineTo(
      startPoint.x - perpX * 40,
      startPoint.y - perpY * 40
    );
    ctx.stroke();

    // Draw checkered pattern on start line
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 8; i++) {
      if (i % 2 === 0) {
        ctx.fillRect(
          startPoint.x + perpX * (40 - i * 10) - 5,
          startPoint.y + perpY * (40 - i * 10) - 2,
          10, 4
        );
      }
    }
  };

  // Render game
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Draw track
    drawTrack(ctx);

    // Draw cars
    gameState.cars.forEach((car, sessionId) => {
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.rotation);

      // Car shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(-16, -9, 32, 18);

      // Car body
      ctx.fillStyle = sessionId === mySessionId ? '#ff4444' : '#4444ff';
      ctx.fillRect(-15, -8, 30, 16);
      
      // Car details
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(12, -6, 4, 12); // Front bumper
      ctx.fillRect(-16, -3, 3, 6); // Rear bumper
      
      // Windows
      ctx.fillStyle = '#87ceeb';
      ctx.fillRect(-8, -6, 16, 12);
      
      // Wheels
      ctx.fillStyle = '#000000';
      ctx.fillRect(-12, -10, 4, 3);
      ctx.fillRect(-12, 7, 4, 3);
      ctx.fillRect(8, -10, 4, 3);
      ctx.fillRect(8, 7, 4, 3);

      // Speed lines
      if (car.speed > 2) {
        ctx.strokeStyle = '#ffff00';
        ctx.lineWidth = 2;
        const speedLines = Math.floor(car.speed);
        for (let i = 0; i < speedLines; i++) {
          ctx.beginPath();
          ctx.moveTo(-20 - i * 8, -2 + i * 2);
          ctx.lineTo(-25 - i * 8, -2 + i * 2);
          ctx.stroke();
        }
      }

      ctx.restore();

      // Draw nitro bar and speed indicator for player
      if (sessionId === mySessionId) {
        // Nitro bar
        ctx.fillStyle = '#000000';
        ctx.fillRect(car.x - 20, car.y - 30, 40, 6);
        ctx.fillStyle = car.nitro > 20 ? '#00ff00' : '#ff0000';
        ctx.fillRect(car.x - 20, car.y - 30, (car.nitro / 100) * 40, 6);
        
        // Speed indicator
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.fillText(`${Math.floor(car.speed * 20)} km/h`, car.x - 25, car.y - 35);
      }
    });

    // Draw UI
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Arial';
    ctx.fillText('🏁 Racing Track', 10, 30);
    ctx.fillText('Controls: WASD/Arrows', 10, 50);
    ctx.fillText('Nitro: Space/Shift', 10, 70);
    
    if (mySessionId && gameState.cars.has(mySessionId)) {
      const myCar = gameState.cars.get(mySessionId);
      ctx.fillText(`Speed: ${(myCar.speed * 20).toFixed(0)} km/h`, 10, 100);
      ctx.fillText(`Nitro: ${myCar.nitro.toFixed(0)}%`, 10, 120);
      
      // Track position warning
      if (!isPointInTrack(myCar.x, myCar.y)) {
        ctx.fillStyle = '#ff0000';
        ctx.font = '20px Arial';
        ctx.fillText('⚠️ OFF TRACK!', 10, 150);
      }
    }

    // Connection status
    if (!connected) {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.8)';
      ctx.fillRect(canvas.width/2 - 100, canvas.height/2 - 25, 200, 50);
      ctx.fillStyle = '#ffffff';
      ctx.font = '18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Disconnected', canvas.width/2, canvas.height/2 - 5);
      ctx.fillText('Reconnecting...', canvas.width/2, canvas.height/2 + 15);
      ctx.textAlign = 'left';
    }

  }, [gameState, mySessionId, connected]);

  // Simulate local car movement when disconnected
  useEffect(() => {
    if (connected) return;

    const simulateLocalCar = () => {
      const localCar = {
        x: trackPath[0].x,
        y: trackPath[0].y,
        rotation: 0,
        speed: 0,
        nitro: 100
      };

      const updateLocalCar = () => {
        const input = {
          left: keysPressed.current['ArrowLeft'] || keysPressed.current['a'] || keysPressed.current['A'],
          right: keysPressed.current['ArrowRight'] || keysPressed.current['d'] || keysPressed.current['D'],
          accelerate: keysPressed.current['ArrowUp'] || keysPressed.current['w'] || keysPressed.current['W'],
          brake: keysPressed.current['ArrowDown'] || keysPressed.current['s'] || keysPressed.current['S'],
          nitro: keysPressed.current[' '] || keysPressed.current['Shift']
        };

        // Realistic car physics
        if (input.left) localCar.rotation -= 0.08 * Math.max(0.3, localCar.speed / 5);
        if (input.right) localCar.rotation += 0.08 * Math.max(0.3, localCar.speed / 5);
        if (input.accelerate) localCar.speed = Math.min(6, localCar.speed + 0.15);
        if (input.brake) localCar.speed = Math.max(0, localCar.speed - 0.3);
        if (input.nitro && localCar.nitro > 0) {
          localCar.speed = Math.min(9, localCar.speed + 0.25);
          localCar.nitro = Math.max(0, localCar.nitro - 2);
        }

        // Movement
        const newX = localCar.x + Math.cos(localCar.rotation) * localCar.speed;
        const newY = localCar.y + Math.sin(localCar.rotation) * localCar.speed;

        // Check track boundaries
        if (isPointInTrack(newX, newY)) {
          localCar.x = newX;
          localCar.y = newY;
        } else {
          // Collision with track boundary - reduce speed significantly
          localCar.speed *= 0.3;
          // Push car back toward track
          const closestPoint = getClosestTrackPoint(localCar.x, localCar.y);
          const pushX = (closestPoint.x - localCar.x) * 0.1;
          const pushY = (closestPoint.y - localCar.y) * 0.1;
          localCar.x += pushX;
          localCar.y += pushY;
        }

        // Natural deceleration
        localCar.speed = Math.max(0, localCar.speed - 0.02);
        
        // Nitro regeneration
        if (localCar.nitro < 100) {
          localCar.nitro = Math.min(100, localCar.nitro + 0.3);
        }

        const carsMap = new Map();
        carsMap.set('local', localCar);
        setGameState({ cars: carsMap });
        setMySessionId('local');
      };

      const interval = setInterval(updateLocalCar, 16);
      return () => clearInterval(interval);
    };

    const cleanup = simulateLocalCar();
    return cleanup;
  }, [connected]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 p-4">
      <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
        <h1 className="text-3xl font-bold text-white mb-4 text-center">
          🏎️ Racing Track Challenge
        </h1>
        
        <div className="mb-4 text-center">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            connected ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {connected ? 'Connected' : 'Offline Mode'}
          </span>
        </div>

        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="border border-gray-600 rounded bg-green-800"
          tabIndex={0}
        />
        
        <div className="mt-4 text-gray-300 text-sm text-center">
          <p>🎮 WASD or Arrow Keys to control your car</p>
          <p>🚀 Space or Shift for Nitro boost</p>
          <p>🏁 Stay on track for maximum speed!</p>
          <p>⚠️ Going off-track will slow you down</p>
          {!connected && (
            <p className="text-yellow-400 mt-2">
              🔧 Playing offline - start backend server for multiplayer!
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CarRacingGame;