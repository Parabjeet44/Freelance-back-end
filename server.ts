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

// 1. Define allowed origins (Handle both with and without trailing slash)
const allowedOrigin = process.env.FRONT_END_URL;

const corsOptions = {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
        // Allow requests with no origin (like mobile apps or curl) 
        // or check if the origin matches our allowed domain
        if (!origin || origin === allowedOrigin || origin === `${allowedOrigin}/`) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

// 2. Apply CORS middleware
app.use(cors(corsOptions));

// 3. Explicitly handle Preflight requests for all routes
app.options('*', cors(corsOptions));

app.use(cookieParser());
app.use(express.json());

// Static files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/project', projectRoutes);
app.use('/api/bid', bidRoutes);
app.use('/api/deliverable', deliverableRoute);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`CORS allowed origin: ${allowedOrigin}`);
});