// 
// THIS FILE HAS BEEN GENERATED AUTOMATICALLY
// DO NOT CHANGE IT MANUALLY UNLESS YOU KNOW WHAT YOU'RE DOING
// 
// GENERATED USING @colyseus/schema 3.0.33
// 

using Colyseus.Schema;
#if UNITY_5_3_OR_NEWER
using UnityEngine.Scripting;
#endif

namespace MyGame.Schema {
	public partial class CarromGameState : Schema {
#if UNITY_5_3_OR_NEWER
[Preserve]
#endif
public CarromGameState() { }
		[Type(0, "number")]
		public float currentPlayerIndex = default(float);

		[Type(1, "number")]
		public float gameTimeRemaining = default(float);

		[Type(2, "boolean")]
		public bool isGameStarted = default(bool);

		[Type(3, "boolean")]
		public bool isGameOver = default(bool);

		[Type(4, "string")]
		public string gameStatus = default(string);

		[Type(5, "number")]
		public float turnTimeRemaining = default(float);

		[Type(6, "boolean")]
		public bool isPaused = default(bool);

		[Type(7, "string")]
		public string winner = default(string);

		[Type(8, "number")]
		public float totalPlayers = default(float);

		[Type(9, "string")]
		public string matchOptionId = default(string);

		[Type(10, "number")]
		public float minPlayer = default(float);

		[Type(11, "number")]
		public float betAmount = default(float);

		[Type(12, "number")]
		public float winAmount = default(float);

		[Type(13, "map", typeof(MapSchema<Player>))]
		public MapSchema<Player> players = null;

		[Type(14, "map", typeof(MapSchema<CarromPiece>))]
		public MapSchema<CarromPiece> pieces = null;

		[Type(15, "array", typeof(ArraySchema<GameEvent>))]
		public ArraySchema<GameEvent> events = null;

		[Type(16, "map", typeof(MapSchema<bool>), "boolean")]
		public MapSchema<bool> playReady = null;
	}
}
