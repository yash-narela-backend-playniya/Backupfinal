/**
 * IMPORTANT:
 * ---------
 * Do not manually edit this file if you'd like to host your server on Colyseus Cloud
 *
 * If you're self-hosting (without Colyseus Cloud), you can manually
 * instantiate a Colyseus Server as documented here:
 *
 * See: https://docs.colyseus.io/server/api/#constructor-options
 */
import { listen } from "@colyseus/tools";

// Import Colyseus config
import app from "./app.config";
import { startKafka } from "./kafka/kafkaService";

// (async () => {
//   try {
//     await startKafka();
//     console.log("Kafka service running...");
//   } catch (err) {
//     console.error("Error starting Kafka service:", err);
//   }
// })();


// Create and listen on 2567 (or PORT environment variable.)
listen(app);
