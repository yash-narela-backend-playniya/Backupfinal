import React, { useEffect, useState } from 'react';

const Timer = ({ currentTime }) => {
  const [time, setTime] = useState(currentTime);
  
  useEffect(() => {
    setTime(currentTime);
  }, [currentTime]);
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  return (
    <div className={`timer ${time < 10 ? 'warning' : ''}`}>
      ⏱️ {formatTime(time)}
    </div>
  );
};

export default Timer;