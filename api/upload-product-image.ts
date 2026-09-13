import type { IncomingMessage, ServerResponse } from 'http';
import multer from 'multer';
import {
  validateProductImage,
  uploadProductImageToGoogleDrive
} from '../src/server/googleDrive';

// Vercel serverless configuration: disable automatic bodyParser so multer can parse multipart/form-data
export const config = {
  api: {
    bodyParser: false,
  },
};

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

function runMiddleware(req: any, res: any, fn: any): Promise<void> {
  return new Promise((resolve, reject) => {
    fn(req, res, (result: any) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

function verifyAuthorization(req: any): boolean {
  const authHeader = (req.headers.authorization || req.headers.Authorization) as string | undefined;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  const token = authHeader.split(' ')[1]?.trim();
  if (!token || token.length < 3) {
    return false;
  }
  return true;
}

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  // 1. Authentication check
  if (!verifyAuthorization(req)) {
    return res.status(401).json({
      success: false,
      error: 'غير مصرح: يجب تسجيل الدخول كمورد معتمد لرفع صور المنتجات (Unauthorized).'
    });
  }

  // 2. Parse multipart form data
  try {
    await runMiddleware(req, res, upload.single('image'));
  } catch (parseError: any) {
    if (parseError.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'حجم الصورة يتجاوز الحد الأقصى المسموح به وهو 10 ميجابايت (Image exceeds maximum allowed size of 10MB).'
      });
    }
    return res.status(400).json({
      success: false,
      error: parseError.message || 'فشل معالجة بيانات الصورة المرفوعة.'
    });
  }

  const file = req.file;
  if (!file) {
    return res.status(400).json({
      success: false,
      error: 'لم يتم إرسال ملف صورة (No image file uploaded).'
    });
  }

  // 3. Validation
  const validation = validateProductImage(file);
  if (!validation.valid) {
    return res.status(400).json({
      success: false,
      error: validation.error
    });
  }

  // 4. Upload to Google Drive
  try {
    const productId = req.body?.productId || '';
    const result = await uploadProductImageToGoogleDrive({
      buffer: file.buffer,
      mimetype: file.mimetype,
      originalname: file.originalname,
      productId: typeof productId === 'string' ? productId : undefined
    });

    return res.status(200).json({
      success: true,
      fileId: result.fileId,
      imageUrl: result.imageUrl
    });
  } catch (uploadError: any) {
    console.error('Upload to Google Drive handler error:', uploadError.message || 'Upload error');
    return res.status(500).json({
      success: false,
      error: uploadError.message || 'حدث خطأ أثناء رفع الصورة إلى Google Drive.'
    });
  }
}
