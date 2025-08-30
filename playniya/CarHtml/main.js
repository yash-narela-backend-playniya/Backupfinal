const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const laneCount = 3;
const roadWidth = canvas.width;
const laneWidth = roadWidth / laneCount;
const carWidth = 60;
const carHeight = 120;

let sessionId = null;
let myPlayer = null;
let players = {};
let obstacles = [];
let countdown = "Waiting...";

const client = new Colyseus.Client("ws://localhost:2567");

client.joinOrCreate("race", {
  uniqueId: "user_" + Math.floor(Math.random() * 10000),
  matchOptionId: "some_id", // replace with real one
  useBonus: false,
  userId: "u_" + Math.floor(Math.random() * 10000),
})
.then(room => {
  console.log("joined!", room.sessionId);
  sessionId = room.sessionId;

  room.onStateChange(state => {
    players = state.players;
    obstacles = state.obstacles;
    myPlayer = players[sessionId];
    document.getElementById("score").innerText = myPlayer?.score ?? 0;
    document.getElementById("speed").innerText = myPlayer?.speed ?? 0;
  });

  room.onMessage("countdown", data => {
    countdown = data.countdown;
    document.getElementById("countdown").innerText = countdown;
  });

  // Controls
  window.addEventListener("keydown", e => {
    if (!myPlayer) return;

    if (e.key === "ArrowLeft" && myPlayer.lane > 0) {
      room.send("move", { lane: myPlayer.lane - 1 });
    } else if (e.key === "ArrowRight" && myPlayer.lane < laneCount - 1) {
      room.send("move", { lane: myPlayer.lane + 1 });
    } else if (e.key === "ArrowUp") {
      const newSpeed = Math.min(myPlayer.speed + 20, 500);
      room.send("accelerate", { speed: newSpeed });
    } else if (e.key === "ArrowDown") {
      const newSpeed = Math.max(myPlayer.speed - 20, 200);
      room.send("accelerate", { speed: newSpeed });
    }
  });

  // Render loop
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Road
    ctx.fillStyle = "#222";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw lanes
    ctx.strokeStyle = "#555";
    for (let i = 1; i < laneCount; i++) {
      ctx.beginPath();
      ctx.moveTo(i * laneWidth, 0);
      ctx.lineTo(i * laneWidth, canvas.height);
      ctx.stroke();
    }

    // Draw obstacles
    ctx.fillStyle = "red";
    for (let obs of obstacles) {
      ctx.fillRect(obs.x - carWidth/2, obs.y - carHeight/2, carWidth, carHeight);
    }

    // Draw players
    for (let sid in players) {
      const player = players[sid];
      if (player.isGameOver) continue;

      ctx.fillStyle = sid === sessionId ? "lime" : "blue";
      ctx.fillRect(player.x - carWidth/2, player.y - carHeight/2, carWidth, carHeight);
    }

    requestAnimationFrame(draw);
  }

  draw();
});
