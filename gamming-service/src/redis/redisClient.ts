import Redis from "ioredis";

const redisClient = new Redis({
  host: "127.0.0.1",   
  port: 6379,         
  db: 0,
  retryStrategy(times: number) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});
redisClient.on("connect", () => {
  console.log("✅ Redis connected");
});
redisClient.on("error", (err) => {
  console.error("❌ Redis error:", err);
});

export default redisClient;
