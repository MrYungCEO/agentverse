
import React from 'react';
import * as Icons from 'lucide-react';

interface DynamicLucideIconProps extends Icons.LucideProps {
  name: string;
}

const DynamicLucideIcon: React.FC<DynamicLucideIconProps> = ({ name, className, ...props }) => {
  // Ensure names like "arrow-right" are converted to "ArrowRight"
  const PascalCaseName = name
    .split('-')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  const IconComponent = (Icons as any)[PascalCaseName];

  if (!IconComponent) {
    // Fallback icon or handle error
    console.warn(`Lucide icon "${name}" (transformed to "${PascalCaseName}") not found. Falling back to AlertCircle.`);
    return <Icons.AlertCircle className={className} {...props} />;
  }

  return <IconComponent className={className} {...props} />;
};

export default DynamicLucideIcon;
