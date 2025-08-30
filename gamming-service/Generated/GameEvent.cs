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
	public partial class GameEvent : Schema {
#if UNITY_5_3_OR_NEWER
[Preserve]
#endif
public GameEvent() { }
		[Type(0, "string")]
		public string type = default(string);

		[Type(1, "string")]
		public string playerId = default(string);

		[Type(2, "string")]
		public string pieceType = default(string);

		[Type(3, "number")]
		public float points = default(float);

		[Type(4, "string")]
		public string message = default(string);

		[Type(5, "number")]
		public float timestamp = default(float);
	}
}
