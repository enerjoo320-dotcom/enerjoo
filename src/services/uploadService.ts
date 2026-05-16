/**
 * Service for uploading files to Cloudinary using Unsigned Uploads.
 */
export async function uploadFile(file: File): Promise<string> {
  const cloudName = (import.meta as any).env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = (import.meta as any).env.VITE_CLOUDINARY_UPLOAD_PRESET;

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
