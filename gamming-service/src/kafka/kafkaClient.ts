import { Kafka, Consumer, EachMessagePayload } from "kafkajs";
type MessageHandler = (payload: EachMessagePayload) => Promise<void>;

export class KafkaClient {
  private kafka: Kafka;
  private consumer: Consumer;
  private handlers: Record<string, MessageHandler> = {};

  constructor(
    clientId: string,
    brokers: string[],
    private groupId: string
  ) {
    this.kafka = new Kafka({ clientId, brokers });
    this.consumer = this.kafka.consumer({ groupId });
  }

  async connect() {
    await this.consumer.connect();
  }

  registerHandler(topic: string, handler: MessageHandler) {
    this.handlers[topic] = handler;
  }

  async start() {
    const topics = Object.keys(this.handlers);

    for (const topic of topics) {
      await this.consumer.subscribe({ topic, fromBeginning: false });
      console.log(`✅ Subscribed to topic: ${topic}`);
    }

    await this.consumer.run({
      eachMessage: async (payload: EachMessagePayload) => {
        const handler = this.handlers[payload.topic];
        if (handler) {
          await handler(payload);
        } else {
          console.warn(`⚠️ No handler found for topic: ${payload.topic}`);
        }
      }
    });

    console.log("🚀 Kafka consumer running.");
  }

  async sendMessage(topic: string, message: any) {
    const producer = this.kafka.producer();
    await producer.connect();
    await producer.send({
      topic,
      messages: [
        {
          value: JSON.stringify(message)
        }
      ]
    });
    await producer.disconnect();
  }
}
