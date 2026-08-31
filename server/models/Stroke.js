const mongoose = require('mongoose');

const PointSchema = new mongoose.Schema({
  x: Number,
  y: Number
}, { _id: false });

const StrokeSchema = new mongoose.Schema({
  roomId: { type: String, default: 'main' },
  userId: { type: String, required: true },
  strokeGroupId: { type: String, default: null },
  type: { type: String, default: 'stroke' }, // 'stroke' | 'eraser' | 'fill'
  color: String,
  size: Number,
  points: [PointSchema], // absent for fill
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Stroke || mongoose.model('Stroke', StrokeSchema);
