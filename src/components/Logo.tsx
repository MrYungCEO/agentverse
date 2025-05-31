import type { SVGProps } from 'react';

const Logo = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 260 50" xmlns="http://www.w3.org/2000/svg" {...props}>
    <text
      x="0"
      y="35"
      fontFamily="var(--font-geist-mono), monospace"
      fontSize="30"
      fontWeight="bold"
      className="fill-primary transition-all duration-300 ease-in-out group-hover:fill-accent"
    >
      Agent
      <tspan 
        className="fill-accent transition-all duration-300 ease-in-out group-hover:fill-primary"
        dx="5"
      >
        Verse
      </tspan>
    </text>
     <text
      x="100" /* Adjust x based on AgentVerse text length if needed */
      y="48" /* Position below AgentVerse */
      fontFamily="var(--font-geist-sans), sans-serif"
      fontSize="10"
      fontWeight="normal"
      className="fill-muted-foreground transition-all duration-300 ease-in-out group-hover:fill-foreground"
    >
      by Kingly Kreationz
    </text>
  </svg>
);

export default Logo;
