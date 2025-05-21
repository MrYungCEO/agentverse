
import type { Template } from '@/types';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Box, Zap, Bot, Package } from 'lucide-react'; // Added Package
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';

interface TemplateCardProps {
  template: Template;
}

const TemplateCard = ({ template }: TemplateCardProps) => {
  let Icon;
  if (template.isCollection) {
    Icon = Package; // Icon for collections
  } else if (template.type === 'n8n') {
    Icon = Box;
  } else {
    Icon = Zap; // Default for make.com or unknown single templates
  }
  
  const showImage = template.imageVisible ?? true; 

  const imageSource = template.imageUrl && (template.imageUrl.startsWith('data:image') || template.imageUrl.startsWith('http'))
                      ? template.imageUrl
                      : `https://placehold.co/600x300/1A122B/E5B8F4?text=${encodeURIComponent(template.title.substring(0,15))}`;

  return (
    <Link href={`/templates/${template.slug}`} passHref>
      <Card className="h-full flex flex-col group transform transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-xl hover:shadow-primary/30 border-transparent hover:border-primary/50 overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between mb-2">
            <CardTitle className="text-xl font-bold group-hover:text-primary transition-colors duration-300 flex-grow mr-2">{template.title}</CardTitle>
            <div className="flex flex-col items-end flex-shrink-0">
                <Icon className="w-6 h-6 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
                {template.isCollection && <Badge variant="outline" className="mt-1 text-xs">Collection</Badge>}
            </div>
          </div>
          {showImage ? (
            <Image
              src={imageSource}
              alt={template.title}
              width={600}
              height={300}
              className="rounded-md object-cover aspect-video group-hover:opacity-90 transition-opacity duration-300"
              data-ai-hint="automation workflow"
              priority={!template.imageUrl || !template.imageUrl.startsWith('data:image')} 
            />
          ) : (
            <div className="rounded-md object-cover aspect-video bg-muted/30 flex items-center justify-center border border-dashed border-border">
              <Bot className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
        </CardHeader>
        <CardDescription className="px-6 pb-4 text-muted-foreground flex-grow min-h-[60px]">
          {template.summary.length > 100 ? `${template.summary.substring(0, 100)}...` : template.summary}
        </CardDescription>
        <CardFooter className="mt-auto">
          <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all duration-300 glow-button">
            View Details <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>
    </Link>
  );
};

export default TemplateCard;
