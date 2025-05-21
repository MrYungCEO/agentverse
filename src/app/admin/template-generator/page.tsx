
"use client";

import React, { useState } from 'react';
import AdminAuthGuard from '@/components/admin/AdminAuthGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Wand2, Loader2, Copy, Download, Library, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTemplates } from '@/contexts/TemplateContext';
import type { TemplateWithoutId } from '@/types';
import { generateN8nWorkflow, type N8nWorkflowGeneratorOutput } from '@/ai/flows/n8n-workflow-generator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

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
  const [generatedOutput, setGeneratedOutput] = useState<N8nWorkflowGeneratorOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { addTemplate: addTemplateToLibrary } = useTemplates();

  const handleGenerateWorkflow = async () => {
    if (!userRequest.trim()) {
      toast({ title: "Input Missing", description: "Please provide a description for the workflow.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    setError(null);
    setGeneratedOutput(null);
    try {
      const output = await generateN8nWorkflow({
        userRequest,
        geminiApiKey: geminiApiKey.trim() || undefined,
      });
      setGeneratedOutput(output);
      toast({ title: "Workflow Generated", description: "AI has generated the n8n workflow and details." });
    } catch (err) {
      console.error("Workflow generation failed:", err);
      setError((err as Error).message || "An unknown error occurred during generation.");
      toast({ title: "Generation Failed", description: (err as Error).message, variant: "destructive", duration: 7000 });
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

  const handleAddToLibrary = () => {
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
        type: 'n8n', // This generator specifically creates n8n templates
        // Default other optional fields
        imageUrl: undefined,
        imageVisible: true,
        videoUrl: undefined,
        iconName: undefined, // AI currently doesn't suggest icon for this flow
    };
    try {
        const newTemplate = addTemplateToLibrary(templateToAdd);
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
            Describe the automation you need, and the AI will generate an n8n workflow JSON, along with a title, summary, setup guide, and use cases.
          </p>
        </header>

        <Card className="shadow-lg border-border">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center"><Wand2 className="mr-3 h-6 w-6 text-primary"/>Input Parameters</CardTitle>
            <CardDescription>Provide your Gemini API key (optional) and describe the workflow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="geminiApiKey" className="font-semibold">Gemini API Key (Optional)</Label>
              <Input
                id="geminiApiKey"
                type="password"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="Enter your Gemini API key if you want to use your own"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">If left blank, the application's default configured key will be used.</p>
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
            <Button onClick={handleGenerateWorkflow} disabled={isLoading || !userRequest.trim()} className="w-full sm:w-auto glow-button">
              {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Wand2 className="mr-2 h-5 w-5" />}
              {isLoading ? 'Generating Workflow...' : 'Generate Workflow'}
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

                {(generatedOutput.servicesUsed && generatedOutput.servicesUsed.length > 0) ||
                 (generatedOutput.requiredCredentials && generatedOutput.requiredCredentials.length > 0) ||
                 (generatedOutput.environmentVariables && generatedOutput.environmentVariables.length > 0) ||
                 (generatedOutput.assumptionsMade && generatedOutput.assumptionsMade.length > 0) ? (
                <AccordionItem value="additional-info">
                  <AccordionTrigger className="text-lg font-semibold text-primary hover:no-underline">Additional Information</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    {generatedOutput.servicesUsed && generatedOutput.servicesUsed.length > 0 && (
                      <div>
                        <p className="font-medium">Services Used:</p>
                        <ul className="list-disc pl-5 text-sm text-muted-foreground">
                          {generatedOutput.servicesUsed.map((s, i) => <li key={`service-${i}`}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                    {generatedOutput.requiredCredentials && generatedOutput.requiredCredentials.length > 0 && (
                      <div>
                        <p className="font-medium">Required Credentials:</p>
                        <ul className="list-disc pl-5 text-sm text-muted-foreground">
                          {generatedOutput.requiredCredentials.map((c, i) => <li key={`cred-${i}`}>{c}</li>)}
                        </ul>
                      </div>
                    )}
                     {generatedOutput.environmentVariables && generatedOutput.environmentVariables.length > 0 && (
                      <div>
                        <p className="font-medium">Environment Variables:</p>
                        <ul className="list-disc pl-5 text-sm text-muted-foreground">
                          {generatedOutput.environmentVariables.map((env, i) => <li key={`env-${i}`}>{env}</li>)}
                        </ul>
                      </div>
                    )}
                    {generatedOutput.assumptionsMade && generatedOutput.assumptionsMade.length > 0 && (
                       <div>
                        <p className="font-medium">Assumptions Made:</p>
                        <ul className="list-disc pl-5 text-sm text-muted-foreground">
                          {generatedOutput.assumptionsMade.map((a, i) => <li key={`asm-${i}`}>{a}</li>)}
                        </ul>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
                 ) : null}
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
