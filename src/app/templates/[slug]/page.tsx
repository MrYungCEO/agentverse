
"use client";

import React, { useEffect, useState } from 'react';
import { useTemplates } from '@/contexts/TemplateContext';
import type { Template, WorkflowFile } from '@/types';
import { Button } from '@/components/ui/button';
import { Download, CheckCircle, ListChecks, AlertTriangle, ArrowLeft, Zap, Box, Bot, Video, Package, Combine, FileJson, Image as ImageIcon, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { Separator } from '@/components/ui/separator';
import ChatWidget from '@/components/chat/ChatWidget';
import { useToast } from '@/hooks/use-toast';
import JSZip from 'jszip';
import DynamicLucideIcon from '@/components/DynamicLucideIcon';
import KinglyAgentIcon from '@/components/KinglyAgentIcon'; // Import the new icon


// Enhanced markdown to HTML renderer, relying on prose for styling
const MarkdownRenderer = ({ content }: { content: string }) => {
  const elements: JSX.Element[] = [];
  let currentListType: 'ul' | 'ol' | null = null;
  let listItems: JSX.Element[] = [];

  const applyInlineFormatting = (text: string): (string | JSX.Element)[] => {
    const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g);
    return parts.map((part, index) => {
      if (!part) return null; 
      if (part.match(/^(\*\*|__)(.*)(\*\*|__)$/)) { 
        return <strong key={index}>{part.substring(2, part.length - 2)}</strong>;
      }
      if (part.match(/^(\*|_)(.*)(\*|_)$/)) { 
        return <em key={index}>{part.substring(1, part.length - 1)}</em>;
      }
      return part; 
    }).filter(Boolean) as (string | JSX.Element)[]; 
  };

  const flushList = () => {
    if (listItems.length > 0) {
      if (currentListType === 'ol') {
        elements.push(<ol key={`list-${elements.length}`} className="list-decimal list-inside my-2 pl-4">{listItems}</ol>);
      } else { 
        elements.push(<ul key={`list-${elements.length}`} className="list-disc list-inside my-2 pl-4">{listItems}</ul>);
      }
      listItems = [];
      currentListType = null;
    }
  };

  const lines = content.split('\n'); 

  lines.forEach((line, index) => {
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const textContent = headingMatch[2];
      elements.push(React.createElement(`h${level}`, { key: `h-${index}`, className: `my-3 font-semibold text-foreground ${level === 1 ? 'text-2xl' : level === 2 ? 'text-xl' : 'text-lg'}` }, applyInlineFormatting(textContent)));
      return;
    }

    const ulListItemMatch = line.match(/^[-*]\s+(.*)/);
    if (ulListItemMatch) {
      if (currentListType !== 'ul') {
        flushList(); 
        currentListType = 'ul';
      }
      listItems.push(<li key={`li-${index}`}>{applyInlineFormatting(ulListItemMatch[1])}</li>);
      return;
    }

    const olListItemMatch = line.match(/^\d+\.\s+(.*)/);
    if (olListItemMatch) {
      if (currentListType !== 'ol') {
        flushList();
        currentListType = 'ol';
      }
      listItems.push(<li key={`li-${index}`}>{applyInlineFormatting(olListItemMatch[1])}</li>);
      return;
    }

    flushList();
    if (line.trim()) {
      elements.push(<p key={`p-${index}`} className="my-2 leading-relaxed">{applyInlineFormatting(line)}</p>);
    }
  });

  flushList(); 

  return (
    <div className="prose prose-invert max-w-none text-foreground">
      {elements}
    </div>
  );
};


