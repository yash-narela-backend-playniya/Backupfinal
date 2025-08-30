import React, { useState } from 'react';

const Lobby = ({ onJoin }) => {
  const [uniqueId, setUniqueId] = useState('');
  const [matchOptionId, setMatchOptionId] = useState('');
  const [useBonus, setUseBonus] = useState(false);
  const [userId, setUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    onJoin({
      uniqueId: uniqueId || `user_${Date.now()}`,
      matchOptionId,
      useBonus,
      userId: userId || `user_${Math.floor(Math.random() * 1000)}`
    });
  };

  return (
    <div className="lobby">
      <h2>Join Game</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>User ID:</label>
          <input 
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Enter your user ID"
          />
        </div>
        
        <div className="form-group">
          <label>Unique ID:</label>
          <input 
            type="text"
            value={uniqueId}
            onChange={(e) => setUniqueId(e.target.value)}
            placeholder="Leave blank to generate"
          />
        </div>
        
        <div className="form-group">
          <label>Match Option ID:</label>
          <input 
            type="text"
            value={matchOptionId}
            onChange={(e) => setMatchOptionId(e.target.value)}
            placeholder="Enter match option ID"
            required
          />
        </div>
        
        <div className="form-group checkbox">
          <label>
            <input 
              type="checkbox"
              checked={useBonus}
              onChange={(e) => setUseBonus(e.target.checked)}
            />
            Use Bonus Coins
          </label>
        </div>
        
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Joining...' : 'Join Game'}
        </button>
      </form>
      
      <div className="instructions">
        <h3>How to Play:</h3>
        <ul>
          <li>Get match option ID from tournament lobby</li>
          <li>Player X goes first</li>
          <li>Complete a row, column, or diagonal to win</li>
          <li>90 seconds per move</li>
        </ul>
      </div>
    </div>
  );
};

export default Lobby;