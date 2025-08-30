import config from "@colyseus/tools";
import { monitor } from "@colyseus/monitor";
import { playground } from "@colyseus/playground";
import {bodyParser} from "body-parser"
import {mongoose} from "mongoose"
import { MyRoom } from "./rooms/MyRoom";
import { LudoRoom } from "./rooms/LudoRoom";
import { CarromRoom } from "./rooms/CarromRoom";
import { TicTacToeRoom } from "./rooms/TicTacToeRoom";
import {SnakeLadder} from "./rooms/SnakeLadder";
import { ArcadeBasketballRoom} from "./rooms/ArcadeBasketBallRoom"

import {TicTacToeRoom   } from "./rooms/TicTacToeV2"

import { CarRaceRoom} from "./rooms/CarRaceRoom";


import { TicTacToeAIRoom } from "./rooms/freeGame/TicTacRoomFree"

import { BikeRaceRoom } from "./rooms/BikeRaceRoom";

import { CarromGameRoom} from "./rooms/CarromRoom"

// import {GameRoom} from "./rooms/RaceRoom"

// import {ArcadeBasketballRoom  } from "./rooms/DArcadeRoom"


import {FruitNinjaRoom } from "./rooms/FruitSlicerRoom"

export default config({

    initializeGameServer: (gameServer) => {

        gameServer
        .define("ludo_room", LudoRoom)
        .filterBy(['playerCount','isPrivate','matchOptionId'])

      



       gameServer.define("snake_ladder", SnakeLadder).filterBy(['playerCount','isPrivate','matchOptionId'])


       gameServer.define("tictactoe", TicTacToeRoom).filterBy(['playerCount','isPrivate','matchOptionId']);

       gameServer.define('arcade_basketball', ArcadeBasketballRoom)
          .filterBy(['playerCount', 'isPrivate', 'maxClients'])
       gameServer.define('tictactoev2', TicTacToeRoom)
          .filterBy(['playerCount', 'isPrivate', 'maxClients'])


          gameServer.define("bike_race", BikeRaceRoom).filterBy(['playerCount', 'isPrivate', 'matchOptionId']);


          gameServer.define("tictactoe_ai", TicTacToeAIRoom ).filterBy(['playerCount', 'isPrivate', 'matchOptionId']);  

          gameServer.define("carrom_game", CarromGameRoom).filterBy(['playerCount', 'isPrivate', 'matchOptionId']); 
            gameServer.define("arcade_basketball_", ArcadeBasketballRoom).filterBy(['playerCount', 'isPrivate', 'matchOptionId']);

          gameServer.define("car3D_room", CarRaceRoom);   

        //   gameServer.define( "race_room", GameRoom).filterBy(['playerCount', 'isPrivate', 'matchOptionId']);

          gameServer.define("fruit_ninja", FruitNinjaRoom).filterBy(['playerCount', 'isPrivate', 'matchOptionId']);


       

    },


    
    initializeExpress: async (app) => {
        try {
            await mongoose.connect("mongodb://localhost:27017/GameService", {
                useNewUrlParser: true,
                useUnifiedTopology: true,
            });
            console.log("✅ Connected to MongoDB!");
            
        } catch (err) {
            console.error("❌ Failed to connect to MongoDB", err);
        }   
        
        // app.use("/v1/games", gameRoutes)
    
        app.get("/hello_world", (req, res) => {
            res.send("It's time to kick ass and chew bubblegum!");
        });

        
    
        app.use("/monitor", monitor());
    
        if (process.env.NODE_ENV !== "production") {
            app.use("/", playground());
        }
    },


    beforeListen: () => {
        
    }
});
