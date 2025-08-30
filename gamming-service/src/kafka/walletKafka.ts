import { Kafka } from "kafkajs";
import redisClient from "../redis/redisClient";
import { v4 as uuidv4 } from "uuid";

interface WalletRequestPayload {
  uniqueId?: string;
  gameFee: number;
  orderId?: string;
  roomId: string;
  useBonus?: boolean;
  description?: string;
  correlationId?: string;
  users?: string[];
  gameId?: string;
}

class KafkaWalletService {
  private kafka = new Kafka({ brokers: ["192.168.1.202:9092"] });
  private producer = this.kafka.producer();
  private consumer = this.kafka.consumer({ groupId: "game-wallet11-group" });
  private isConsumerInitialized = false;

  constructor() {
   
  }

  public async initialize() {
    console.log("[KafkaWalletService] Initializing Kafka producer and consumer...");
    await this.producer.connect();

    if (!this.isConsumerInitialized) {
      let connected = false;
      let retries = 0;

      while (!connected && retries < 5) {
        try {
          await this.consumer.connect();
          connected = true;
          console.log("[KafkaWalletService] Consumer connected.");
        } catch (err) {
          retries++;
          console.warn(`[KafkaWalletService] Consumer connect retry ${retries}:`, err.message);
          await new Promise((res) => setTimeout(res, 1000));
        }
      }

      await this.consumer.subscribe({ topic: "wallet.match.entry.response", fromBeginning: false });
      await this.consumer.subscribe({ topic: "game.session.start.response", fromBeginning: false });

      console.log("[KafkaWalletService] Subscribed to wallet.match.entry.response and game.session.start.response");

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          console.log(`[KafkaWalletService] 🔔 Message received on ${topic}, partition ${partition}`);
          console.log(JSON.stringify(message.value.toString()))

          if (!message.value) {
            console.warn("[KafkaWalletService] ❌ Empty message");
            return;
          }

          try {
            const value = JSON.parse(message.value.toString());
            const { data, statusCode, success } = value;

            const redisKey =
              topic === "wallet.match.entry.response"
                ? data.orderId
                : topic === "game.session.start.response"
                ? data.correlationId
                : null;

            if (redisKey) {
              await redisClient.set(redisKey, JSON.stringify({ data, statusCode, success }), "EX", 10);
              console.log(`[KafkaWalletService] ✅ Stored response for ${topic} → Redis Key: ${redisKey}`);
            } else {
              console.warn(`[KafkaWalletService] ❌ No Redis key could be derived from message on ${topic}`);
            }
          } catch (err) {
            console.error(`[KafkaWalletService] ❌ Error processing message from ${topic}:`, err);
          }
        },
      });

      this.consumer.on("consumer.crash", (e) => {
        console.error("[KafkaWalletService] ⚠️ Consumer crashed:", e);
      });

      this.isConsumerInitialized = true;
    }
  }

  public async sendWalletRequestAndWait(
    uniqueId: string,
    amount: number,
    useBonus: boolean,
    roomId: string
  ): Promise<any> {
    const orderId = uuidv4();
    const payload: WalletRequestPayload = {
      uniqueId,
      gameFee: amount,
      orderId,
      roomId,
      useBonus,
      description: "join-game",
    };

    await this.producer.send({
      topic: "wallet.match.entry",
      messages: [{ value: JSON.stringify(payload) }],
    });

    console.log("[KafkaWalletService] 📨 Wallet request sent:", orderId);

    const maxRetries = 20;
    for (let i = 0; i < maxRetries; i++) {
      const result = await redisClient.get(orderId);
      if (result) {
        console.log("[KafkaWalletService] ✅ Wallet response received:", result);
        return JSON.parse(result);
      }
      await new Promise((res) => setTimeout(res, 1000));
    }

    throw new Error("❌ Wallet service did not respond in time.");
  }

  public async sendGameStartRequest(
    users: string[],
    amount: number,
    gameId: string,
    roomId: string
  ): Promise<any> {
    const correlationId = uuidv4();
    const payload: WalletRequestPayload = {
      correlationId,
      users,
      gameFee: amount,
      gameId,
      roomId,
    };

    await this.producer.send({
      topic: "game.session.start",
      messages: [{ value: JSON.stringify(payload) }],
    });

    console.log("[KafkaWalletService] 📨 Game start request sent:", correlationId);

    const maxRetries = 20;
    for (let i = 0; i < maxRetries; i++) {
      const result = await redisClient.get(correlationId);
      if (result) {
        console.log("[KafkaWalletService] ✅ Game start response received:", result);
        return JSON.parse(result);
      }
      await new Promise((res) => setTimeout(res, 1000));
    }

    throw new Error("❌ Game start service did not respond in time.");
  }


  public async sendGameEndRequest(
    users: string[],
    winnerId: string,
    gameId: string,
    roomId: string,
    amount: number
  ): Promise<any> {
    const payload: WalletRequestPayload = {
      players: users,
      amount,
      gameId,
      roomId,
      winnerId
    };

    await this.producer.send({
      topic: "game.session.end",
      messages: [{ value: JSON.stringify(payload) }],
    });

    console.log("[KafkaWalletService] 📨 Game start request sent:");
  }
}

export default new KafkaWalletService();
