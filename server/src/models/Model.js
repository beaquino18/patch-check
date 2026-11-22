import mongoose from 'mongoose'

const modelSchema = new mongoose.Schema({
  company: { type: String, required: true},
  product: { type: String, required: true},
  version: { type: String, required: true},
  supportEndsOn: { type: String },
})

const Model = mongoose.model('Model', modelSchema)

export default Model