export default function TemplateDetailPage({ params }: { params: { slug: string } }) {
  const { getTemplateBySlug, loading } = useTemplates();
  const [template, setTemplate] = useState<Template | null | undefined>(undefined);
  const { toast } = useToast();
  
  const [parsedWorkflowFiles, setParsedWorkflowFiles] = useState<WorkflowFile[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading) {
      const fetchedTemplate = getTemplateBySlug(params.slug);
      setTemplate(fetchedTemplate);

      if (fetchedTemplate?.isCollection && fetchedTemplate.templateData) {
        try {
          const files = JSON.parse(fetchedTemplate.templateData) as WorkflowFile[];
          if (Array.isArray(files) && files.every(f => f && typeof f.filename === 'string' && typeof f.content === 'string')) {
            setParsedWorkflowFiles(files);
            setParseError(null);
          } else {
            setParsedWorkflowFiles(null);
            setParseError("Collection data is malformed or contains invalid file entries.");
            console.error("Malformed collection data for template:", fetchedTemplate.slug, fetchedTemplate.templateData);
          }
        } catch (e) {
          setParsedWorkflowFiles(null);
          setParseError("Failed to parse collection data. It may not be valid JSON.");
          console.error("Failed to parse collection data for template:", fetchedTemplate.slug, e);
        }
      } else {
        setParsedWorkflowFiles(null);
        setParseError(null);
      }
    }
  }, [params.slug, getTemplateBySlug, loading]);

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownload = async () => {
    if (!template) {
      toast({ title: "Download Error", description: "Template not loaded.", variant: "destructive" });
      return;
    }

    if (template.isCollection) {
      if (parseError || !parsedWorkflowFiles || parsedWorkflowFiles.length === 0) {
        toast({ title: "Download Error", description: parseError || "Collection is empty or data is malformed.", variant: "destructive"});
        return;
      }
      try {
        const zip = new JSZip();
        let filesAddedToZipCount = 0;
        
        parsedWorkflowFiles.forEach(wf => {
            if (wf && typeof wf.filename === 'string' && typeof wf.content === 'string') {
                const safeFilename = wf.filename.replace(/[^a-z0-9_.-]/gi, '_');
                zip.file(safeFilename, wf.content);
                filesAddedToZipCount++;
            } else {
                console.warn("Skipping malformed workflow file entry during zipping:", wf);
            }
        });

        if (filesAddedToZipCount === 0) {
             toast({ title: "Download Error", description: "No valid files found in the collection to zip.", variant: "destructive"});
             return;
        }

        const zipBlob = await zip.generateAsync({ type: "blob" });
        downloadBlob(zipBlob, `${template.slug || 'collection'}.zip`);
        toast({ title: "Download Started", description: `Downloading ${filesAddedToZipCount} file(s) from ${template.title}.zip` });

      } catch (error) { 
        console.error("Download failed for collection (ZIP generation error):", error);
        toast({
          title: "ZIP Creation Failed",
          description: "Could not create the ZIP file for the collection. Please check console for details.",
          variant: "destructive",
        });
      }
    } else { 
      if (!template.templateData) {
        toast({
          title: "Download Error",
          description: "No template data available to download for this single template.",
          variant: "destructive",
        });
        return;
      }
      try {
        const blob = new Blob([template.templateData], { type: 'application/json' });
        downloadBlob(blob, `${template.slug || 'template'}.json`);
        toast({ title: "Download Started", description: `Downloading ${template.title}.json` });
      } catch (error) {
        console.error("Single template download failed:", error);
        toast({
          title: "Download Failed",
          description: "Could not initiate single template download.",
          variant: "destructive",
        });
      }
    }
  };

  const getYouTubeEmbedUrl = (url: string | undefined): string | null => {
    if (!url) return null;
    try {
      const videoUrl = new URL(url);
      let videoId = videoUrl.searchParams.get('v');
      if (videoUrl.hostname === 'youtu.be') {
        videoId = videoUrl.pathname.substring(1);
      }
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    } catch (e) {
      return null;
    }
    return null; 
  };

  const embedVideoUrl = template ? getYouTubeEmbedUrl(template.videoUrl) : null;


  if (loading || template === undefined) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6 animate-pulse">
          <div className="h-8 bg-muted rounded w-3/4"></div>
          <div className="h-4 bg-muted rounded w-1/4"></div>
          <div className="h-[300px] bg-muted rounded"></div> 
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
  
  let TypeIcon; // For the badge next to title
  if (template.isCollection) {
    TypeIcon = Package;
  } else if (template.type === 'n8n') {
    TypeIcon = Box;
  } else {
    TypeIcon = Zap;
  }

  const showImage = template.imageVisible ?? true; 
  const imageSource = template.imageUrl && template.imageUrl.startsWith('data:image') 
                      ? template.imageUrl 
                      : template.imageUrl || `https://placehold.co/1200x600/1A122B/E5B8F4?text=${encodeURIComponent(template.title)}`;
  
  let MainVisual: JSX.Element;
  if (showImage && template.imageUrl) {
    MainVisual = (
      <Image
        src={imageSource}
        alt={template.title}
        width={1200}
        height={600}
        className="rounded-lg object-cover aspect-video mb-6 shadow-lg"
        data-ai-hint="technology abstract workflow"
        priority={!template.imageUrl || !template.imageUrl.startsWith('data:image')} 
      />
    );
  } else if (template.iconName) {
    MainVisual = (
      <div className="aspect-video mb-6 bg-muted/30 rounded-lg flex items-center justify-center border border-dashed border-border shadow-lg">
        <DynamicLucideIcon name={template.iconName} className="h-24 w-24 text-primary" />
      </div>
    );
  } else { // Fallback visual
     MainVisual = (
      <div className="aspect-video mb-6 bg-muted/30 rounded-lg flex items-center justify-center border border-dashed border-border">
          <TypeIcon className="h-24 w-24 text-muted-foreground" /> {/* Use TypeIcon if no specific icon or image */}
      </div>
    );
  }


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
            <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-2 sm:mb-0 glow-text flex items-center">
              <KinglyAgentIcon className="h-10 w-10 mr-3 text-primary hidden sm:inline-block" /> {/* Added Icon */}
              <KinglyAgentIcon className="h-8 w-8 mr-2 text-primary sm:hidden" /> {/* Smaller for mobile */}
              {template.title}
            </h1>
            <Badge variant="secondary" className="text-sm px-3 py-1.5 flex items-center self-start sm:self-center mt-2 sm:mt-0">
              <TypeIcon className="w-4 h-4 mr-2" />
              {template.type.toUpperCase()}
            </Badge>
          </div>
          {MainVisual}
          <p className="text-lg text-muted-foreground">{template.summary}</p>
        </header>
        
        <Separator className="my-8 bg-border/50" />

        {embedVideoUrl && (
          <>
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-foreground flex items-center"><Video className="mr-3 h-6 w-6 text-primary"/>Video Guide</h2>
              <div className="aspect-video bg-black rounded-lg overflow-hidden shadow-lg">
                <iframe
                  width="100%"
                  height="100%"
                  src={embedVideoUrl}
                  title="Template Video Guide"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                ></iframe>
              </div>
            </section>
            <Separator className="my-8 bg-border/50" />
          </>
        )}


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
        
        {template.isCollection && (
          <>
            <Separator className="my-8 bg-border/50" />
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-foreground flex items-center">
                <Combine className="mr-3 h-6 w-6 text-primary"/>Workflow Files in Collection
              </h2>
              {parseError && (
                <p className="text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/50">
                  <AlertTriangle className="inline h-5 w-5 mr-2" /> Error loading collection files: {parseError}
                </p>
              )}
              {!parseError && parsedWorkflowFiles && parsedWorkflowFiles.length > 0 && (
                <ul className="space-y-2">
                  {parsedWorkflowFiles.map((file, index) => (
                    <li key={index} className="flex items-center p-3 bg-background/50 rounded-md border border-border/50">
                      <FileJson className="h-5 w-5 text-accent mr-3 shrink-0" />
                      <span className="text-foreground/90">{file.filename}</span>
                    </li>
                  ))}
                </ul>
              )}
              {!parseError && (!parsedWorkflowFiles || parsedWorkflowFiles.length === 0) && (
                 <p className="text-muted-foreground">This collection appears to be empty or its file data could not be loaded.</p>
              )}
            </section>
          </>
        )}
        
        <Separator className="my-8 bg-border/50" />

        <div className="text-center">
          <Button 
            size="lg" 
            className="glow-button bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8 py-6"
            onClick={handleDownload}
            disabled={
              (template.isCollection && (!parsedWorkflowFiles || parsedWorkflowFiles.length === 0)) || 
              (!template.isCollection && !template.templateData)
            }
          >
            <Download className="mr-2 h-5 w-5" />
            {template.isCollection ? "Download Collection as ZIP" : "Download Template JSON"}
          </Button>
           {((template.isCollection && (!parsedWorkflowFiles || parsedWorkflowFiles.length === 0) && !parseError) || (!template.isCollection && !template.templateData)) && (
            <p className="text-sm text-muted-foreground mt-2">
                {template.isCollection ? "No files available in this collection for download." : "Template data not available for download for this template."}
            </p>
           )}
           {template.isCollection && parseError && (
             <p className="text-sm text-destructive mt-2">Download unavailable due to collection data error.</p>
           )}
        </div>
      </article>
      <ChatWidget />
    </div>
  );
}

