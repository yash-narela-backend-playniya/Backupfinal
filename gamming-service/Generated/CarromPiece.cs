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
	public partial class CarromPiece : Schema {
#if UNITY_5_3_OR_NEWER
[Preserve]
#endif
public CarromPiece() { }
		[Type(0, "string")]
		public string id = default(string);

		[Type(1, "string")]
		public string type = default(string);

		[Type(2, "number")]
		public float x = default(float);

		[Type(3, "number")]
		public float y = default(float);

		[Type(4, "number")]
		public float vx = default(float);

		[Type(5, "number")]
		public float vy = default(float);

		[Type(6, "number")]
		public float radius = default(float);

		[Type(7, "boolean")]
		public bool isActive = default(bool);

		[Type(8, "boolean")]
		public bool isPocketed = default(bool);
	}
}
