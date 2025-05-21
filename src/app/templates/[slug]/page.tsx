"use client";

import React, { useEffect, useState } from 'react';
import { useTemplates } from '@/contexts/TemplateContext';
import type { Template } from '@/types';
import { Button } from '@/components/ui/button';
import { Download, CheckCircle, ListChecks, AlertTriangle, ArrowLeft, Zap, Box } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import ChatWidget from '@/components/chat/ChatWidget';
import { useToast } from '@/hooks/use-toast';


// Basic markdown to HTML renderer
const MarkdownRenderer = ({ content }: { content: string }) => {
  return (
    <div className="prose prose-invert max-w-none text-foreground">
      {content.split('\\n').map((line, index) => {
        if (line.match(/^#{1,6}\s/)) { // Basic heading support
          const level = line.match(/^#+/)![0].length;
          const text = line.replace(/^#+\s/, '');
          return React.createElement(`h${level}`, { key: index, className: 'font-bold mt-4 mb-2' }, text);
        }
        if (line.match(/^-\s/) || line.match(/^\*\s/) || line.match(/^\d+\.\s/)) { // Basic list support
          return <li key={index} className="ml-4 my-1 list-disc">{line.replace(/^[-*]\s|^\d+\.\s/, '')}</li>;
        }
        return <p key={index} className="my-2">{line}</p>;
      })}
    </div>
  );
};


export default function TemplateDetailPage({ params }: { params: { slug: string } }) {
  const { getTemplateBySlug, loading } = useTemplates();
  const [template, setTemplate] = useState<Template | null | undefined>(undefined); // undefined for loading, null for not found
  const { toast } = useToast();

  useEffect(() => {
    if (!loading) {
      const fetchedTemplate = getTemplateBySlug(params.slug);
      setTemplate(fetchedTemplate);
    }
  }, [params.slug, getTemplateBySlug, loading]);

  const handleDownload = () => {
    if (!template || !template.templateData) {
      toast({
        title: "Download Error",
        description: "No template data available to download.",
        variant: "destructive",
      });
      return;
    }

    try {
      const blob = new Blob([template.templateData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template.slug || 'template'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Download Started",
        description: `Downloading ${template.title}.json`,
      });
    } catch (error) {
      console.error("Download failed:", error);
      toast({
        title: "Download Failed",
        description: "Could not initiate template download.",
        variant: "destructive",
      });
    }
  };


  if (loading || template === undefined) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6 animate-pulse">
          <div className="h-8 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/4"></div>
          <div className="h-200 bg-muted rounded"></div> {/* Placeholder for image */}
          <div className="space-y-3">
            <div className="h-6 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-5/6"></div>
          </div>
           <div className="space-y-3">
            <div className="h-6 bg-muted rounded w-1/3"></div>
            <div className="h-4 bg-muted rounded w-full"></div>
            <div className="h-4 bg-muted rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
         <AlertTriangle className="mx-auto h-16 w-16 text-destructive mb-4" />
        <h1 className="text-3xl font-bold mb-4 text-foreground">Template Not Found</h1>
        <p className="text-muted-foreground mb-6">The template you are looking for does not exist or may have been moved.</p>
        <Button asChild variant="outline">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Library
          </Link>
        </Button>
      </div>
    );
  }
  
  const TypeIcon = template.type === 'n8n' ? Box : Zap;

  return (
    <div className="container mx-auto px-2 sm:px-4 py-8 max-w-4xl">
      <Button variant="outline" asChild className="mb-8">
        <Link href="/">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Library
        </Link>
      </Button>

      <article className="bg-card p-6 sm:p-8 rounded-xl shadow-2xl shadow-primary/10 border border-border">
        <header className="mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-2 sm:mb-0 glow-text">{template.title}</h1>
            <Badge variant="secondary" className="text-sm px-3 py-1.5 flex items-center">
              <TypeIcon className="w-4 h-4 mr-2" />
              {template.type.toUpperCase()}
            </Badge>
          </div>
          <Image
            src={`https://placehold.co/1200x600/1A122B/E5B8F4?text=${encodeURIComponent(template.title)}`}
            alt={template.title}
            width={1200}
            height={600}
            className="rounded-lg object-cover aspect-video mb-6 shadow-lg"
            data-ai-hint="technology abstract"
            priority
          />
          <p className="text-lg text-muted-foreground">{template.summary}</p>
        </header>
        
        <Separator className="my-8 bg-border/50" />

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-foreground flex items-center"><ListChecks className="mr-3 h-6 w-6 text-primary"/>Setup Guide</h2>
          <div className="bg-background/50 p-4 sm:p-6 rounded-lg border border-border/50">
            <MarkdownRenderer content={template.setupGuide} />
          </div>
        </section>

        <Separator className="my-8 bg-border/50" />

        <section className="mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-foreground flex items-center"><CheckCircle className="mr-3 h-6 w-6 text-primary"/>Use Cases</h2>
          <ul className="space-y-2">
            {template.useCases.map((useCase, index) => (
              <li key={index} className="flex items-start p-3 bg-background/50 rounded-md border border-border/50">
                <Zap className="h-5 w-5 text-accent mr-3 mt-1 shrink-0" />
                <span className="text-foreground/90">{useCase}</span>
              </li>
            ))}
          </ul>
        </section>
        
        <Separator className="my-8 bg-border/50" />

        <div className="text-center">
          <Button 
            size="lg" 
            className="glow-button bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8 py-6"
            onClick={handleDownload}
            disabled={!template.templateData}
          >
            <Download className="mr-2 h-5 w-5" />
            Download Template JSON
          </Button>
           {!template.templateData && (
            <p className="text-sm text-muted-foreground mt-2">Template JSON data not available for download for this template.</p>
          )}
        </div>
      </article>
      <ChatWidget />
    </div>
  );
}
