import React, { useState, useEffect, useRef } from 'react';
import { Client } from 'colyseus.js';

function Lobby({ onJoin }) {
    const [name, setName] = useState('');

    return (
        <div className="max-w-md mx-auto mt-20 p-6 bg-gray-800 rounded-lg shadow-lg">
            <h1 className="text-2xl font-bold mb-4 text-center">Basketball Game</h1>
            <div className="mb-4">
                <label className="block mb-2">Player Name:</label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 rounded"
                    placeholder="Enter your name"
                />
            </div>
            <button
                onClick={() => onJoin(name || `Player${Math.floor(Math.random() * 100)}`)}
                className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded"
            >
                Join Game
            </button>
        </div>
    );
}

function GameCanvas({ gameState }) {
    const canvasRef = useRef(null);
    const animationRef = useRef();
    const width = 800;
    const height = 500;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const draw = () => {
            // Clear canvas
            ctx.clearRect(0, 0, width, height);

            // Draw court
            ctx.fillStyle = '#2e7d32';
            ctx.fillRect(0, 0, width, height);

            // Draw court markings
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(width / 2, height - 50, 100, 0, Math.PI, true);
            ctx.stroke();

            // Draw basket
            if (gameState?.basket) {
                ctx.fillStyle = '#ff9800';
                ctx.fillRect(
                    gameState.basket.x - gameState.basket.width / 2,
                    gameState.basket.y,
                    gameState.basket.width,
                    gameState.basket.height
                );

                // Draw backboard
                ctx.fillStyle = '#795548';
                ctx.fillRect(
                    gameState.basket.x - 5,
                    gameState.basket.y - 40,
                    10,
                    40
                );
            }

            // Draw ball
            if (gameState?.ball) {
                ctx.fillStyle = '#ff5722';
                ctx.beginPath();
                ctx.arc(gameState.ball.x, gameState.ball.y, 15, 0, Math.PI * 2);
                ctx.fill();

                // Draw shooting trajectory
                if (!gameState.ball.isFlying && gameState.currentPlayer) {
                    // Find current player
                    const players = gameState.players instanceof Map ?
                        Array.from(gameState.players.values()) :
                        Object.values(gameState.players);

                    const player = players.find(p => p.id === gameState.currentPlayer);

                    if (player) {
                        const rad = (player.angle * Math.PI) / 180;
                        const power = player.power * 0.3;

                        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
                        ctx.beginPath();
                        ctx.moveTo(gameState.ball.x, gameState.ball.y);

                        // Simulate trajectory
                        let x = gameState.ball.x;
                        let y = gameState.ball.y;
                        let vx = Math.cos(rad) * power;
                        let vy = -Math.sin(rad) * power;

                        for (let i = 0; i < 100; i++) {
                            vy += gameState.gravity || 0.5;
                            vx *= gameState.airResistance || 0.99;
                            vy *= gameState.airResistance || 0.99;
                            x += vx;
                            y += vy;

                            ctx.lineTo(x, y);
                            if (y > height) break;
                        }
                        ctx.stroke();
                    }
                }
            }

            animationRef.current = requestAnimationFrame(draw);
        };

        animationRef.current = requestAnimationFrame(draw);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [gameState]);

    return (
        <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg">
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                className="w-full"
            />
        </div>
    );
}

