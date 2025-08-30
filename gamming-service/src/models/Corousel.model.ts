// models/Category.ts
import mongoose, { Document, Schema } from "mongoose";

export interface Corousel extends Document {
  title: string;
  description: string;
  bgImage: string;
  buttonTitle: string;
  buttonUrl: string;
 
}

const CorouselSchema: Schema = new Schema({
  title: {type: String, default: ""},
  description: {type: String, default: ""},
  bgImage: {type: String, default: ""},
  buttonTitle: {type: String, default: ""},
  buttonUrl: {type: String, default: ""}
});

export default mongoose.model<Corousel>("Corousel", CorouselSchema);


