const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const MessageSchema = new Schema({
  threadId: { type: Schema.Types.ObjectId, ref: 'Thread', required: true },
  role: { type: String, enum: ['user','assistant'], required: true },
  text: { type: String },
  imagePath: { type: String },
  waiting: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Message', MessageSchema);
