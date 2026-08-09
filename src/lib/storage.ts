import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from './firebase';

export const storage = getStorage(app);

const MAX_FILE_SIZE_MB = 5;
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];

/**
 * Validates and uploads a Task 1 image file to Firebase Storage with a Base64 data URL fallback.
 */
export async function uploadTask1Image(file: File): Promise<string> {
  // 1. Validation
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error('Invalid image format. Please upload a PNG, JPG, WEBP, or SVG file.');
  }

  const fileSizeMB = file.size / (1024 * 1024);
  if (fileSizeMB > MAX_FILE_SIZE_MB) {
    throw new Error(`Image size exceeds ${MAX_FILE_SIZE_MB}MB limit. Please upload a smaller image.`);
  }

  // 2. Try Firebase Storage Upload
  try {
    const filename = `task1_images/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const storageRef = ref(storage, filename);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(snapshot.ref);
    return downloadUrl;
  } catch (err) {
    console.warn('Firebase Storage upload warning, using high-performance DataURL fallback:', err);
    // 3. Fallback: Convert to optimized DataURL string
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert image to DataURL'));
        }
      };
      reader.onerror = () => reject(new Error('File reading error'));
      reader.readAsDataURL(file);
    });
  }
}
