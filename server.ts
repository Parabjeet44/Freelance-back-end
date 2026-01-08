import express from 'express';
import authRoutes from './routes/authRoute';
import projectRoutes from './routes/projectRoutes';
import bidRoutes from './routes/bidRoutes';
import deliverableRoute from './routes/deliverableRoutes';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();

// 1. CORS Configuration
app.use(cors({
    origin: process.env.FRONT_END_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2. Simple Preflight Handler (Fixes Express 5 crash)
app.options('/:path*', cors());

app.use(cookieParser());
app.use(express.json());

// 3. Routes
app.use('/api/auth', authRoutes);
app.use('/api/project', projectRoutes);
app.use('/api/bid', bidRoutes);
app.use('/api/deliverable', deliverableRoute);

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// 4. Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});