function GameControls({ room, gameState, playerName }) {
    const [power, setPower] = useState(50);
    const [angle, setAngle] = useState(45);

    // Handle MapSchema or plain object
    const players = gameState.players instanceof Map ?
        Array.from(gameState.players.values()) :
        Object.values(gameState.players);

    const currentPlayerId = gameState.currentPlayer;
    const isCurrentPlayer = currentPlayerId === room.sessionId;

    // Find current player
    const player = players.find(p => p.id === room.sessionId);
    const currentPlayer = players.find(p => p.id === currentPlayerId);

    useEffect(() => {
        if (isCurrentPlayer) {
            room.send('setPower', power);
        }
    }, [power, isCurrentPlayer, room]);

    useEffect(() => {
        if (isCurrentPlayer) {
            room.send('setAngle', angle);
        }
    }, [angle, isCurrentPlayer, room]);

    const handleShoot = () => {
        if (isCurrentPlayer && player?.shotsRemaining > 0) {
            room.send('shoot');
        }
    };

    const handleReady = () => {
        room.send('ready');
    };

    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4">Controls</h2>

            {!gameState.gameStarted ? (
                <button
                    onClick={handleReady}
                    disabled={player?.isReady}
                    className={`w-full py-2 rounded ${player?.isReady
                        ? 'bg-gray-600'
                        : 'bg-green-600 hover:bg-green-700'
                        }`}
                >
                    {player?.isReady ? 'Waiting for others...' : 'Ready Up'}
                </button>
            ) : (
                <>
                    {isCurrentPlayer ? (
                        <>
                            <div className="mb-4">
                                <label className="block mb-2">
                                    Power: {power}%
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={power}
                                    onChange={(e) => setPower(parseInt(e.target.value))}
                                    className="w-full"
                                />
                            </div>

                            <div className="mb-4">
                                <label className="block mb-2">
                                    Angle: {angle}°
                                </label>
                                <input
                                    type="range"
                                    min="15"
                                    max="75"
                                    value={angle}
                                    onChange={(e) => setAngle(parseInt(e.target.value))}
                                    className="w-full"
                                />
                            </div>

                            <button
                                onClick={handleShoot}
                                disabled={!player || player.shotsRemaining <= 0}
                                className={`w-full py-2 rounded ${!player || player.shotsRemaining <= 0
                                    ? 'bg-gray-600'
                                    : 'bg-blue-600 hover:bg-blue-700'
                                    }`}
                            >
                                {player
                                    ? `Shoot (${player.shotsRemaining} left)`
                                    : 'Not your turn'}
                            </button>
                        </>
                    ) : (
                        <div className="text-center py-4">
                            {currentPlayer ? `${currentPlayer.name}'s turn` : 'Preparing game...'}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function GameInfo({ gameState, playerName }) {
    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    // Handle MapSchema or plain object
    const players = gameState.players instanceof Map ?
        Array.from(gameState.players.values()) :
        Object.values(gameState.players);

    return (
        <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
            <h2 className="text-xl font-bold mb-4">Game Info</h2>

            <div className="mb-4">
                <div className="flex justify-between mb-2">
                    <span>Time Remaining:</span>
                    <span className="font-mono">{formatTime(gameState.timeRemaining)}</span>
                </div>

                <div className="w-full bg-gray-700 h-2 rounded-full">
                    <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${(gameState.timeRemaining / 60) * 100}%` }}
                    ></div>
                </div>
            </div>

            <div>
                <h3 className="font-bold mb-2">Players:</h3>
                <ul>
                    {players.map((player) => (
                        <li
                            key={player.id}
                            className={`flex justify-between py-1 px-2 rounded ${player.name === playerName ? 'bg-gray-700' : ''
                                }`}
                        >
                            <span>
                                {player.name}
                                {gameState.currentPlayer === player.id && ' 🏀'}
                            </span>
                            <span className="font-bold">{player.score}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

function GameRoom({ room, playerName }) {
    const [gameState, setGameState] = useState(null);
    const [message, setMessage] = useState('');
    const gameStateRef = useRef();

    // Store state in ref for smooth animations
    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    useEffect(() => {
        if (!room) return;

        // Set initial state when joining
        room.onStateChange((state) => {
            setGameState(state);
        });

        room.onMessage('welcome', (message) => {
            setMessage(message.message);
            setTimeout(() => setMessage(''), 3000);
        });

        room.onMessage('score', (message) => {
            setMessage(message.message);
            setTimeout(() => setMessage(''), 3000);
        });

        room.onMessage('gameStarted', (message) => {
            setMessage(message.message);
        });

        room.onMessage('gameEnded', (message) => {
            const winnerScore = Math.max(...message.finalScores.map(s => s.score));
            setMessage(`${message.winner} wins with ${winnerScore} points!`);
        });

        room.onMessage('gameReset', (message) => {
            setMessage(message.message);
        });

        return () => {
            room.leave();
        };
    }, [room]);

    if (!gameState) return <div className="text-center py-10">Loading game...</div>;

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-4 text-center h-8">
                {message && <div className="text-xl text-yellow-400">{message}</div>}
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                    <GameCanvas gameState={gameStateRef.current || gameState} />
                </div>

                <div className="md:w-80 flex flex-col gap-4">
                    <GameInfo gameState={gameState} playerName={playerName} />
                    <GameControls room={room} gameState={gameState} playerName={playerName} />
                </div>
            </div>
        </div>
    );
}

function App() {
    const [client] = useState(() => new Client('ws://localhost:2567'));
    const [room, setRoom] = useState(null);
    const [playerName, setPlayerName] = useState('');

    const joinRoom = async (name) => {
        try {
            const room = await client.joinOrCreate('basketball_room', { name });
            setRoom(room);
            setPlayerName(name);
        } catch (e) {
            console.error('Join error:', e);
            alert('Failed to join game. Is the server running?');
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4">
            {!room ? (
                <Lobby onJoin={joinRoom} />
            ) : (
                <GameRoom room={room} playerName={playerName} />
            )}
        </div>
    );
}

export default App;