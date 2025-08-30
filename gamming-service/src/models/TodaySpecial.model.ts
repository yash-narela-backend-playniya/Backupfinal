// models/Category.ts
import mongoose, { Document, Schema } from "mongoose";

export interface TodaySpecial extends Document {
  title: string;
  description: string;
  bgImage: string;
 
}

const TodaySpecialSchema: Schema = new Schema({
  title: {type: String, default: ""},
  description: {type: String, default: ""},
  bgImage: {type: String, default: ""},
  
});

export default mongoose.model<TodaySpecial>("TodaySpecial", TodaySpecialSchema);


