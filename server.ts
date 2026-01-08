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

// 1. Standard CORS middleware
app.use(cors({
    origin: process.env.FRONT_END_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2. The Fix: Use a Regex to catch all OPTIONS requests
// This avoids the "PathError" in Express 5
app.options(/.* subterranean/, cors()); 
app.options(/^.*$/, cors()); 

app.use(cookieParser());
app.use(express.json());

// 3. Routes
app.use('/api/auth', authRoutes);
app.use('/api/project', projectRoutes);
app.use('/api/bid', bidRoutes);
app.use('/api/deliverable', deliverableRoute);

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});