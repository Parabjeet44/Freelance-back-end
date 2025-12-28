import { Request, Response, Router } from "express";
import { prisma } from "../prisma";
import { checkProjectOwnership } from "../middleware/checkProjectOwnership";
import { checkToken, authorizeRole } from '../middleware/checkUserToken';
import upload from '../middleware/upload';

const router = Router();

router.post('/projects/:id/deliverables',
    checkToken,
    authorizeRole('SELLER'),
    upload.single('file'),
    async (req: Request, res: Response): Promise<any> => {
        const projectId = parseInt(req.params.id);
        const sellerId = (req as any).user.id;
        const { link } = req.body;
        const fileUrl = (req as any).file ? `/uploads/${(req as any).file.filename}` : null;

        if (!fileUrl && !link) {
            return res.status(400).json({ error: 'Please upload a file or provide a link.' });
        }

        try {
            // Ensure seller is assigned to this project
            const project = await prisma.project.findUnique({
                where: { id: projectId },
                include: { seller: true }
            });

            if (!project || project.sellerId !== sellerId) {
                return res.status(403).json({ error: 'You are not authorized to upload for this project.' });
            }

            const deliverable = await prisma.deliverable.create({
                data: {
                    projectId,
                    sellerId,
                    fileUrl,
                    link
                }
            });

            res.status(201).json({ message: 'Deliverable uploaded successfully', deliverable });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Something went wrong.' });
        }
    })
router.get('/projects/:id/deliverables', checkToken, authorizeRole('BUYER'), checkProjectOwnership, async (req: Request, res: Response): Promise<any> => {
    const projectId = parseInt(req.params.id);

    try {
        const deliverable = await prisma.deliverable.findFirst({
            where: { projectId },
            select: {
                id: true,
                fileUrl: true,
                link: true,
                seller: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        if (!deliverable) {
            return res.status(404).json({ error: 'No deliverables found for this project.' });
        }

        return res.status(200).json({ deliverable });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to fetch deliverables.' });
    }
}
);

export default router;


