const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ThreadSchema = new Schema({
  name: { type: String, required: true, default: 'New thread' }
}, { timestamps: true });

module.exports = mongoose.model('Thread', ThreadSchema);
