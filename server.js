const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middleware/errorHandler');

// Load env vars
dotenv.config();

// ─── MongoDB Connection (cached for serverless reuse) ───────────────────────
let isConnected = false;

const connectDB = async () => {
  if (isConnected && mongoose.connection.readyState === 1) return;
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb+srv://notebookUser:F12udk1ZQ7ilE1IA@cluster0.xjpgufh.mongodb.net/smart_notebook?retryWrites=true&w=majority';
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`Error connecting to MongoDB: ${err.message}`);
    isConnected = false;
    throw new Error(`Database Connection Error: ${err.message}`);
  }
};

// ─── Express App ─────────────────────────────────────────────────────────────
const app = express();

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Set security headers
app.use(helmet());

// Enable CORS
const allowedOrigins = [
  'https://incredible-cupcake-e88be5.netlify.app',
  'http://localhost:5173',
  'http://localhost:3000',
];
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now to debug
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 mins
  max: 100
});
app.use('/api/', limiter);

// ✅ MUST be BEFORE routes — ensures DB is ready before any request is handled
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────
const auth          = require('./routes/auth');
const notes         = require('./routes/notes');
const categories    = require('./routes/categories');
const accounts      = require('./routes/accounts');
const notifications = require('./routes/notifications');

app.get('/', (req, res) => {
  res.send('Smart Notebook API is running...');
});

app.use('/api/auth',          auth);
app.use('/api/notes',         notes);
app.use('/api/categories',    categories);
app.use('/api/accounts',      accounts);
app.use('/api/notifications', notifications);

// Error handler middleware (must be after routers)
app.use(errorHandler);

// ─── Local Development ───────────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () =>
    console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
  );
}

// ─── Export for Vercel Serverless ────────────────────────────────────────────
module.exports = app;
