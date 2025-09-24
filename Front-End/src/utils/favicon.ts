// Dynamically set favicon using bundled logo asset.
// This ensures the correct hashed file path after Vite build.
import logoPng from '../assets/images/logo/logo.png';

export function setFavicon() {
  if (typeof document === 'undefined') return;
  const head = document.head;

  // Remove existing favicons first to avoid duplicates
  [...head.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]')].forEach(el => el.parentElement?.removeChild(el));

  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  link.href = logoPng; // Vite will transform to built asset URL
  head.appendChild(link);
}
