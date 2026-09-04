export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;
export const PRINT_DPI = 300;
export const MM_PER_INCH = 25.4;
export const EDITOR_PX_PER_MM = 6;

export function mmToPx(mm, dpi = PRINT_DPI) {
  return (mm / MM_PER_INCH) * dpi;
}
