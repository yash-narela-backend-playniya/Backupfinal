import React, { useEffect, useRef, useState } from "react";
import { Client } from "colyseus.js";

const client = new Client("ws://localhost:2567");

function App() {
  const [room, setRoom] = useState(null);
  const [ball, setBall] = useState({ x: 0, y: 0 });
  const [hoop, setHoop] = useState({ x: 700, y: 300 });
  const canvasRef = useRef();

  useEffect(() => {
    async function connect() {
      try {
        const room = await client.joinOrCreate("arcade_basketball");
        console.log("✅ Joined room:", room.sessionId);
        setRoom(room);      

        room.state.onChange = (changes) => {
          for (const change of changes) {
            switch (change.field) {
              case "ball":
                const ballRef = change.value;
                ballRef.onChange = () => {
                  setBall({ x: ballRef.x, y: ballRef.y });
                  console.log("🎯 Ball:", ballRef.x.toFixed(2), ballRef.y.toFixed(2));
                };
                break;

              case "hoop":
                const hoopRef = change.value;
                hoopRef.onChange = () => {
                  setHoop({ x: hoopRef.x, y: hoopRef.y });
                  console.log("🕳️ Hoop:", hoopRef.x.toFixed(2), hoopRef.y.toFixed(2));
                };
                break;

              case "scores":
                const scores = change.value;
                scores.onAdd = (val, key) => {
                  console.log("🏅 Score added:", key, val);
                };
                scores.onChange = (val, key) => {
                  console.log("📈 Score updated:", key, val);
                };
                break;
            }
          }
        };
      } catch (err) {
        console.error("❌ Failed to join room:", err);
      }
    }

    connect();
  }, []);

  const shoot = () => {
    if (!room) return;
    const angle = Math.PI / 4; // 45 degrees
    const power = 0.9;
    console.log("🚀 Shooting — angle:", angle.toFixed(2), "power:", power);
    room.send("shoot", { angle, power });
  };

  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");

    const draw = () => {
      ctx.clearRect(0, 0, 1200, 800);

      // Ball
      ctx.fillStyle = "orange";
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, 15, 0, 2 * Math.PI);
      ctx.fill();

      // Hoop
      ctx.fillStyle = "red";
      ctx.fillRect(hoop.x - 30, hoop.y - 5, 60, 10);
    };

    const interval = setInterval(draw, 1000 / 60);
    return () => clearInterval(interval);
  }, [ball, hoop]);

  return (
    <div style={{ textAlign: "center", marginTop: "20px" }}>
      <h2>🏀 Arcade Basketball</h2>
      <canvas
        ref={canvasRef}
        width={1200}
        height={800}
        style={{ border: "2px solid black" }}
      />
      <br />
      <button onClick={shoot}>Shoot Ball</button>
    </div>
  );
}

export default App;
