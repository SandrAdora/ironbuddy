const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);

const SOCKET_PORT = process.env.SOCKET_PORT || 3001;
const UPLOAD_BASE_URL = process.env.UPLOAD_BASE_URL || `http://localhost:${SOCKET_PORT}`;

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());

// ── Uploads directory ────────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// ── Multer storage ────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const ALLOWED_MIME = /^(image\/(jpeg|jpg|png|gif|webp)|video\/(mp4|mov|avi)|application\/(pdf)|text\/plain)$/i;
const ALLOWED_EXT  = /\.(jpg|jpeg|png|gif|webp|pdf|txt|mp4|mov|avi)$/i;

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const extOk  = ALLOWED_EXT.test(path.extname(file.originalname));
    const mimeOk = ALLOWED_MIME.test(file.mimetype);
    if (extOk || mimeOk) return cb(null, true);
    cb(new Error(`File type not allowed: ${file.mimetype}`));
  },
});

function getFileCategory(mimetype = '') {
  if (mimetype.startsWith('image/'))  return 'image';
  if (mimetype.startsWith('video/'))  return 'video';
  if (mimetype === 'application/pdf') return 'pdf';
  return 'file';
}

// ── File upload endpoint ──────────────────────────────────────────────────────
app.post('/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    if (err) {
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    res.json({
      file_url:  `${UPLOAD_BASE_URL}/uploads/${req.file.filename}`,
      file_name: req.file.originalname,
      file_type: getFileCategory(req.file.mimetype),
      file_size: req.file.size,
    });
  });
});

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Socket.io auth middleware ─────────────────────────────────────────────────
// Django SimpleJWT tokens are JWTs — we decode (not verify) to extract user_id.
// Actual authorization is enforced by Django on every REST call.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.decode(token);
    if (!decoded?.user_id) return next(new Error('Invalid token payload'));
    socket.userId = decoded.user_id;
    next();
  } catch {
    next(new Error('Token decode failed'));
  }
});

// ── Socket.io events ──────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[socket] user ${socket.userId} connected  (id: ${socket.id})`);

  // Join a conversation room (call after opening a chat thread)
  socket.on('join_conversation', (conversationId) => {
    const room = `conversation_${conversationId}`;
    socket.join(room);
  });

  // Leave a conversation room
  socket.on('leave_conversation', (conversationId) => {
    socket.leave(`conversation_${conversationId}`);
  });

  // Broadcast a saved message to all OTHER participants in the room.
  // The sender already has the message from the REST API response.
  socket.on('send_message', ({ conversation_id, message }) => {
    socket.to(`conversation_${conversation_id}`).emit('new_message', {
      conversation_id,
      message,
    });
  });

  // Reaction update — broadcast updated reactions to all OTHER participants
  socket.on('reaction_update', ({ conversation_id, message_id, reactions }) => {
    socket.to(`conversation_${conversation_id}`).emit('reaction_update', {
      message_id,
      reactions,
    });
  });

  // Message deleted — notify other participants
  socket.on('message_deleted', ({ conversation_id, message_id }) => {
    socket.to(`conversation_${conversation_id}`).emit('message_deleted', {
      conversation_id,
      message_id,
    });
  });

  // Conversation deleted — notify other participant so they can refresh their list
  socket.on('conversation_deleted', ({ conversation_id }) => {
    socket.to(`conversation_${conversation_id}`).emit('conversation_deleted', {
      conversation_id,
    });
  });

  // Typing indicators
  socket.on('typing_start', (conversationId) => {
    socket.to(`conversation_${conversationId}`).emit('typing', {
      user_id: socket.userId,
      conversation_id: conversationId,
    });
  });

  socket.on('typing_stop', (conversationId) => {
    socket.to(`conversation_${conversationId}`).emit('stop_typing', {
      user_id: socket.userId,
      conversation_id: conversationId,
    });
  });

  socket.on('disconnect', (reason) => {
    console.log(`[socket] user ${socket.userId} disconnected (${reason})`);
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(SOCKET_PORT, () => {
  console.log(`Socket.io + Multer server listening on port ${SOCKET_PORT}`);
  console.log(`File uploads available at ${UPLOAD_BASE_URL}/uploads/`);
});
