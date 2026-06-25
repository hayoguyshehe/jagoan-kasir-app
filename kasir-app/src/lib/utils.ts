export function getContrastColor(hex: string): string {
  // If no hex provided, fallback to white
  if (!hex) return '#ffffff';
  
  // Remove # if present
  hex = hex.replace('#', '');
  
  // If 3 digits, convert to 6 digits
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  
  // Parse r, g, b
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate relative luminance (per W3C guidelines)
  // Simple YIQ formula
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  
  // If background is light, return dark text, else light text
  return (yiq >= 128) ? '#000000' : '#ffffff';
}
