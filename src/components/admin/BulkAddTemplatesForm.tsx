"use client";

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { FileJson, UploadCloud, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BulkAddTemplatesFormProps {
  // TODO: Define props for handling the saved templates
  onTemplatesSaved?: (templates: any[]) => void; // Placeholder
}

const BulkAddTemplatesForm = ({ onTemplatesSaved }: BulkAddTemplatesFormProps) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [bulkContext, setBulkContext] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<{ name: string; status: 'pending' | 'processing' | 'success' | 'error'; message?: string }[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const jsonFiles = Array.from(files).filter(file => file.type === 'application/json');
      setSelectedFiles(jsonFiles);
      setProcessingStatus(jsonFiles.map(file => ({ name: file.name, status: 'pending' })));
      if (files.length !== jsonFiles.length) {
        toast({
          title: "Warning",
          description: "Only JSON files are supported for bulk upload. Other file types were ignored.",
          variant: "default",
        });
      }
    }
  };

  const handleBulkUpload = async () => {
    if (selectedFiles.length === 0) {
      toast({ title: "No Files Selected", description: "Please select one or more JSON files to upload.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    const results: any[] = []; // Placeholder for processed template data

    for (const file of selectedFiles) {
      setProcessingStatus(prev => prev.map(item => item.name === file.name ? { ...item, status: 'processing' } : item));
      try {
        const fileContent = await readFileContent(file);
        // TODO: Implement AI generation and saving logic here
        // This will involve calling the AI flow with fileContent and bulkContext
        // and then saving the resulting template data.

        // Placeholder for successful processing
        results.push({ name: file.name, status: 'success', message: 'Processed successfully' });
        setProcessingStatus(prev => prev.map(item => item.name === file.name ? { ...item, status: 'success', message: 'Processed successfully' } : item));

      } catch (error: any) {
        console.error(`Error processing file ${file.name}:`, error);
        setProcessingStatus(prev => prev.map(item => item.name === file.name ? { ...item, status: 'error', message: error.message || 'Processing failed' } : item));
      }
    }

    setIsProcessing(false);
    toast({ title: "Bulk Upload Complete", description: `${results.filter(r => r.status === 'success').length} file(s) processed successfully.` });

    if (onTemplatesSaved) {
      // onTemplatesSaved(results); // Pass actual processed data
    }

    // Reset form
    setSelectedFiles([]);
    setBulkContext('');
    setProcessingStatus([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  };

  return (
    <Card className="w-full shadow-xl border-border">
      <CardHeader>
        <CardTitle className="text-2xl font-bold glow-text">
          Bulk Add Templates
        </CardTitle>
        <CardDescription>
          Upload multiple template JSON files and provide context for AI metadata generation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="bulkJsonFiles" className="font-semibold text-accent flex items-center">
              <FileJson className="mr-2 h-5 w-5"/> Upload Template JSON Files (n8n or Make.com)
            </Label>
            <Input
              id="bulkJsonFiles"
              name="bulkJsonFiles"
              type="file"
              accept=".json,application/json"
              onChange={handleFileChange}
              ref={fileInputRef}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              multiple
            />
            {selectedFiles.length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                <p className="font-semibold">Selected files ({selectedFiles.length}):</p>
                <ScrollArea className="h-20 border rounded-md p-2 bg-muted/10">
                  <ul className="list-disc list-inside pl-2">
                    {selectedFiles.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="truncate">{file.name}</li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="bulkContext" className="font-semibold text-accent">Additional Context for AI (Applies to all uploaded files)</Label>
            <Textarea
              id="bulkContext"
              name="bulkContext"
              value={bulkContext}
              onChange={(e) => setBulkContext(e.target.value)}
              placeholder="e.g., These templates are for marketing automation, focus on lead generation benefits."
              rows={3}
            />
          </div>

          <Button
            type="button"
            onClick={handleBulkUpload}
            disabled={selectedFiles.length === 0 || isProcessing}
            className="w-full sm:w-auto glow-button"
          >
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
            {isProcessing ? 'Processing...' : `Upload & Generate (${selectedFiles.length})`}
          </Button>

          {processingStatus.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="font-semibold">Processing Status:</p>
              <ScrollArea className="h-40 border rounded-md p-2 bg-muted/10">
                <ul className="space-y-1">
                  {processingStatus.map((item, index) => (
                    <li key={`${item.name}-${index}`} className="flex items-center text-sm">
                      {item.status === 'pending' && <span className="mr-2 h-4 w-4 text-muted-foreground">•</span>}
                      {item.status === 'processing' && <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" />}
                      {item.status === 'success' && <CheckCircle className="mr-2 h-4 w-4 text-green-500" />}
                      {item.status === 'error' && <XCircle className="mr-2 h-4 w-4 text-red-500" />}
                      <span className="truncate">{item.name}</span>
                      {item.message && <span className="ml-2 text-xs text-muted-foreground">({item.message})</span>}
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default BulkAddTemplatesForm;
