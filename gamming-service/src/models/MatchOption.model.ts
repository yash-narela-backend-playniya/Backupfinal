
import mongoose, { Document, Schema } from "mongoose";

export interface IMatchOption extends Document {
  numberOfPlayers: number;
  minimumPlayers: number;
  winningAmount: number;
  bettingAmount: number;
  type: String;
}

const MatchOptionSchema: Schema = new Schema({
  numberOfPlayers: { type: Number, required: true },
  minimumPlayers: { type: Number, required: true },
  winningAmount: { type: Number, required: true },
  bettingAmount: { type: Number, required: true },
  type: {type: String, required: true}
});

export default mongoose.model<IMatchOption>("MatchOption", MatchOptionSchema);
