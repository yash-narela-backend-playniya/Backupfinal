
import mongoose, { Document, Schema, Types } from "mongoose";

export interface IActiveMatch extends Document {
  gameId: Types.ObjectId;
  matchOption: Types.ObjectId;
  count: Number;
}

const ActiveMatchSchema: Schema = new Schema({
  gameId: { type: Schema.Types.ObjectId, ref: "Game", required: true },
  matchOption: { type: Schema.Types.ObjectId, ref: "MatchOption", required: true },
  count: {type: Number, default: 0}
});

export default mongoose.model<IActiveMatch>("ActiveMatch", ActiveMatchSchema);
