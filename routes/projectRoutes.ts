import dotenv from 'dotenv';
import { Router, Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { checkToken, authorizeRole } from '../middleware/checkUserToken';
import { prisma } from '../prisma';

dotenv.config();
const router = Router();

// Define Status Enum for validation based on your schema
const ValidStatuses = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];

// POST: Create a new project
router.post(
  '/projects',
  checkToken,
  authorizeRole('BUYER'),
  async (req: Request & { user?: any }, res: Response): Promise<any> => {
    const { title, description, budgetMin, budgetMax, deadline } = req.body;

    if (!title || !description || !budgetMin || !budgetMax || !deadline) {
      return res.status(400).json({ message: 'Please fill all fields' });
    }

    try {
      const buyerId = Number(req.user?.id);
      if (isNaN(buyerId)) return res.status(401).json({ message: 'Invalid user ID' });

      const project = await prisma.project.create({
        data: {
          title,
          description,
          // Schema expects Int, parseFloat might return decimals which DB will reject
          budgetMin: Math.round(parseFloat(budgetMin)),
          budgetMax: Math.round(parseFloat(budgetMax)),
          deadline: new Date(deadline),
          buyerId: buyerId,
        },
      });

      return res.status(201).json({ message: 'Project created successfully', project });
    } catch (error: any) {
      console.error('Error creating project:', error);
      return res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  }
);

// GET: Fetch buyer's projects
router.get('/projects', checkToken, async (req: any, res: Response): Promise<any> => {
  try {
    const projects = await prisma.project.findMany({
      where: { buyerId: Number(req.user?.id) },
    });
    res.status(200).json({ message: 'Projects fetched successfully', project: projects });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET: Fetch open projects for sellers
router.get('/projects/open', checkToken, authorizeRole('SELLER'), async (req: Request, res: Response): Promise<any> => {
  try {
    const projects = await prisma.project.findMany({
      where: {
        sellerId: null,
        status: 'PENDING',
      },
    });
    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch open projects' });
  }
});

// GET: Fetch seller's assigned projects
router.get('/projects/my', checkToken, authorizeRole('SELLER'), async (req: any, res: Response): Promise<any> => {
  try {
    const projects = await prisma.project.findMany({
      where: { sellerId: Number(req.user.id) }
    });
    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch seller projects' });
  }
});

// GET: Single project details
router.get('/projects/:id', checkToken, async (req: Request, res: Response): Promise<any> => {
  const projectId = Number(req.params.id);
  if (isNaN(projectId)) return res.status(400).json({ message: 'Invalid ID' });

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { deliverable: true }
    });
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.status(200).json({ message: 'Project fetched successfully', project });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PUT: Update project or Assign Seller
router.put('/projects/:id', checkToken, async (req: Request, res: Response): Promise<any> => {
  const projectId = Number(req.params.id);
  if (isNaN(projectId)) return res.status(400).json({ message: 'Invalid ID' });

  try {
    // Logic for assigning a seller
    if (req.body.sellerId) {
      const sellerId = Number(req.body.sellerId);
      const updatedProject = await prisma.project.update({
        where: { id: projectId },
        data: {
          sellerId: sellerId,
          status: 'IN_PROGRESS',
        },
      });

      const seller = await prisma.user.findUnique({ where: { id: sellerId } });

      if (seller?.email) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: process.env.MAIL_SENDER_EMAIL, pass: process.env.MAIL_SENDER_PASSWORD },
        });

        await transporter.sendMail({
          from: `"Project Team" <${process.env.MAIL_SENDER_EMAIL}>`,
          to: seller.email,
          subject: '🎉 Project Selected!',
          html: `<h2>Hello ${seller.name},</h2><p>You have been selected for: ${updatedProject.title}</p>`,
        });
      }

      return res.status(200).json({ message: 'Seller selected successfully', project: updatedProject });
    } 
    
    // Logic for updating project details
    const { title, description, budgetMin, budgetMax, deadline } = req.body;
    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        title,
        description,
        budgetMin: budgetMin ? Math.round(parseFloat(budgetMin)) : undefined,
        budgetMax: budgetMax ? Math.round(parseFloat(budgetMax)) : undefined,
        deadline: deadline ? new Date(deadline) : undefined,
      }
    });

    return res.status(200).json({ message: 'Project updated successfully', project });
  } catch (error: any) {
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// DELETE: Delete project
router.delete('/projects/:id', checkToken, authorizeRole('BUYER'), async (req: Request, res: Response): Promise<any> => {
  const projectId = Number(req.params.id);
  
  if (isNaN(projectId)) {
    return res.status(400).json({ message: 'Invalid ID' });
  }
  
  try {
    // Delete in transaction to ensure all-or-nothing
    await prisma.$transaction(async (tx:any) => {
      // Delete all bids related to this project
      await tx.bid.deleteMany({
        where: { projectId }
      });
      
      // Delete deliverable if exists
      await tx.deliverable.deleteMany({
        where: { projectId }
      });
      
      // Finally delete the project
      await tx.project.delete({
        where: { id: projectId }
      });
    });
    
    res.status(200).json({ message: 'Project deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting project:', error);
    res.status(500).json({ message: 'Error deleting project', error: error.message });
  }
});
// PUT: Update Status specifically
router.put('/projects/:id/status', checkToken, async (req: Request, res: Response): Promise<any> => {
  const projectId = Number(req.params.id);
  const { status } = req.body;

  if (!ValidStatuses.includes(status)) {
    return res.status(400).json({ message: 'Invalid status value' });
  }

  try {
    const project = await prisma.project.update({
      where: { id: projectId },
      data: { status }
    });
    res.status(200).json({ message: 'Status updated', project });
  } catch (error: any) {
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

export default router;