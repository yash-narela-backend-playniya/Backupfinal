const colyseus = require("colyseus.js");

const client1 = new colyseus.Client("ws://localhost:2567");
const client2 = new colyseus.Client("ws://localhost:2567");

async function simulateGame() {
  try {
    const room1 = await client1.joinOrCreate("tic-tac-toe");
    console.log(`Player 1 (${room1.sessionId}) joined`);

    const room2 = await client2.joinOrCreate("tic-tac-toe");
    console.log(`Player 2 (${room2.sessionId}) joined`);

    // Handle messages
    room1.onMessage("*", (type, message) => {
      console.log(`[Player 1] Message [${type}]:`, message);
    });

    room2.onMessage("*", (type, message) => {
      console.log(`[Player 2] Message [${type}]:`, message);
    });

    // Wait a moment for "start" to trigger
    await new Promise((r) => setTimeout(r, 1000));

    // Player 1 (X) makes a move at cell 0
    console.log("[Player 1] Making move at 0");
    room1.send("move", { index: 0 });

    // Wait for the state to update
    await new Promise((r) => setTimeout(r, 1000));

    // Player 2 (O) makes a move at cell 1
    console.log("[Player 2] Making move at 1");
    room2.send("move", { index: 1 });

    // Wait and close
    await new Promise((r) => setTimeout(r, 2000));
    console.log("Test done.");

    room1.leave();
    room2.leave();
  } catch (err) {
    console.error("Error:", err);
  }
}

simulateGame();
