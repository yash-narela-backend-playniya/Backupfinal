import { Room, Client, Delayed } from "colyseus";
import { BikeRaceState, Player } from "./schema/BikeRaceState";

export class BikeRaceRoom extends Room<BikeRaceState> {
  maxClients = 4;
  private gameLoop: Delayed | null = null;
  private timerLoop: Delayed | null = null;

  onCreate(options: any) {
    this.setState(new BikeRaceState());
    this.setMetadata({ maxClients: this.maxClients });

    this.onMessage("move", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      if (data.direction === "left" && player.lane > 0) player.lane--;
      if (data.direction === "right" && player.lane < 2) player.lane++;
    });

    this.onMessage("accelerate", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      player.speed = Math.min(player.speed + 1, 10);
    });

    this.onMessage("brake", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      player.speed = Math.max(player.speed - 1, 0);
    });

    console.log("🚀 BikeRaceRoom created");
  }

  onJoin(client: Client, options: any) {
    const player = new Player();
    player.sessionId = client.sessionId;
    player.name = options.name || `Player_${client.sessionId.substring(0, 4)}`;
    player.uniqueId = options.uniqueId || client.sessionId;
    player.matchOptionId = options.matchOptionId || "default";
    this.state.players.set(client.sessionId, player);

    if (this.state.players.size >= 2 && this.state.phase === "waiting") {
      this.startGame();
    }
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
  }

  private startGame() {
    this.state.phase = "playing";
    this.state.remainingTime = 180;

    this.timerLoop = this.clock.setInterval(() => {
      this.state.remainingTime--;
      this.broadcast("timer", { time: this.state.remainingTime });
      if (this.state.remainingTime <= 0) {
        this.endGame();
      }
    }, 1000);

    this.gameLoop = this.clock.setInterval(() => {
      this.state.players.forEach((player) => {
        if (player.speed > 0) {
          player.distance += player.speed;
          player.score += Math.floor(player.speed / 2);
        }
      });
    }, 100);
  }

  private endGame() {
    this.state.phase = "ended";
    this.timerLoop?.clear();
    this.gameLoop?.clear();

    const rankings = Array.from(this.state.players.values()).sort(
      (a, b) => b.score - a.score
    );

    this.broadcast("gameEnd", {
      rankings: rankings.map((p) => ({
        uniqueId: p.uniqueId,
        name: p.name,
        score: p.score,
      })),
    });
  }
}
