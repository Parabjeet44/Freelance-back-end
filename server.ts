import express, { Request, Response, NextFunction } from 'express';
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

// Use the exact domain from your request headers
const allowedOrigin = 'https://freelance-front-end-production-0494.up.railway.app';

const corsOptions = {
    origin: (origin: string | undefined, callback: any) => {
        // Allow requests with no origin or matching origin
        if (!origin || origin === allowedOrigin) {
            callback(null, true);
        } else {
            callback(null, false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 200
};

// 1. Apply CORS globally
app.use(cors(corsOptions));

// 2. Middleware to ensure headers are set on every single response
app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');

    // If it's a preflight, stop here and send 200
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(cookieParser());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/project', projectRoutes);
app.use('/api/bid', bidRoutes);
app.use('/api/deliverable', deliverableRoute);

app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});