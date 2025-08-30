import React from 'react';
import PlayerInfo from './PlayerInfo';
import Timer from './Timer';

const GameBoard = ({ gameState, playerInfo, onMove, onRematch, onExit }) => {
  if (!gameState || !playerInfo) {
    return <div className="loading">Loading game data...</div>;
  }

  const isCurrentPlayer = gameState.currentTurn === playerInfo.sessionId;
  const playerSymbol = playerInfo.sessionId === gameState.playerX ? 'X' : 'O';
  const isWinner = gameState.winner === playerInfo.sessionId;
  
  // Get player data safely
  const playerXData = gameState.playerX ? gameState.players[gameState.playerX] : null;
  const playerOData = gameState.playerO ? gameState.players[gameState.playerO] : null;
  const currentPlayerData = gameState.players[playerInfo.sessionId];
  
  const renderCell = (index) => {
    const value = gameState.board[index];
    
    // Win highlighting logic
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
      [0, 4, 8], [2, 4, 6] // diagonals
    ];
    
    const isWinningCell = gameState.winner && winPatterns.some(pattern => {
      const [a, b, c] = pattern;
      return pattern.includes(index) && 
             gameState.board[a] && 
             gameState.board[a] === gameState.board[b] && 
             gameState.board[b] === gameState.board[c];
    });

    return (
      <div 
        key={index}
        className={`cell ${value ? 'occupied' : ''} ${isWinningCell ? 'winning' : ''}`}
        data-value={value}
        onClick={() => {
          if (!value && isCurrentPlayer && gameState.gameStatus === 'in-progress') {
            onMove(index);
          }
        }}
      >
        {value}
      </div>
    );
  };

  return (
    <div className="game-container">
      <div className="game-header">
        <h2>
          {gameState.gameStatus === 'waiting' && 'Waiting for players...'}
          {gameState.gameStatus === 'in-progress' && 'Game in progress'}
          {gameState.gameStatus === 'finished' && (
            isWinner ? 'You Win!' : 'Game Over'
          )}
        </h2>
        
        <div className="bet-info">
          Bet: ${gameState.betAmount} | Prize: ${gameState.winAmount}
        </div>
      </div>
      
      <div className="players-container">
        <PlayerInfo 
          player={playerXData} 
          symbol="X"
          isCurrent={gameState.currentTurn === gameState.playerX}
          isYou={playerInfo.sessionId === gameState.playerX}
        />
        
        <div className="board">
          {Array(9).fill().map((_, index) => renderCell(index))}
        </div>
        
        <PlayerInfo 
          player={playerOData} 
          symbol="O"
          isCurrent={gameState.currentTurn === gameState.playerO}
          isYou={playerInfo.sessionId === gameState.playerO}
        />
      </div>
      
      {gameState.gameStatus === 'in-progress' && isCurrentPlayer && (
        <div className="turn-indicator">
          <h3>Your Turn ({playerSymbol})</h3>
          <Timer 
            initialTime={gameState.timePerPlayer} 
            currentTime={currentPlayerData?.timeRemaining} 
          />
        </div>
      )}
      
      {gameState.gameStatus === 'finished' && (
        <div className="game-result">
          <div className="result-message">
            {isWinner ? (
              <h2 className="win-text">🎉 You won ${gameState.winAmount}! 🎉</h2>
            ) : (
              <h2 className="lose-text">Better luck next time!</h2>
            )}
          </div>
          
          <div className="action-buttons">
            <button onClick={onRematch}>Rematch</button>
            <button onClick={onExit}>Exit to Lobby</button>
          </div>
          
          {gameState.rematchOffered && (
            <div className="rematch-notice">
              Rematch requested by opponent
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GameBoard;