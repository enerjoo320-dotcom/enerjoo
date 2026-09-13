import { auth } from '../lib/firebase';
import { safeLocalStorage } from '../utils/safeStorage';

/**
 * Service for uploading files to Google Drive (Product Images)
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

    const data = await response.json();

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

    const data = await response.json();

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

/**
 * Uploads a Product Image to Google Drive via the secure backend endpoint /api/upload-product-image.
 * - Centralized storage on Google Drive
 * - Direct image URL for web display (lh3.googleusercontent.com/d/{fileId})
 * - Sends authorization header using logged-in Firebase user token
 */
export async function uploadProductImageToDrive(
  file: File,
  productId?: string,
  userUid?: string
): Promise<GoogleDriveUploadResult> {
  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isAllowed = allowed.includes(file.type.toLowerCase()) || ['jpg', 'jpeg', 'png', 'webp'].includes(ext);

  if (!isAllowed) {
    throw new Error('نوع الملف غير مدعوم. يرجى اختيار صورة بصيغة JPG أو PNG أو WebP.');
  }

  // Optimize large images: compress any image over 1.5MB to max 1920x1920 to ensure fast, reliable upload
  let fileToUpload: File | Blob = file;
  const COMPRESS_THRESHOLD = 1.5 * 1024 * 1024; // 1.5 MB
  if (file.size > COMPRESS_THRESHOLD) {
    try {
      const compressedBlob = await compressImage(file, 1920, 1920, 0.88);
      fileToUpload = new File([compressedBlob], file.name, { type: compressedBlob.type || file.type });
    } catch (compressErr) {
      console.warn('Auto compression note:', compressErr);
    }
  }

  const MAX_10MB = 10 * 1024 * 1024;
  if (fileToUpload.size > MAX_10MB) {
    throw new Error('حجم الصورة كبير جداً. الحد الأقصى المسموح به هو 10 ميجابايت.');
  }

  // Retrieve current user Firebase ID token with timeout safeguard, or fallback session token
  let token: string | null = null;
  try {
    if (auth.currentUser) {
      token = await Promise.race([
        auth.currentUser.getIdToken(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500))
      ]);
    }
  } catch (tokenErr) {
    console.warn("Could not get Firebase ID token, using fallback session token:", tokenErr);
  }

  if (!token) {
    const mockUid = safeLocalStorage.getItem("enerjoo_mock_auth_uid") || userUid;
    if (mockUid) {
      token = `session_${mockUid}`;
    } else {
      token = 'supplier_session_active';
    }
  }

  // Execute upload with automatic single retry for transient container warmups or network hiccups
  let response: Response | null = null;
  let responseText = '';
  let data: any = {};

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const formData = new FormData();
      formData.append('image', fileToUpload, file.name);
      if (productId) {
        formData.append('productId', productId);
      }

      response = await fetch('/api/upload-product-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      responseText = await response.text();
      try {
        data = JSON.parse(responseText);
      } catch {
        data = {};
      }

      // If success or expected client-side error (400, 401, 403, 413), break loop
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        break;
      }

      // If server returned 502/503/504 (e.g. dev server warmup or restart), wait and retry once
      if (attempt === 1 && (response.status >= 500 || !response.ok)) {
        console.warn(`Upload attempt 1 returned status ${response.status}. Retrying in 1000ms...`);
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (netErr) {
      if (attempt === 1) {
        console.warn('Upload network error on attempt 1, retrying in 1000ms...', netErr);
        await new Promise((r) => setTimeout(r, 1000));
      } else {
        throw new Error('تعذر الاتصال بالخادم لرفع الصورة. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.');
      }
    }
  }

  if (!response || !response.ok || !data.success) {
    let errorMsg = data.error;
    if (!errorMsg) {
      if (response?.status === 413) {
        errorMsg = 'حجم ملف الصورة كبير جداً (أقصى حد 10 ميجابايت).';
      } else if (response?.status === 401) {
        errorMsg = 'غير مصرح: يجب تسجيل الدخول كمورد لرفع صور المنتجات.';
      } else if (response?.status === 502 || response?.status === 503 || response?.status === 504) {
        errorMsg = 'الخادم قيد التشغيل حالياً، يرجى إعادة المحاولة خلال ثوانٍ.';
      } else if (responseText && !responseText.startsWith('<')) {
        errorMsg = responseText.slice(0, 150);
      } else {
        errorMsg = 'فشل رفع صورة المنتج إلى Google Drive. يرجى المحاولة مرة أخرى.';
      }
    }
    throw new Error(errorMsg);
  }

  return {
    fileId: data.fileId,
    imageUrl: data.imageUrl,
  };
}


