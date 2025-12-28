import { Request, Response, Router } from 'express';
import { prisma } from '../prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { checkToken } from '../middleware/checkUserToken';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { generateTokens } from '../utils/jwt';

dotenv.config();

const router = Router();

// Register
router.post('/register', async (req: Request, res: Response): Promise<any> => {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
        return res.status(400).json({ message: 'Please fill all fields' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { name, email, password: hashedPassword, role },
        });

        res.status(201).json({
            message: 'User created successfully',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Login
router.post('/login', async (req: Request, res: Response): Promise<any> => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Please fill all fields' });
    }

    try {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) return res.status(401).json({ message: 'Email is not registered' });

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) return res.status(401).json({ message: 'Invalid password' });

        const payload = { id: user.id, email: user.email, role: user.role };
        const { accessToken, refreshToken } = generateTokens(payload);


        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken },
        });


        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
        res.cookie('accessToken', accessToken, {
            httpOnly: false,    
            secure: true,     
            sameSite: 'none',
            maxAge: 24 * 60 * 60 * 1000,  
        });

        res.status(200).json({
            message: 'Login successful',
            accessToken,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Refresh token route
router.post('/token', async (req: Request, res: Response): Promise<any> => {
    const cookies = req.cookies;

    // Check if the refresh token exists in cookies
    if (!cookies?.refreshToken) {
        return res.status(401).json({ message: 'No refresh token provided' });
    }

    const refreshToken = cookies.refreshToken;

    try {
        // Verify the refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string) as any;

        // Check if the user exists in the database
        const user = await prisma.user.findUnique({ where: { id: decoded.id } });

        if (!user || user.refreshToken !== refreshToken) {
            return res.status(403).json({ message: 'Invalid refresh token' });
        }

        // Generate new tokens
        const payload = { id: user.id, email: user.email, role: user.role };
        const { accessToken, refreshToken: newRefreshToken } = generateTokens(payload);

        // Update the refresh token in the database
        await prisma.user.update({
            where: { id: user.id },
            data: { refreshToken: newRefreshToken },
        });

        // Set new refresh token as a cookie
        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Secure cookie in production
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        // Respond with the new access token
        res.status(200).json({ accessToken });
    } catch (err) {
        console.error('Refresh error:', err);
        return res.status(403).json({ message: 'Invalid or expired refresh token' });
    }
});


// Get current user
router.get('/me', checkToken, async (req: any, res: Response): Promise<any> => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
        });

        if (!user) return res.status(404).json({ message: 'User not found' });

        res.status(200).json({
            message: 'User found',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

// Logout
router.post('/logout', async (req: Request, res: Response): Promise<any> => {
    try {
        const cookies = req.cookies;

        if (cookies?.refreshToken) {
            const decoded = jwt.verify(cookies.refreshToken, process.env.JWT_REFRESH_SECRET as string) as any;

            await prisma.user.update({
                where: { id: decoded.id },
                data: { refreshToken: null },
            });
        }

        res.clearCookie('refreshToken');
        res.status(200).json({ message: 'Logged out successfully' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to logout' });
    }
});

export default router;
