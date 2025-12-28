import dotenv from 'dotenv';
import Router from 'express';
import { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { checkToken, authorizeRole } from '../middleware/checkUserToken';
import { prisma } from '../prisma';
dotenv.config();
const router = Router();

interface Project {
    id:number;
    title:string;
    description:string;
    budgetMin:number;
    budgetMax:number;
    deadline:Date;
    buyerId:number;
    status:string;
}

router.post(
  '/projects',
  checkToken,
  authorizeRole('BUYER'),
  async (req: Request & { user?: any }, res: Response): Promise<any> => {
    const { title, description, budgetMin, budgetMax, deadline } = req.body;

    // Input validation
    if (!title || !description || !budgetMin || !budgetMax || !deadline) {
      return res.status(400).json({ message: 'Please fill all fields' });
    }

    // Debug log
    console.log('Received new project:', {
      title,
      description,
      budgetMin,
      budgetMax,
      deadline,
      user: req.user,
    });

    try {
      // Ensure user ID exists
      if (!req.user?.id) {
        return res.status(401).json({ message: 'Unauthorized: Missing user ID' });
      }

      const project = await prisma.project.create({
        data: {
          title,
          description,
          budgetMin: parseFloat(budgetMin),
          budgetMax: parseFloat(budgetMax),
          deadline: new Date(deadline), // Convert deadline string to Date
          buyerId: req.user.id,
        },
      });

      return res.status(201).json({
        message: 'Project created successfully',
        project: {
          id: project.id,
          title: project.title,
          description: project.description,
          budgetMin: project.budgetMin,
          budgetMax: project.budgetMax,
          deadline: project.deadline,
          buyerId: project.buyerId,
        },
      });
    } catch (error: any) {
      console.error('Error creating project:', error.message, error.stack);
      return res.status(500).json({
        message: 'Internal server error',
        error: error.message,
      });
    }
  }
);

router.get('/projects',checkToken,async (req:any,res:Response):Promise<any> => {
    try{
        const projects=await prisma.project.findMany({
            where:{
                buyerId:req.user?.id
            }
        })
        const projectData = projects.map(( project:Project ) => ({
            id: project.id,
            title: project.title,
            description: project.description,
            budgetMin: project.budgetMin,
            budgetMax: project.budgetMax,
            deadline: project.deadline,
            status: project.status
        }));
        res.status(200).json({
            message:'Projects fetched successfully',
            project:projectData

        })
    }catch{
        res.status(500).json({message:'Internal server error'})
    }
 })

router.get('/projects/open',checkToken,authorizeRole('SELLER'), async (req: Request, res: Response): Promise<any> => {
  try {
    const projects = await prisma.project.findMany({
      where: {
        sellerId: null,
        status: 'PENDING',
      },
    });

    const openProjects = projects.map(project => ({
      id: project.id,
      title: project.title,
      description: project.description,
      budgetMin: project.budgetMin,
      budgetMax: project.budgetMax,
      deadline: project.deadline ? project.deadline.toISOString().split('T')[0] : null,
      status: project.status,
    }));

    res.status(200).json(openProjects);
  } catch (error) {
    console.error("Error in /projects/open:", error);
    res.status(500).json({
      message: 'Failed to fetch open projects',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});


router.get('/projects/my', checkToken, authorizeRole('SELLER'), async (req:any, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: {
        sellerId: Number(req.user.id)
      }
    });

    const myProjects = projects.map(project => ({
      id: project.id,
      title: project.title,
      description: project.description,
      budgetMin:project.budgetMin,
      budgetMax:project.budgetMax,
      deadline: project.deadline.toISOString().split('T')[0],
      status: project.status
    }));

    res.status(200).json(myProjects);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch seller projects', error });
  }
});


router.get('/projects/:id',checkToken, async (req:Request,res:Response):Promise<any> => {
    const { id }=req.params;
    if (!id) {
        return res.status(400).json({ message: 'Please provide a project ID' })
    }
    try {
        const project = await prisma.project.findUnique({
            where: {
                id: Number(id)
            },
            include:{
                deliverable:true,
            }
        })
        if (!project) {
            return res.status(404).json({ message: 'Project not found' })
        }
        res.status(200).json({
            message: 'Project fetched successfully',
            project: {
                id: project.id,
                title: project.title,
                description: project.description,
                budgetMin: project.budgetMin,
                budgetMax: project.budgetMax,
                deadline: project.deadline,
                status:project.status,
                buyerId: project.buyerId,
                sellerId:project.sellerId
            }
        })
    } catch (error) {
        res.status(500).json({ message: error })
    }
 })


router.put('/projects/:id', checkToken, async (req:Request, res:Response):Promise<any> => {
  const { id } = req.params
  const { sellerId } = req.body

  try {
    const updatedProject = await prisma.project.update({
      where: { id: parseInt(id) },
      data: {
        sellerId: parseInt(sellerId),
        status: 'IN_PROGRESS',
      },
    })

    // Send mail to selected seller
    const seller = await prisma.user.findUnique({
      where: { id: parseInt(sellerId) },
    })

    if (!seller || !seller.email) {
      return res.status(404).json({ message: 'Seller not found or email missing' })
    }

    // Set up transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_SENDER_EMAIL,
        pass: process.env.MAIL_SENDER_PASSWORD,
      },
    })

    const mailOptions = {
      from: `"Project Team" <${process.env.MAIL_SENDER_EMAIL}>`,
      to: seller.email,
      subject: '🎉 You’ve been selected for a project!',
      html: `
        <h2>Hello ${seller.name || 'Seller'},</h2>
        <p>You have been selected to work on the project: <strong>${updatedProject.title}</strong>.</p>
        <p>Status: <strong>${updatedProject.status}</strong></p>
        <br>
        <p>Log in to your account to get started.</p>
        <hr>
        <p>Thank you,<br/>Project Team</p>
      `,
    }

    await transporter.sendMail(mailOptions)

    res.status(200).json({
      message: 'Seller selected successfully and email sent',
      project: updatedProject,
    })
  } catch (error) {
    console.error('Error selecting seller:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

router.delete('/projects/:id',checkToken,authorizeRole('BUYER'),async (req:Request,res:Response):Promise<any> => {
    const { id }=req.params;
    if (!id) {
        return res.status(400).json({ message: 'Please provide a project ID' })
    }
    try {
        const project = await prisma.project.delete({
            where: {
                id: Number(id)
            }
        })
        res.status(200).json({
            message: 'Project deleted successfully',
            project: {
                id: project.id,
                title: project.title,
                description: project.description,
                budgetMin: project.budgetMin,
                budgetMax: project.budgetMax,
                deadline: project.deadline
            }
        })
    } catch (error) {
        res.status(500).json({ message: error })
    }
 })

router.put('/projects/:id/status',checkToken, async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;
  const { status } = req.body;

  const projectId = Number(id);
  if (!id || isNaN(projectId)) {
    return res.status(400).json({ message: 'Invalid project ID' });
  }

  try {
    const project = await prisma.project.update({
      where: {
        id: projectId
      },
      data: {
        status
      }
    });

    res.status(200).json({
      message: 'Project status updated successfully',
      project: {
        id: project.id,
        title: project.title,
        description: project.description,
        budgetMin: project.budgetMin,
        budgetMax: project.budgetMax,
        deadline: project.deadline,
        status: project.status
      }
    });
  } catch (error: any) {
    console.error('Prisma error:', error.message);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});






export default router;