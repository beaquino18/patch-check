import mongoose from "mongoose";

const deviceSchema = new mongoose.Schema({
  nickname: { type: String, required: true}, 
  purchasedOn: { type: String }, 
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Owner', required: true},
  modelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Model', required: true}
})

const Device = mongoose.model('Device', deviceSchema)

export default Device
