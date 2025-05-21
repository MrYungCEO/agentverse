
import type { SVGProps } from 'react';

const KinglyAgentIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 60 80" // Adjusted viewBox for a reasonable aspect ratio
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    {...props}
  >
    {/* Lightbulb shape */}
    <path d="M30 72C18 72 10 60 10 45C10 30 20 15 30 15C40 15 50 30 50 45C50 60 42 72 30 72Z" />
    {/* Lightbulb base */}
    <rect x="22" y="70" width="16" height="10" rx="3" />
    {/* Pen Nib inside bulb */}
    <path d="M30 30L26 45L30 60L34 45L30 30Z M30 33L30 57" stroke="hsl(var(--background))" strokeWidth="2" />
    {/* Crown on top */}
    <path d="M15 20L30 5L45 20L40 22L30 12L20 22L15 20Z" />
    {/* Simplified side flourishes */}
    <path d="M8 45C12 38 16 32 20 30L20 37C16 39 12 42 8 45Z" />
    <path d="M52 45C48 38 44 32 40 30L40 37C44 39 48 42 52 45Z" />
  </svg>
);

export default KinglyAgentIcon;
