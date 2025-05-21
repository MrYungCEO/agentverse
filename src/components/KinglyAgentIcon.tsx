
import type { SVGProps } from 'react';

const KinglyAgentIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 100 150" // Adjusted viewBox for better detail and aspect ratio
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    {...props}
  >
    {/* Crown - Central Spire */}
    <path d="M50 5 L55 15 L50 30 L45 15 Z" />
    {/* Crown - Side Flourishes (Left) */}
    <path d="M45 15 C35 10, 25 15, 20 25 C15 35, 18 45, 25 50 L30 45 C25 40, 28 32, 32 28 Z" />
    {/* Crown - Side Flourishes (Right) */}
    <path d="M55 15 C65 10, 75 15, 80 25 C85 35, 82 45, 75 50 L70 45 C75 40, 72 32, 68 28 Z" />
    
    {/* Bulb Body - connected to crown flourishes */}
    <path d="M25 50 C10 60, 10 80, 25 100 C30 110, 40 125, 50 125 C60 125, 70 110, 75 100 C90 80, 90 60, 75 50 Z" />

    {/* Pen Nib - Central */}
    <path d="M50 70 L45 110 L50 120 L55 110 Z" />
    {/* Pen Nib - Slit (as a thin cutout if bulb is solid, or a line if it's an outline) */}
    <line x1="50" y1="75" x2="50" y2="110" stroke="hsl(var(--background))" strokeWidth="1.5" />
     {/* Pen Nib - Breather hole (as a cutout) */}
    <circle cx="50" cy="100" r="3" fill="hsl(var(--background))" />


    {/* Internal Bezier-like details - simplified */}
    {/* Small squares/circles as control points */}
    <rect x="35" y="80" width="5" height="5" />
    <rect x="60" y="75" width="5" height="5" />
    <circle cx="40" cy="95" r="2.5" />
    <circle cx="58" cy="90" r="2.5" />

    {/* Lines connecting them - very simplified */}
    <line x1="37.5" y1="82.5" x2="45" y2="90" stroke="currentColor" strokeWidth="1" opacity="0.7" />
    <line x1="45" y1="90" x2="55" y2="85" stroke="currentColor" strokeWidth="1" opacity="0.7" />
    <line x1="55" y1="85" x2="62.5" y2="77.5" stroke="currentColor" strokeWidth="1" opacity="0.7" />


    {/* Lightbulb Base */}
    <rect x="40" y="125" width="20" height="15" rx="2" />
    {/* Thread cutouts */}
    <rect x="40" y="128" width="20" height="1.5" fill="hsl(var(--background))" />
    <rect x="40" y="132" width="20" height="1.5" fill="hsl(var(--background))" />
    <rect x="40" y="136" width="20" height="1.5" fill="hsl(var(--background))" />
  </svg>
);

export default KinglyAgentIcon;
