import { KafkaClient } from "./kafkaClient";
import Game from "../models/Games";
import Category from "../models/Category.model";
import Corousel from "../models/Corousel.model"
import TodaySpecial from "../models/TodaySpecial.model"
import MatchOption from "../models/MatchOption.model"
import mongoose from "mongoose";
import redisClient from "../redis/redisClient";
import ActiveMatch from "../models/ActiveMatch.model"

const kafka = new KafkaClient("admin-service", ["localhost:9092"], "game-service-group");

export const startKafka = async () => {
  await kafka.connect();

  kafka.registerHandler("game.list.fetch", async ({ message }) => {
    const data = JSON.parse(message.value?.toString() || "{}");
    console.log("📥 game.list.fetch request received:", data);

    try {
      const rawGames = await Game.find().populate("category", "name").lean();
      const categories = await Category.find().lean();
      const games = await Game.find().lean()

      const gamesAndCategories = rawGames.map(game => ({
        _id: game._id,
        name: game.name,
        bgImage: game.bgImage,
        category: game.category.map((cat: any) => ({
          _id: cat._id,
          name: cat.name,
        })),
      }));

      await kafka.sendMessage("game.fetch.response", {
        correlationId: data.correlationId || null,
        gamesAndCategories,
        categories,
        games
      });

      console.log("✅ Responded with game list.");
    } catch (err) {
      console.error("❌ Error fetching games:", err);
      await kafka.sendMessage("game.fetch.response", {
        correlationId: data.correlationId || null,
        error: "Failed to fetch games",
      });
    }
  });

  
  kafka.registerHandler("game.category.insert", async ({ message }) => {
    const rawValue = message.value?.toString();
    if (!rawValue) {
      console.warn("⚠️ Received empty message value");
      return;
    }
  
    let parsed;
    try {
      parsed = JSON.parse(rawValue);
    } catch (err) {
      console.error("❌ Failed to parse Kafka message:", err);
      return;
    }
  
    const { correlationId, data } = parsed;
    if (!data || typeof data !== "object") {
      console.error("❌ Invalid data format in Kafka message:", parsed);
      return;
    }
  
    console.log("📥 game.category.insert request received:", data);
  
    const updates: any[] = [];
  
    for (const [categoryId, gameIds] of Object.entries(data)) {
      for (const gameId of gameIds) {
        const result = await Game.findByIdAndUpdate(
          gameId,
          {
            $addToSet: { category: new mongoose.Types.ObjectId(categoryId) },
          },
          { new: true }
        );
  
        if (result) {
          updates.push({ gameId, updatedCategories: result.category });
        }
      }
    }
  
    await kafka.sendMessage("games.insert.response", {
      correlationId,
      status: 200,
      data: {
        message: "Categories added to games successfully.",
        updates,
      },
    });
  
    console.log("✅ Category update complete, response sent.");
  });

  kafka.registerHandler("games.categories.remove", async ({ message }) => {
    const rawValue = message.value?.toString();
    if (!rawValue) {
      console.warn("⚠️ Received empty message value");
      return;
    } 
  
    let parsed;
    try {
      parsed = JSON.parse(rawValue);
    } catch (err) {
      console.error("❌ Failed to parse Kafka message:", err);
      return;
    }
  
    const { correlationId, data } = parsed;
    if (!data || typeof data !== "object") {
      console.error("❌ Invalid data format in Kafka message:", parsed);
      return;
    }
  
    console.log("📥 games.categories.remove request received:", data);
  
    const updates = [];
  
    for (const [categoryId, gameIds] of Object.entries(data)) {
      for (const gameId of gameIds) {
        const result = await Game.findByIdAndUpdate(
          gameId,
          {
            $pull: { category: new mongoose.Types.ObjectId(categoryId) },
          },
          { new: true }
        );
  
        if (result) {
          updates.push({ gameId, updatedCategories: result.category });
        }
      }
    }
  
    await kafka.sendMessage("games.remove.response", {
      correlationId,
      status: 200,
      data: {
        message: "Categories removed from games successfully.",
        updates,
      },
    });
  
    console.log("✅ Category removal complete, response sent.");
  });
  

  kafka.registerHandler("corousel.create", async ({ message }) => {
    const rawValue = message.value?.toString();
    if (!rawValue) {
      console.warn("⚠️ Received empty message value");
      return;
    }
  
    let parsed;
    try {
      parsed = JSON.parse(rawValue);
    } catch (err) {
      console.error("❌ Failed to parse Kafka message:", err);
      return;
    }
  
    const { correlationId, data } = parsed;
  
    if (!Array.isArray(data)) {
      console.error("❌ Invalid data format. Expected an array of corousels.");
      await kafka.sendMessage("corousel.create.response", {
        correlationId,
        status: 400,
        data: { error: "Invalid data format. Expected an array of corousels." },
      });
      return;
    }
  
    try {
      const createdCorousels = [];
  
      for (const item of data) {
        const { title = "", description = "", bgImage = "", buttonTitle= "", buttonUrl = "" } = item;
        const corousel = new Corousel({ title, description, bgImage,buttonTitle ,buttonUrl});
        const saved = await corousel.save();
        createdCorousels.push(saved);
      }
      await kafka.sendMessage("corousel.create.response", {
        correlationId,
        status: 201,
        data: {
          message: "Corousels created successfully.",
          corousels: createdCorousels,
        },
      });
      console.log("✅ Corousels created and response sent");
    } catch (err) {
      console.error("❌ Error creating corousels:", err);
  
      await kafka.sendMessage("corousel.create.response", {
        correlationId,
        status: 500,
        data: { error: "Internal server error while creating corousels" },
      });
    }
  });

  kafka.registerHandler("matchOption.fetch", async ({ message }) => {
  const rawValue = message.value?.toString();
  if (!rawValue) return console.warn("⚠️ Empty message on matchOption.fetch");

  let parsed;
  try {
    parsed = JSON.parse(rawValue);
  } catch (err) {
    console.error("❌ Failed to parse Kafka message:", err);
    return;
  }

  const { correlationId } = parsed;
  let gameId = parsed.gameId;

  if (!correlationId) return console.warn("⚠️ Missing correlationId");
  if (!gameId) return console.warn("⚠️ Missing gameId");

  if (typeof gameId === "object" && gameId.gameId) {
    gameId = gameId.gameId;
  }

  if (!mongoose.Types.ObjectId.isValid(gameId)) {
    console.warn("⚠️ Invalid gameId:", gameId);
    return;
  }

  try {
    const matchOptions = await MatchOption.find().lean();
    const objectGameId = new mongoose.Types.ObjectId(gameId);

    const activeMatches = await ActiveMatch.find({ gameId: objectGameId }).lean();

    const countMap = new Map();
    activeMatches.forEach(match => {
      countMap.set(match.matchOption.toString(), match.count || 0);
    });

    const enrichedMatchOptions = matchOptions.map(option => ({
      ...option,
      activeRoomCount: countMap.get(option._id.toString()) || 0,
    }));

    await kafka.sendMessage("matchOption.fetch.response", {
      correlationId,
      status: 200,
      data: enrichedMatchOptions,
    });

    console.log("✅ Sent enriched match options data to response topic", { correlationId, status: 200 });
  } catch (err) {
    console.error("❌ Error fetching match options with active room counts:", err);

    await kafka.sendMessage("matchOption.fetch.response", {
      correlationId,
      status: 500,
      data: { error: "Failed to fetch match options" },
    });
  }
});


  kafka.registerHandler("todaySpecial.create", async ({ message }) => {
    const rawValue = message.value?.toString();
    if (!rawValue) {
      console.warn("⚠️ Received empty message value");
      return;
    }
  
    let parsed;
    try {
      parsed = JSON.parse(rawValue);
    } catch (err) {
      console.error("❌ Failed to parse Kafka message:", err);
      return;
    }
  
    const { correlationId, data } = parsed;
  
    if (!Array.isArray(data)) {
      console.error("❌ Invalid data format. Expected an array of today specials.");
      await kafka.sendMessage("todaySpecial.create.response", {
        correlationId,
        status: 400,
        data: { error: "Invalid data format. Expected an array of today specials." },
      });
      return;
    }
  
    try {
      const createdtodaySpecials = [];
  
      for (const item of data) {
        const { title = "", description = "", bgImage = "" } = item;
        const todaySpecial = new TodaySpecial({ title, description, bgImage });
        const saved = await todaySpecial.save();
        createdtodaySpecials.push(saved);
      }
      await kafka.sendMessage("todaySpecial.create.response", {
        correlationId,
        status: 201,
        data: {
          message: "today specials created successfully.",
          todaySpecials: createdtodaySpecials,
        },
      });
      console.log("✅ today's special created and response sent");
    } catch (err) {
      console.error("❌ Error creating today's specials:", err);
  
      await kafka.sendMessage("todaySpecial.create.response", {
        correlationId,
        status: 500,
        data: { error: "Internal server error while creating today's specials" },
      });
    }
  });

  kafka.registerHandler("homeScreen.data", async ({ message }) => {
    console.log("home screen data request received")
    const rawValue = message.value?.toString();
    if (!rawValue) {
      console.warn("⚠️ Received empty message value");
      return;
    }
  
    let parsed;
    try {
      parsed = JSON.parse(rawValue);
    } catch (err) {
      console.error("❌ Failed to parse Kafka message:", err);
      return;
    }
  
    const { correlationId } = parsed;
  
    try {
      const allGames = await Game.find().lean();
      const corousels = await Corousel.find().lean();
      const todaySpecials = await TodaySpecial.find().lean();
      const categories = await Category.find().lean();
      // const categoriesWithGames = [];
  
      // for (const category of categories) {
      //   const gamesInCategory = await Game.find({
      //     category: category._id
      //   })
      //     .select("_id")
      //     .lean();
  
      //   categoriesWithGames.push({
      //     order: 0, 
      //     title: category.name,
      //     games: gamesInCategory.map(g => g._id)
      //   });
      // }
      const trendingCategory = await Category.findOne({ name: "Trending" });
      let trendingGames = [];
      if (trendingCategory) {
        trendingGames = await Game.find({ category: trendingCategory._id })
          .select("_id")
          .limit(5)
          .lean();
      }
      const bestForYou = await Game.aggregate([{ $sample: { size: 5 } }]);
      const newToCollection = await Game.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .lean();
      const funCategory = await Category.findOne({ name: "FunGames" });
      let funGames = [];
      if (funCategory) {
        funGames = await Game.find({ category: funCategory._id })
          .select("_id")
          .limit(5)
          .lean();
      }
  
      const responsePayload = {
        allGames,
        corousels,
        todaySpecials,
        // categoriesWithGames,
        homeSections: [
          {
            order: 1,
            title: "Trending",
            games: trendingGames.map(g => g._id)
          },
          {
            order: 2,
            title: "Fun Games",
            games: funGames.map(g => g._id)
          },
          {
            order: 3,
            title: "Best For You",
            games: bestForYou.map(g => g._id)
          },
          {
            order: 4,
            title: "New to Collection",
            games: newToCollection.map(g => g._id)
          }
        ]
      };
  
      await kafka.sendMessage("homeScreen.data.response", {
        correlationId,
        status: 200,
        data: responsePayload
      });
    } catch (err) {
      console.error("❌ Error fetching home screen data:", err);
      await kafka.sendMessage("home.screen.fetch.response", {
        correlationId,
        status: 500,
        data: { error: "Internal server error while fetching home screen data" }
      });
    }
  });

  kafka.registerHandler("matchOption.create", async ({ message }) => {
  console.log("🎯 Received request to create match options");

  const rawValue = message.value?.toString();
  if (!rawValue) {
    console.warn("⚠️ Empty message value");
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(rawValue);
  } catch (err) {
    console.error("❌ Failed to parse Kafka message:", err);
    return;
  }

  const { correlationId, options } = parsed;

  if (!Array.isArray(options)) {
    return await kafka.sendMessage("matchOption.create.response", {
      correlationId,
      status: 400,
      data: { error: "Invalid options format. Expected an array of match options." }
    });
  }

  try {
    const createdOptions = await MatchOption.insertMany(options);
    console.log("✅ Match options created successfully");

    await kafka.sendMessage("matchOption.create.response", {
      correlationId,
      status: 201,
      data: {
        message: "Match options created successfully",
        created: createdOptions
      }
    });
  } catch (err) {
    console.error("❌ Error saving match options:", err);
    await kafka.sendMessage("matchOption.create.response", {
      correlationId,
      status: 500,
      data: { error: "Internal server error while saving match options" }
    });
  }
});
  

  await kafka.start();

  await kafka.sendMessage("logs", { message: "Kafka Service started and all subscriptions initialized." });
};

