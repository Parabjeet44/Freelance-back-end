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

// Use the exact URL from your Railway frontend
const allowedOrigin = process.env.FRONT_END_URL || 'https://freelance-front-end-production-0494.up.railway.app';

const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Log for debugging - you can see this in Railway logs
        console.log('Incoming Request Origin:', origin);
        
        if (!origin || origin === allowedOrigin || origin === `${allowedOrigin}/`) {
            callback(null, true);
        } else {
            callback(null, false);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    optionsSuccessStatus: 200 
};

// 1. Apply CORS middleware
app.use(cors(corsOptions));

// 2. FIXED: Catch-all OPTIONS handler using Express 5 syntax
app.options('/:path*', cors(corsOptions));

app.use(cookieParser());
app.use(express.json());

// Static files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/project', projectRoutes);
app.use('/api/bid', bidRoutes);
app.use('/api/deliverable', deliverableRoute);

// Use Railway's dynamic PORT
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`CORS allowed origin: ${allowedOrigin}`);
});