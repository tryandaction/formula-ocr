// File handling utilities - validation, base64 conversion, download

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

// Supported formats and size limit
const ALLOWED_FORMATS = ['image/jpeg', 'image/png', 'image/heic'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Validates a file for upload
 * @param file - The file to validate
 * @returns Validation result with error message if invalid
 */
export function validateFile(file: File): FileValidationResult {
  // Check file type
  if (!ALLOWED_FORMATS.includes(file.type)) {
    return {
      valid: false,
      error: 'Please upload a JPG, PNG, or HEIC image'
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'File size must be under 10MB'
    };
  }

  return { valid: true };
}

/**
 * Converts a file to base64 string
 * @param file - The file to convert
 * @returns Promise resolving to base64 data URL
 */
export function convertToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to read file as base64'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Gets the media type from a file
 * @param file - The file to get media type from
 * @returns The MIME type string
 */
export function getMediaType(file: File): string {
  return file.type || 'image/jpeg';
}

/**
 * Downloads LaTeX content as a .tex file
 * @param latex - The LaTeX content to download
 * @param filename - Optional filename (default: formula.tex)
 */
export function downloadAsTexFile(latex: string, filename: string = 'formula.tex'): void {
  const blob = new Blob([latex], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Creates a Blob from LaTeX content (for testing)
 * @param latex - The LaTeX content
 * @returns Blob containing the LaTeX
 */
export function createTexBlob(latex: string): Blob {
  return new Blob([latex], { type: 'text/plain;charset=utf-8' });
}
