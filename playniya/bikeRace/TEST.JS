// Move left/right
socket.send(JSON.stringify({ type: "move", data: { direction: "left" } }));
{ direction: "left" } 
// Accelerate
socket.send(JSON.stringify({ type: "accelerate" }));

// Brake
socket.send(JSON.stringify({ type: "brake" }));




{
  "type": "join",
  "data": {
    "name": "Racer Yash",
    "uniqueId": "user123",
    "matchOptionId": "match-789"
  }
}


{
  "type": "move",
  "data": {
    "direction": "left"
  }
}
{
  "type": "move",
  "data": {
    "direction": "right"
  }
}
{
  "type": "accelerate"
}
{
  "type": "brake"
}
