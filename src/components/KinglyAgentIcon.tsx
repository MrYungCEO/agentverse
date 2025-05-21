
import type { SVGProps } from 'react';

const KinglyAgentIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 60 80"
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    {...props}
  >
    {/* Crown: More defined structure */}
    <path d="M30 5 L27 17 L20 14 L24 22 L30 17 L36 22 L40 14 L33 17 Z" />

    {/* Lightbulb Body: Pear-shaped, sits on base */}
    {/* Adjusted Y for top (20), bottom (70 before base). X for width. */}
    <path d="M18 70 C10 70, 8 60, 12 45 C15 30, 25 20, 30 20 C35 20, 45 30, 48 45 C52 60, 50 70, 42 70 Z" />
    
    {/* Lightbulb Base: Positioned correctly under the bulb body, with thread suggestions */}
    <rect x="22" y="70" width="16" height="10" rx="2" />
    {/* Thread cutouts - these are filled with background color to appear as indentations */}
    <rect x="22" y="72.5" width="16" height="1.2" fill="hsl(var(--background))" />
    <rect x="22" y="76" width="16" height="1.2" fill="hsl(var(--background))" />

    {/* Pen Nib: Rendered as a cutout with features.
        1. Nib body shape is filled with background, creating a hole in the bulb.
        2. Slit and breather hole are filled with currentColor, appearing as part of the bulb's illumination within that hole.
    */}
    {/* Nib Body (cutout) - Y range approx 38 to 65 */}
    <path d="M30 38 C27.5 39, 26 50, 26 56 L30 64 L34 56 C34 50, 32.5 39, 30 38 Z" fill="hsl(var(--background))" />
    {/* Nib Slit (filled with currentColor) - within the cutout area */}
    <rect x="29.25" y="40" width="1.5" height="15" fill="currentColor" />
    {/* Nib Breather Hole (filled with currentColor) - within the cutout area */}
    <circle cx="30" cy="57.5" r="2" fill="currentColor" />
  </svg>
);

export default KinglyAgentIcon;
