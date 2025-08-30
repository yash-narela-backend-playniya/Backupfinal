import React, { useState, useEffect } from 'react';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  const [gameState, setGameState] = useState(null);
  const [socket, setSocket] = useState(null);
  const [playerInfo, setPlayerInfo] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    return () => {
      if (socket) socket.close();
    };
  }, [socket]);

  const handleJoin = (options) => {
    const ws = new WebSocket('ws://localhost:8000');
    
    ws.onopen = () => {
      console.log('Connected to relay server');
      ws.send(JSON.stringify({
        type: 'join',
        data: {
          uniqueId: options.uniqueId,
          roomName: 'tictactoev2',
          useBonus: options.useBonus,
          userId: options.userId,
          matchOptionId: options.matchOptionId
        }
      }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('Received:', message.type);
      
      switch (message.type) {
        case 'joined':
          setPlayerInfo({
            sessionId: message.data.sessionId,
            roomId: message.data.roomId
          });
          break;
          
        case 'update':
          setGameState(message.data);
          break;
          
        case 'gameOver':
          setGameState(prev => ({
            ...prev,
            winner: message.data.winner,
            gameStatus: 'finished'
          }));
          break;
          
        case 'error':
          setError(message.data);
          break;
          
        case 'left':
          setGameState(null);
          setPlayerInfo(null);
          break;
          
        case 'rematchOffered':
          setGameState(prev => ({ ...prev, rematchOffered: true }));
          break;
          
        default:
          console.log('Unhandled message:', message);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setError('Connection error');
    };

    setSocket(ws);
  };

  const handleMove = (position) => {
    if (socket) {
      socket.send(JSON.stringify({
        type: 'move',
        data: { position }
      }));
    }
  };

  const handleRematch = () => {
    if (socket) {
      socket.send(JSON.stringify({ type: 'rematch' }));
    }
  };

  const handleExit = () => {
    if (socket) {
      socket.send(JSON.stringify({ type: 'exit' }));
      socket.close();
      setSocket(null);
    }
    setGameState(null);
    setPlayerInfo(null);
  };

  return (
    <div className="app">
      <h1>Tic Tac Toe Tournament</h1>
      
      {error && <div className="error">{error}</div>}
      
      <ErrorBoundary>
        {!gameState ? (
          <Lobby onJoin={handleJoin} />
        ) : (
          <GameBoard 
            gameState={gameState} 
            playerInfo={playerInfo}
            onMove={handleMove}
            onRematch={handleRematch}
            onExit={handleExit}
          />
        )}
      </ErrorBoundary>
    </div>
  );
}

export default App;