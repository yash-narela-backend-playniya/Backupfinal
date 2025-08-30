// models/Game.ts
import mongoose, { Document, Schema, Types } from "mongoose";

export interface IGame extends Document {
  name: string;
  category: Types.ObjectId[]; // Now an array
  bgImage: string;
}

const GameSchema: Schema = new Schema({
  name: { type: String, required: true },
  category: [{ type: Schema.Types.ObjectId, ref: "Category" }], // Array of refs
  bgImage: { type: String, default: "" },
});

export default mongoose.model<IGame>("Game", GameSchema);
