export type WorkerErrorClass = 'invalid_input' | 'quota' | 'auth' | 'rate_limit' | 'provider' | 'network' | 'timeout' | 'cancelled';

export interface WorkerRecognitionBody {
  requestId?: string;
  image?: string;
  mime?: string;
  formulaType?: 'auto' | 'math' | 'physics' | 'chemistry';
  mode?: 'single' | 'multiple';
}

export function validateRecognitionBody(body: WorkerRecognitionBody): { valid: true } | { valid: false; errorClass: WorkerErrorClass; message: string } {
  if (!body.image || !body.image.startsWith('data:image/')) return { valid: false, errorClass: 'invalid_input', message: 'Missing or invalid image data' };
  if (!body.mime || !/^image\/(png|jpeg|webp|gif)$/.test(body.mime)) return { valid: false, errorClass: 'invalid_input', message: 'Unsupported image MIME' };
  if (body.formulaType && !['auto', 'math', 'physics', 'chemistry'].includes(body.formulaType)) return { valid: false, errorClass: 'invalid_input', message: 'Invalid formula type' };
  if (body.mode && !['single', 'multiple'].includes(body.mode)) return { valid: false, errorClass: 'invalid_input', message: 'Invalid recognition mode' };
  if (body.image.length > 14 * 1024 * 1024) return { valid: false, errorClass: 'invalid_input', message: 'Image payload too large' };
  return { valid: true };
}
