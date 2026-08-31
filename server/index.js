// server/index.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const Stroke = require('./models/Stroke');

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json());

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || '*', methods: ['GET','POST'] }
});

// Mongo connect (optional)
if (process.env.MONGO_URI) {
  mongoose.connect(process.env.MONGO_URI).then(()=>console.log('Mongo connected')).catch(err=>console.error(err));
} else {
  console.log('No MONGO_URI -> using memory store');
}

const inMemoryStore = {};

// Health
app.get('/health', (req, res) => res.json({ ok: true }));

// History endpoints (explicit routes)
app.get('/history', async (req, res) => {
  const roomId = 'main';
  if (process.env.MONGO_URI) {
    const strokes = await Stroke.find({ roomId }).sort({ createdAt: 1 }).limit(5000).lean();
    return res.json(strokes);
  } else {
    return res.json(inMemoryStore[roomId] || []);
  }
});
app.get('/history/:roomId', async (req, res) => {
  const roomId = req.params.roomId || 'main';
  if (process.env.MONGO_URI) {
    const strokes = await Stroke.find({ roomId }).sort({ createdAt: 1 }).limit(5000).lean();
    return res.json(strokes);
  } else {
    return res.json(inMemoryStore[roomId] || []);
  }
});

// clear endpoint
app.post('/clear/:roomId', async (req, res) => {
  const roomId = req.params.roomId || 'main';
  if (process.env.MONGO_URI) {
    await Stroke.deleteMany({ roomId });
  } else {
    inMemoryStore[roomId] = [];
  }
  io.in(roomId).emit('clear');
  res.json({ ok: true });
});

io.on('connection', (socket) => {
  const qs = socket.handshake.query || {};
  const roomId = qs.roomId || 'main';
  socket.join(roomId);

  socket.on('join-room', async (ack) => {
    try {
      let strokes;
      if (process.env.MONGO_URI) {
        strokes = await Stroke.find({ roomId }).sort({ createdAt: 1 }).limit(5000).lean();
      } else {
        strokes = inMemoryStore[roomId] || [];
      }
      socket.emit('board-history', strokes);
      if (typeof ack === 'function') ack({ ok: true, count: (strokes || []).length });
    } catch (err) {
      if (typeof ack === 'function') ack({ ok: false, error: err.message });
    }
  });

  // stroke: stroke object contains normalized points (x in [0,1], y in [0,1]) and type: 'stroke'|'eraser'|'fill'
  socket.on('stroke', async (stroke) => {
    try {
      if (!stroke || (!stroke.points && stroke.type !== 'fill')) return;
      stroke.roomId = roomId;
      // broadcast immediately so peers see live drawing progress
      socket.to(roomId).emit('stroke', stroke);
      // only persist finalized strokes; in-progress throttled snapshots
      // (final: false) are broadcast for live preview but not saved
      if (stroke.final === false) return;
      if (process.env.MONGO_URI) {
        const doc = new Stroke(stroke);
        doc.save().catch(e => console.error('mongo save err', e));
      } else {
        inMemoryStore[roomId] = inMemoryStore[roomId] || [];
        inMemoryStore[roomId].push(stroke);
        if (inMemoryStore[roomId].length > 5000) inMemoryStore[roomId].shift();
      }
    } catch (err) {
      console.error('stroke handler err', err);
    }
  });

  // undo per-user
  socket.on('undo', async ({ userId }) => {
    try {
      if (!userId) return;
      if (process.env.MONGO_URI) {
        const last = await Stroke.findOne({ roomId, userId }).sort({ createdAt: -1 });
        if (last) {
          await last.deleteOne();
          const strokes = await Stroke.find({ roomId }).sort({ createdAt: 1 }).limit(5000).lean();
          io.in(roomId).emit('board-history', strokes);
        }
      } else {
        const arr = inMemoryStore[roomId] || [];
        for (let i = arr.length -1; i>=0; i--) {
          if (arr[i].userId === userId) { arr.splice(i,1); break; }
        }
        io.in(roomId).emit('board-history', arr);
      }
    } catch (err) {
      console.error('undo err', err);
    }
  });

  // erase-last (global)
  socket.on('erase-last', async () => {
    try {
      if (process.env.MONGO_URI) {
        const last = await Stroke.findOne({ roomId }).sort({ createdAt: -1 });
        if (last) {
          await last.deleteOne();
          const strokes = await Stroke.find({ roomId }).sort({ createdAt: 1 }).limit(5000).lean();
          io.in(roomId).emit('board-history', strokes);
        }
      } else {
        const arr = inMemoryStore[roomId] || [];
        arr.pop();
        io.in(roomId).emit('board-history', arr);
      }
    } catch (err) {
      console.error('erase-last err', err);
    }
  });

  // fill (global fill whole canvas with color)
  socket.on('fill', async ({ color, userId }) => {
    try {
      const fillStroke = { id: `fill-${Date.now()}`, userId, type: 'fill', color, createdAt: new Date() };
      if (process.env.MONGO_URI) {
        const doc = new Stroke(fillStroke);
        await doc.save().catch(e=>console.error('save fill err', e));
      } else {
        inMemoryStore[roomId] = inMemoryStore[roomId] || [];
        inMemoryStore[roomId].push(fillStroke);
      }
      io.in(roomId).emit('stroke', fillStroke);
    } catch (err) {
      console.error('fill err', err);
    }
  });

  // cursor (lightweight)
  socket.on('cursor', (cursor) => {
    if (!cursor || !cursor.userId) return;
    socket.to(roomId).emit('cursor', cursor);
  });

  socket.on('clear', async () => {
    try {
      if (process.env.MONGO_URI) {
        await Stroke.deleteMany({ roomId });
      } else {
        inMemoryStore[roomId] = [];
      }
      io.in(roomId).emit('clear');
    } catch (err) {
      console.error('clear err', err);
    }
  });

  socket.on('disconnect', () => {});
});

server.listen(PORT, "0.0.0.0", ()=>console.log(`Server listening ${PORT}`));
