/**
 * Service for uploading files to Cloudflare R2 via Cloudflare Worker (Product Images)
 * and Cloudinary (Supplier Avatars / Legacy).
 */

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Compresses an image file using browser Canvas API.
 */
export async function compressImage(
  file: File, 
  maxWidth = 400, 
  maxHeight = 400, 
  quality = 0.85
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(err);

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Output as webp if supported, or image/jpeg
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Image compression failed'));
          }
        },
        outputType,
        quality
      );
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Uploads any product image/datasheet to Cloudinary.
 */
export async function uploadFile(file: File): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  // Graceful fallback if not configured
  if (!cloudName || !uploadPreset) {
    console.warn('Cloudinary configuration missing. Using local object URL as fallback for presentation.');
    return URL.createObjectURL(file);
  }

  const isPdf = file.type === "application/pdf";
  const uploadUrl = isPdf
    ? `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`
    : `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);

  try {
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    const data: any = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Failed to upload to Cloudinary');
    }

    return data.secure_url;
  } catch (error) {
    console.error('Cloudinary Upload Error:', error);
    // Fallback so the app doesn't crash
    return URL.createObjectURL(file);
  }
}

/**
 * Converts a Canvas Blob to Base64 Data URL.
 */
function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Uploads a Supplier Profile Image to Cloudinary with compression & validation.
 * Supported formats: JPG, JPEG, PNG, WEBP. Max original size: 5 MB.
 * Automatically falls back to compressed Base64 Data URL if Cloudinary is unavailable.
 */
export async function uploadSupplierProfileImage(file: File): Promise<string> {
  // 1. Format check
  const fileExt = file.name.split('.').pop()?.toLowerCase();
  const isValidFormat = ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase()) || 
    ['jpg', 'jpeg', 'png', 'webp'].includes(fileExt || '');
    
  if (!isValidFormat) {
    throw new Error('Unsupported format. Please upload JPG, JPEG, PNG, or WEBP.');
  }

  // 2. Size check (5MB max)
  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error('Image exceeds the maximum allowed size of 5 MB.');
  }

  // 3. Compress image to optimal avatar dimensions (400x400 max)
  let compressedBlob: Blob;
  try {
    compressedBlob = await compressImage(file, 400, 400, 0.85);
  } catch (compressionErr) {
    console.warn('Image compression fallback to original:', compressionErr);
    compressedBlob = file;
  }

  // Generate Base64 Data URL as reliable self-contained fallback
  const base64DataUrl = await blobToDataUrl(compressedBlob);

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  // If Cloudinary credentials are not present, return the persistent Base64 Data URL directly
  if (!cloudName || !uploadPreset) {
    return base64DataUrl;
  }

  // Attempt Cloudinary upload
  try {
    const formData = new FormData();
    formData.append('file', compressedBlob);
    formData.append('upload_preset', uploadPreset);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: formData,
    });

    const data: any = await response.json();

    if (response.ok && data.secure_url) {
      return data.secure_url;
    }
  } catch (cloudinaryErr) {
    console.warn('Cloudinary upload unsuccessful, utilizing compressed Data URL:', cloudinaryErr);
  }

  return base64DataUrl;
}

export interface GoogleDriveUploadResult {
  fileId: string;
  imageUrl: string;
}

export interface ProductImageUploadResult {
  key?: string;
  imageUrl: string;
}

const CLOUDFLARE_WORKER_API = 'https://enerjoo-api.enerjoo320.workers.dev';

/**
 * Uploads a Product Image to Cloudflare R2 via Cloudflare Worker:
 * POST https://enerjoo-api.enerjoo320.workers.dev/upload
 *
 * Flow: Supplier -> Frontend -> Worker /upload -> R2 -> image_url -> D1
 *
 * Requirements:
 * 1. Checks that file exists
 * 2. Checks that file is an image (JPG, PNG, WebP) and <= 10MB
 * 3. Sends multipart/form-data with field name "file"
 * 4. Receives JSON response from Worker
 * 5. Extracts and returns image_url
 */
export async function uploadProductImage(file: File): Promise<string> {
  if (!file) {
    throw new Error('يرجى اختيار ملف الصورة.');
  }

  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isAllowed = allowed.includes(file.type.toLowerCase()) || ['jpg', 'jpeg', 'png', 'webp'].includes(ext);

  if (!isAllowed) {
    throw new Error('نوع الملف غير مدعوم. يرجى اختيار صورة بصيغة JPG أو PNG أو WebP.');
  }

  const MAX_10MB = 10 * 1024 * 1024;
  if (file.size > MAX_10MB) {
    throw new Error('حجم الصورة كبير جداً. الحد الأقصى المسموح به هو 10 ميجابايت.');
  }

  // Send multipart/form-data with file field named "file"
  const formData = new FormData();
  formData.append('file', file, file.name);

  let response: Response;
  try {
    response = await fetch(`${CLOUDFLARE_WORKER_API}/upload`, {
      method: 'POST',
      body: formData,
    });
  } catch (error) {
    console.error('Cloudflare R2 upload network error:', error);
    throw new Error('تعذر الاتصال بخادم إينرجو لرفع الصورة إلى Cloudflare R2. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.');
  }

  let data: any = {};
  try {
    data = await response.json();
  } catch {
    // Non-JSON response fallback
  }

  if (!response.ok || !data?.success) {
    console.error('Cloudflare R2 upload failed:', {
      status: response.status,
      data,
    });
    throw new Error(data?.error || `فشل رفع الصورة إلى Cloudflare R2 (رمز الخطأ: ${response.status}).`);
  }

  const imageUrl = data.image_url || data.url;
  if (!imageUrl) {
    throw new Error('تم رفع الصورة إلى Cloudflare R2 ولكن لم يتم استلام رابط الصورة من الخادم.');
  }

  return imageUrl;
}

/**
 * Backward-compatible wrapper for uploadProductImage
 */
export async function uploadProductImageToDrive(
  file: File,
  _productId?: string,
  _userUid?: string
): Promise<GoogleDriveUploadResult> {
  const imageUrl = await uploadProductImage(file);
  return {
    fileId: imageUrl,
    imageUrl,
  };
}


