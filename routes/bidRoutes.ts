import Router from 'express';
import { Request, Response } from 'express';
import { checkToken, authorizeRole } from '../middleware/checkUserToken';
import { checkProjectOwnership } from '../middleware/checkProjectOwnership';
import { prisma } from '../prisma';
const router = Router();

router.post('/bids', checkToken, authorizeRole('SELLER'), async (req: any, res: Response): Promise<any> => {
    const { projectId, amount, estimatedTime, message } = req.body;
    
    if (!projectId || !amount || !estimatedTime || !message) {
        return res.status(400).json({ message: 'Please fill all fields' });
    }

    try {
        // Check if seller already bid on this project
        const existingBid = await prisma.bid.findFirst({
            where: {
                projectId: Number(projectId),
                sellerId: req.user.id
            }
        });

        if (existingBid) {
            return res.status(400).json({ message: 'You have already placed a bid on this project' });
        }

        // Check if project exists and is still open
        const project = await prisma.project.findUnique({
            where: { id: Number(projectId) }
        });

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        if (project.status !== 'PENDING') {
            return res.status(400).json({ message: 'This project is no longer accepting bids' });
        }

        const bid = await prisma.bid.create({
            data: {
                projectId: Number(projectId),
                sellerId: req.user.id,
                amount: Math.round(parseFloat(amount) * 100), // Convert to cents
                estimatedTime: estimatedTime.toString(),
                message
            }
        });

        res.status(201).json({
            message: 'Bid placed successfully',
            bid
        });
    } catch (error: any) {
        console.error('Bid creation error:', error);
        res.status(500).json({ message: error.message });
    }
});
router.get('/bids/mine', checkToken, authorizeRole('SELLER'), async (req: Request & { user?: any }, res: Response) => {
    try {
        const Bids = await prisma.bid.findMany({
            where: {
                sellerId: req.user.id
            },
            include: {
                project: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        res.status(200).json({ Bids });
    } catch (error) {
        console.error('Error fetching seller bids:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


router.get('/projects/:id/bids', checkToken, authorizeRole('BUYER'), checkProjectOwnership, async (req: any, res: Response): Promise<any> => {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({ message: 'Project ID is required' });
    }
    try {
        const Bid = await prisma.bid.findMany({
            where: {
                projectId: Number(id)
            }
        })
        res.status(200).json({
            message: 'Bids fetched successfully',
            bids: Bid.map((bid) => ({
                id: bid.id,
                projectId: bid.projectId,
                sellerId: bid.sellerId,
                amount: bid.amount,
                estimatedTime: bid.estimatedTime,
                message: bid.message
            }))
        })
    } catch {
        return res.status(500).json({ message: 'Internal server error' });
    }
})

router.get('/projects/:id/hasBid', checkToken, authorizeRole('SELLER'), async (req: any, res: Response): Promise<any> => {
    const { id } = req.params;
    
    if (!id || isNaN(Number(id))) {
        return res.status(400).json({ message: 'Valid project ID is required' });
    }

    try {
        const existingBid = await prisma.bid.findFirst({
            where: {
                projectId: Number(id),
                sellerId: req.user.id
            }
        });

        res.status(200).json({
            hasBid: !!existingBid
        });
    } catch (error) {
        console.error('Error checking bid status:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

router.get('/projects/:id/details', checkToken, authorizeRole('SELLER'), async (req: Request, res: Response): Promise<any> => {
    const { id } = req.params;
    
    if (!id || isNaN(Number(id))) {
        return res.status(400).json({ message: 'Valid project ID is required' });
    }

    try {
        const project = await prisma.project.findUnique({
            where: {
                id: Number(id)
            }
        });

        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        res.status(200).json({
            id: project.id.toString(),
            title: project.title,
            description: project.description,
            budget: `$${project.budgetMin} - $${project.budgetMax}`,
            deadline: new Date(project.deadline).toLocaleDateString(),
            status: project.status
        });
    } catch (error) {
        console.error('Error fetching project details:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


export default router;