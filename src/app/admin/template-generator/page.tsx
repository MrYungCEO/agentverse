
"use client";

import React, { useState } from 'react';
import AdminAuthGuard from '@/components/admin/AdminAuthGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Wand2, Loader2, Copy, Download, Library, AlertTriangle, KeyRound } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTemplates } from '@/contexts/TemplateContext';
import type { TemplateWithoutId } from '@/types';
import { generateN8nWorkflow, type N8nWorkflowGeneratorOutput as N8nJsonOutput } from '@/ai/flows/n8n-workflow-generator';
import { generateTemplateMetadata, type GenerateTemplateMetadataOutput } from '@/ai/flows/template-generation';
import { ScrollArea } from '@/components/ui/scroll-area';

// Combined output type
interface CombinedGeneratorOutput {
  generatedTitle: string;
  generatedSummary: string;
  generatedSetupGuide: string;
  generatedUseCases: string[];
  n8nWorkflowJson: string;
  iconName?: string;
  // Fields like servicesUsed, requiredCredentials, etc., are omitted for now
}


// Simple Markdown Renderer for Setup Guide (can be enhanced)
const MarkdownRenderer = ({ content }: { content: string }) => {
    const elements = content.split('\n').map((line, index) => {
      if (line.match(/^#{1,6}\s/)) {
        const level = line.match(/^#+/)![0].length;
        return React.createElement(`h${level + 2}`, { key: index, className: `font-semibold mt-2 mb-1 text-lg` }, line.replace(/^#+\s/, ''));
      }
      if (line.match(/^[-*]\s/)) {
        return <li key={index} className="ml-4 list-disc">{line.replace(/^[-*]\s/, '')}</li>;
      }
      if (line.match(/^\d+\.\s/)) {
         return <li key={index} className="ml-4 list-decimal">{line.replace(/^\d+\.\s/, '')}</li>;
      }
      return <p key={index} className="my-1">{line || <br />}</p>;
    });
    return <div className="prose prose-sm prose-invert max-w-none">{elements}</div>;
  };


export default function N8nWorkflowGeneratorPage() {
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [userRequest, setUserRequest] = useState('');
  const [generatedOutput, setGeneratedOutput] = useState<CombinedGeneratorOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { addTemplate: addTemplateToLibrary } = useTemplates();

  const handleGenerateWorkflow = async () => {
    if (!geminiApiKey.trim()) {
      toast({ title: "API Key Missing", description: "Please provide your Gemini API key.", variant: "destructive" });
      return;
    }
    if (!userRequest.trim()) {
      toast({ title: "Input Missing", description: "Please provide a description for the workflow.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setError(null);
    setGeneratedOutput(null);
    try {
      // Step 1: Generate n8n Workflow JSON
      const workflowResult: N8nJsonOutput = await generateN8nWorkflow({
        userRequest,
        geminiApiKey: geminiApiKey.trim(),
      });

      if (!workflowResult.n8nWorkflowJson) {
        throw new Error("AI failed to generate the n8n workflow JSON.");
      }

      // Step 2: Generate Metadata using the generated n8n JSON
      const metadataResult: GenerateTemplateMetadataOutput = await generateTemplateMetadata({
        templateData: workflowResult.n8nWorkflowJson,
        additionalContext: userRequest, // Use original request for metadata context
      });
      
      if (!metadataResult.title || !metadataResult.summary) {
         throw new Error("AI failed to generate essential metadata (title/summary) for the workflow.");
      }

      setGeneratedOutput({
        generatedTitle: metadataResult.title,
        generatedSummary: metadataResult.summary,
        generatedSetupGuide: metadataResult.setupGuide,
        generatedUseCases: metadataResult.useCases,
        n8nWorkflowJson: workflowResult.n8nWorkflowJson,
        iconName: metadataResult.iconName,
      });

      toast({ title: "Workflow & Metadata Generated", description: "AI has generated the n8n workflow and associated details." });
    } catch (err) {
      console.error("Workflow generation failed:", err);
      const errorMessage = (err as Error).message || "An unknown error occurred during generation.";
      setError(errorMessage);
      toast({ title: "Generation Failed", description: errorMessage, variant: "destructive", duration: 10000 });
    }
    setIsLoading(false);
  };

  const handleCopyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
      .then(() => toast({ title: `${type} Copied`, description: `${type} has been copied to your clipboard.` }))
      .catch(err => toast({ title: "Copy Failed", description: `Could not copy ${type}.`, variant: "destructive" }));
  };

  const handleDownloadJson = () => {
    if (!generatedOutput?.n8nWorkflowJson) return;
    const blob = new Blob([generatedOutput.n8nWorkflowJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${generatedOutput.generatedTitle.replace(/\s+/g, '_') || 'n8n_workflow'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Download Started", description: "Workflow JSON download has started." });
  };

  const handleAddToLibrary = async () => {
    if (!generatedOutput) {
        toast({ title: "Nothing to Add", description: "Please generate a workflow first.", variant: "destructive"});
        return;
    }
    const templateToAdd: TemplateWithoutId = {
        title: generatedOutput.generatedTitle,
        summary: generatedOutput.generatedSummary,
        templateData: generatedOutput.n8nWorkflowJson,
        isCollection: false,
        setupGuide: generatedOutput.generatedSetupGuide,
        useCases: generatedOutput.generatedUseCases,
        type: 'n8n', 
        imageUrl: undefined,
        imageVisible: true,
        videoUrl: undefined,
        iconName: generatedOutput.iconName || undefined, 
        additionalFiles: [],
    };
    try {
        const newTemplate = await addTemplateToLibrary(templateToAdd);
        toast({ title: "Template Added", description: `"${newTemplate.title}" has been added to your library.`});
    } catch (e) {
        toast({ title: "Failed to Add", description: "Could not add the template to the library.", variant: "destructive"});
        console.error("Failed to add template to library:", e);
    }
  };

  return (
    <AdminAuthGuard>
      <div className="space-y-8 py-8">
        <header>
          <h1 className="text-4xl font-bold glow-text">AI n8n Workflow Generator</h1>
          <p className="text-muted-foreground mt-2">
            Describe the automation you need, provide your Gemini API Key, and the AI will generate an n8n workflow JSON. It will then use this JSON to generate a title, summary, setup guide, and use cases.
          </p>
        </header>

        <Card className="shadow-lg border-border">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center"><Wand2 className="mr-3 h-6 w-6 text-primary"/>Input Parameters</CardTitle>
            <CardDescription>Provide your Gemini API key (required) and describe the workflow you want to generate.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="geminiApiKey" className="font-semibold flex items-center">
                <KeyRound className="mr-2 h-5 w-5 text-primary" /> Gemini API Key (Required)
              </Label>
              <Input
                id="geminiApiKey"
                type="password"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="Enter your Gemini API key"
                className="mt-1"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">Your API key is used for this generation session only and is not stored.</p>
            </div>
            <div>
              <Label htmlFor="userRequest" className="font-semibold">Workflow Description</Label>
              <Textarea
                id="userRequest"
                value={userRequest}
                onChange={(e) => setUserRequest(e.target.value)}
                placeholder="e.g., 'Create an n8n workflow that triggers on a new Typeform submission, enriches the data using OpenAI, then adds a new row to Google Sheets and sends a Slack notification.'"
                rows={8}
                className="mt-1"
                required
              />
            </div>
            <Button onClick={handleGenerateWorkflow} disabled={isLoading || !userRequest.trim() || !geminiApiKey.trim()} className="w-full sm:w-auto glow-button">
              {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Wand2 className="mr-2 h-5 w-5" />}
              {isLoading ? 'Generating Workflow...' : 'Generate Workflow & Details'}
            </Button>
            {error && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive text-destructive rounded-md flex items-start">
                <AlertTriangle className="h-5 w-5 mr-2 shrink-0 mt-0.5" />
                <div>
                    <p className="font-semibold">Generation Error:</p>
                    <p className="text-sm">{error}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {generatedOutput && (
          <Card className="shadow-lg border-border mt-8">
            <CardHeader>
              <CardTitle className="text-2xl flex items-center">Generated Workflow Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="font-semibold text-primary">Title:</Label>
                <p className="text-lg">{generatedOutput.generatedTitle}</p>
              </div>
              <div>
                <Label className="font-semibold text-primary">Summary:</Label>
                <p>{generatedOutput.generatedSummary}</p>
              </div>

              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="setup-guide">
                  <AccordionTrigger className="text-lg font-semibold text-primary hover:no-underline">Setup Guide</AccordionTrigger>
                  <AccordionContent>
                    <ScrollArea className="h-[300px] p-1 border rounded-md bg-background/30">
                        <div className="p-3">
                            <MarkdownRenderer content={generatedOutput.generatedSetupGuide} />
                        </div>
                    </ScrollArea>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="use-cases">
                  <AccordionTrigger className="text-lg font-semibold text-primary hover:no-underline">Use Cases</AccordionTrigger>
                  <AccordionContent>
                    <ul className="list-disc pl-5 space-y-1">
                      {generatedOutput.generatedUseCases.map((uc, i) => <li key={i}>{uc}</li>)}
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="n8n-json">
                  <AccordionTrigger className="text-lg font-semibold text-primary hover:no-underline">n8n Workflow JSON</AccordionTrigger>
                  <AccordionContent>
                    <ScrollArea className="h-[400px] relative">
                      <Textarea
                        value={generatedOutput.n8nWorkflowJson}
                        readOnly
                        rows={15}
                        className="font-mono text-xs bg-muted/30 p-2 h-full"
                      />
                       <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleCopyToClipboard(generatedOutput.n8nWorkflowJson, "Workflow JSON")}
                        className="absolute top-2 right-2 h-7 w-7"
                        aria-label="Copy n8n Workflow JSON"
                        >
                         <Copy className="h-4 w-4" />
                       </Button>
                    </ScrollArea>
                    <Button onClick={handleDownloadJson} variant="outline" className="mt-2">
                      <Download className="mr-2 h-4 w-4"/> Download Workflow JSON
                    </Button>
                  </AccordionContent>
                </AccordionItem>
                {/* Additional Info section can be re-added if those fields are generated later */}
              </Accordion>
            </CardContent>
            <CardFooter>
                <Button onClick={handleAddToLibrary} className="glow-button">
                    <Library className="mr-2 h-5 w-5"/> Add Generated Template to Library
                </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </AdminAuthGuard>
  );
}

