const SUPPORTED_VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-m4v',
  'video/webm',
]);

const SUPPORTED_VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm']);
const SUPPORTED_AUDIO_EXTENSIONS = new Set([
  '.aac',
  '.aif',
  '.aiff',
  '.flac',
  '.m4a',
  '.mp3',
  '.oga',
  '.ogg',
  '.opus',
  '.wav',
  '.wma',
]);

export const UPLOAD_ACCEPT_VALUE = 'audio/*,video/mp4,video/quicktime,video/x-m4v,video/webm,.mp4,.mov,.m4v,.webm';

function getExtension(filename: string): string {
  const cleaned = (filename || '').split('?')[0].split('#')[0];
  const dot = cleaned.lastIndexOf('.');
  if (dot === -1) return '';
  return cleaned.slice(dot).toLowerCase();
}

function normalizeMime(type: string): string {
  return (type || '').split(';')[0].trim().toLowerCase();
}

export function isSupportedUploadFile(file: File): boolean {
  const mime = normalizeMime(file.type);
  const ext = getExtension(file.name || '');

  if (mime.startsWith('audio/')) return true;
  if (SUPPORTED_VIDEO_MIME_TYPES.has(mime)) return true;
  if (SUPPORTED_AUDIO_EXTENSIONS.has(ext) || SUPPORTED_VIDEO_EXTENSIONS.has(ext)) return true;
  return false;
}

export function isVideoUploadFile(file: File): boolean {
  const mime = normalizeMime(file.type);
  const ext = getExtension(file.name || '');

  if (SUPPORTED_VIDEO_MIME_TYPES.has(mime)) return true;
  return SUPPORTED_VIDEO_EXTENSIONS.has(ext);
}

export function isVideoMedia(input: { filename?: string | null; url?: string | null; title?: string | null }): boolean {
  return (
    SUPPORTED_VIDEO_EXTENSIONS.has(getExtension(input.filename || '')) ||
    SUPPORTED_VIDEO_EXTENSIONS.has(getExtension(input.url || '')) ||
    SUPPORTED_VIDEO_EXTENSIONS.has(getExtension(input.title || ''))
  );
}
