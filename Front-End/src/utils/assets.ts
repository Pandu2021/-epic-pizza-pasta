// Build Vite asset URL for menu images using the file name stored in DB
export function menuImg(fileName?: string) {
  if (!fileName) return '';
  try {
    return new URL(`../assets/images/menu/${fileName}`, import.meta.url).href;
  } catch {
    return '';
  }
}
