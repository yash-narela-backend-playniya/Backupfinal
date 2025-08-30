import React from 'react';
import Timer from './Timer';

const PlayerInfo = ({ player, symbol, isCurrent, isYou }) => {
  if (!player) return <div className="player-info empty">Waiting for player...</div>;
  
  return (
    <div className={`player-info ${isCurrent ? 'active' : ''} ${isYou ? 'you' : ''}`}>
      <div className="player-symbol" data-symbol={symbol}>{symbol}</div>
      <div className="player-details">
        <div className="player-id">{player.uniqueId}</div>
        {isYou && <span className="you-indicator">(You)</span>}
      </div>
      <div className="player-timer">
        <Timer currentTime={player.timeRemaining} />
      </div>
    </div>
  );
};

export default PlayerInfo;