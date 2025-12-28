import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  destination: (req:any, file:any, cb:any) => {
    cb(null, 'uploads/'); 
  },
  filename: (req:any, file:any, cb:any) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${file.fieldname}${ext}`);
  }
});

const upload = multer({ storage });

export default upload;
