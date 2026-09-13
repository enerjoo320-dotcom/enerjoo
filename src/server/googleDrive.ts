/**
 * Google Drive File Storage Service for Product Images
 * Server-side OAuth2 integration using refresh token.
 */

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface UploadProductImageResult {
  success: boolean;
  fileId?: string;
  imageUrl?: string;
  error?: string;
}

/**
 * Validates uploaded image file against allowed mime types and size limits.
 */
export function validateProductImage(file: {
  mimetype?: string;
  size?: number;
  originalname?: string;
}): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'لم يتم استلام أي ملف صورة / No image file provided' };
  }

  const mime = (file.mimetype || '').toLowerCase();
  const ext = (file.originalname || '').split('.').pop()?.toLowerCase() || '';

  const isValidMime = ALLOWED_MIME_TYPES.includes(mime);
  const isValidExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext);

  if (!isValidMime && !isValidExt) {
    return {
      valid: false,
      error: 'نوع الملف غير مدعوم. يُسمح فقط بصور من نوع JPG, JPEG, PNG, WebP (Invalid file type. Only JPG, JPEG, PNG, and WebP are allowed).'
    };
  }

  if (file.size && file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'حجم الصورة يتجاوز الحد الأقصى المسموح به وهو 10 ميجابايت (Image exceeds maximum allowed size of 10MB).'
    };
  }

  return { valid: true };
}

/**
 * Exchanges the Google OAuth refresh token for a fresh short-lived access token.
 */
export async function getGoogleDriveAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      'إعدادات Google Drive غير مكتملة في متغيرات البيئة. يرجى التأكد من ضبط GOOGLE_DRIVE_CLIENT_ID و GOOGLE_DRIVE_CLIENT_SECRET و GOOGLE_DRIVE_REFRESH_TOKEN.'
    );
  }

  const tokenEndpoint = 'https://oauth2.googleapis.com/token';

  const bodyParams = new URLSearchParams({
    client_id: clientId.trim(),
    client_secret: clientSecret.trim(),
    refresh_token: refreshToken.trim(),
    grant_type: 'refresh_token'
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: bodyParams.toString()
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('Google Drive token refresh failed with status:', response.status);
    throw new Error(
      'فشل تجديد رمز الوصول (Access Token) لـ Google Drive. يرجى التحقق من صحة Refresh Token وصلاحيات التطبيق.'
    );
  }

  const tokenData = (await response.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    throw new Error('لم يتم استلام رمز الوصول من Google Drive API');
  }

  return tokenData.access_token;
}

/**
 * Uploads an image buffer directly to Google Drive in the specified products folder
 * and sets public read permission on the uploaded file.
 */
export async function uploadProductImageToGoogleDrive(params: {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
  productId?: string;
}): Promise<{ fileId: string; imageUrl: string }> {
  const { buffer, mimetype, originalname, productId } = params;

  // 1. Get access token
  const accessToken = await getGoogleDriveAccessToken();

  // 2. Determine target folder ID
  const folderId = process.env.GOOGLE_DRIVE_PRODUCTS_FOLDER_ID?.trim();

  // 3. Create safe, unique filename
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp'
  };
  const extFromMime = extMap[mimetype.toLowerCase()];
  const extFromOriginal = originalname?.split('.').pop()?.toLowerCase();
  const fileExt = extFromMime || extFromOriginal || 'jpg';

  const cleanProductId = (productId || 'prod').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const safeFileName = `product_${cleanProductId}_${timestamp}_${randomSuffix}.${fileExt}`;

  // 4. Construct RFC 2387 multipart/related body for Google Drive API v3
  const constructMultipartBody = (targetFolderId?: string) => {
    const boundary = `-------EnerjooDriveBoundary${timestamp}`;
    const boundaryDelimiter = `--${boundary}`;

    const metadata: Record<string, any> = {
      name: safeFileName,
      mimeType: mimetype
    };

    if (targetFolderId) {
      metadata.parents = [targetFolderId];
    }

    const metadataHeader = `${boundaryDelimiter}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`;
    const mediaHeader = `${boundaryDelimiter}\r\nContent-Type: ${mimetype}\r\n\r\n`;
    const closeDelimiter = `\r\n${boundaryDelimiter}--\r\n`;

    const multipartBody = Buffer.concat([
      Buffer.from(metadataHeader, 'utf-8'),
      Buffer.from(mediaHeader, 'utf-8'),
      buffer,
      Buffer.from(closeDelimiter, 'utf-8')
    ]);

    return { boundary, multipartBody };
  };

  const uploadEndpoint = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

  let { boundary, multipartBody } = constructMultipartBody(folderId);

  let uploadResponse = await fetch(uploadEndpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': multipartBody.length.toString()
    },
    body: multipartBody
  });

  // If upload failed with folder error or 404 on target folder, retry to root without folderId
  if (!uploadResponse.ok && folderId) {
    const firstErrorText = await uploadResponse.text().catch(() => '');
    console.warn('Initial upload to folderId failed (status ' + uploadResponse.status + '):', firstErrorText, '- Retrying to Google Drive root...');
    
    const rootBody = constructMultipartBody(undefined);
    uploadResponse = await fetch(uploadEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${rootBody.boundary}`,
        'Content-Length': rootBody.multipartBody.length.toString()
      },
      body: rootBody.multipartBody
    });
  }

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text().catch(() => '');
    console.error('Google Drive upload request failed with status:', uploadResponse.status, errorText);
    let parsedMessage = '';
    try {
      const errJson = JSON.parse(errorText);
      parsedMessage = errJson?.error?.message || errJson?.error_description || '';
    } catch {
      parsedMessage = errorText.slice(0, 150);
    }
    throw new Error(parsedMessage ? `فشل رفع الصورة إلى Google Drive: ${parsedMessage}` : 'فشل رفع ملف الصورة إلى Google Drive.');
  }

  const uploadResult = (await uploadResponse.json()) as { id?: string };
  const fileId = uploadResult.id;

  if (!fileId) {
    throw new Error('لم يتم إرجاع معرف الملف (File ID) من Google Drive.');
  }

  // 5. Grant public read permission to this specific file only (anyone with role: reader)
  try {
    const permResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone'
      })
    });

    if (!permResponse.ok) {
      console.warn('Google Drive set permissions warning with status:', permResponse.status);
    }
  } catch (permError) {
    console.warn('Could not set public permission on Google Drive file:', permError);
  }

  // 6. Direct web-viewable CDN URL for Google Drive files
  // lh3.googleusercontent.com/d/{fileId} is Google's direct CDN image delivery
  // which works seamlessly inside HTML <img> tags without cookies or login prompts.
  const imageUrl = `https://lh3.googleusercontent.com/d/${fileId}`;

  return {
    fileId,
    imageUrl
  };
}
