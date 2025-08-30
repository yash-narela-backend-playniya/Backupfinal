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
	public partial class Player : Schema {
#if UNITY_5_3_OR_NEWER
[Preserve]
#endif
public Player() { }
		[Type(0, "string")]
		public string sessionId = default(string);

		[Type(1, "string")]
		public string name = default(string);

		[Type(2, "number")]
		public float score = default(float);

		[Type(3, "number")]
		public float position = default(float);

		[Type(4, "boolean")]
		public bool isActive = default(bool);

		[Type(5, "number")]
		public float timeRemaining = default(float);

		[Type(6, "number")]
		public float whitesPocketed = default(float);

		[Type(7, "number")]
		public float blacksPocketed = default(float);

		[Type(8, "boolean")]
		public bool hasQueen = default(bool);

		[Type(9, "boolean")]
		public bool queenCovered = default(bool);

		[Type(10, "number")]
		public float lives = default(float);

		[Type(11, "boolean")]
		public bool disqualified = default(bool);

		[Type(12, "string")]
		public string uniqueId = default(string);

		[Type(13, "boolean")]
		public bool isReady = default(bool);
	}
}
