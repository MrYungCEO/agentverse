
"use client";

import React, { useState, useRef, type ChangeEvent, type FormEvent } from 'react';
import AdminAuthGuard from '@/components/admin/AdminAuthGuard';
import AddTemplateForm from '@/components/admin/AddTemplateForm';
import { useTemplates, type BulkTemplateUploadItem } from '@/contexts/TemplateContext';
import type { Template, TemplateWithoutId } from '@/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { List, Edit3, PlusCircle, ExternalLink, Trash2, Search, AlertTriangle, UploadCloud, FileJson, Files, Download } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import JSZip from 'jszip';


export default function AdminDashboardPage() {
  const { templates, addTemplate, updateTemplate, deleteTemplate, bulkAddTemplates, loading } = useTemplates();
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [templateToDeleteId, setTemplateToDeleteId] = useState<string | null>(null);
  
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [isBulkUploading, setIsBulkUploading] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);
  const [generatedTemplatesForZip, setGeneratedTemplatesForZip] = useState<Template[]>([]);


  const handleSaveTemplate = (templateData: TemplateWithoutId | Template) => {
    if ('id' in templateData) { 
      updateTemplate(templateData as Template);
      toast({ title: "Template Updated", description: `"${templateData.title}" has been updated.` });
    } else { 
      const newTemplate = addTemplate(templateData as TemplateWithoutId);
      toast({ title: "Template Added", description: `"${newTemplate.title}" has been added to the library.` });
    }
    setEditingTemplate(null);
    setShowAddForm(false);
  };

  const promptDelete = (templateId: string) => {
    setTemplateToDeleteId(templateId);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!templateToDeleteId) return;

    const templateToDelete = templates.find(t => t.id === templateToDeleteId);
    deleteTemplate(templateToDeleteId);
    toast({ title: "Template Deleted", description: `"${templateToDelete?.title}" has been deleted.`, variant: "destructive" });

    if (editingTemplate?.id === templateToDeleteId) {
      setEditingTemplate(null);
      setShowAddForm(false);
    }
    setIsDeleteDialogOpen(false);
    setTemplateToDeleteId(null);
  };


  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setShowAddForm(true);
  };

  const handleAddNew = () => {
    setEditingTemplate(null);
    setShowAddForm(true);
  };
  
  const filteredTemplates = templates.filter(template => 
    template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.summary.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleBulkFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const validFiles: File[] = [];
      const invalidFiles: string[] = [];
      Array.from(files).forEach(file => {
        if (file.type === 'application/json') {
          validFiles.push(file);
        } else {
          invalidFiles.push(file.name);
        }
      });

      if (invalidFiles.length > 0) {
        toast({ 
          title: "Invalid File Type(s)", 
          description: `The following files are not JSON: ${invalidFiles.join(', ')}. Only .json files are accepted.`, 
          variant: "destructive",
          duration: 7000,
        });
      }
      setBulkFiles(validFiles);
      setGeneratedTemplatesForZip([]); // Clear previous zip results if new files are selected
    } else {
      setBulkFiles([]);
      setGeneratedTemplatesForZip([]);
    }
  };

  const handleBulkUpload = async () => {
    if (bulkFiles.length === 0) {
      toast({ title: "No Files Selected", description: "Please select one or more JSON files to upload.", variant: "destructive" });
      return;
    }
    setIsBulkUploading(true);
    setGeneratedTemplatesForZip([]); 
    let totalSuccessCount = 0;
    let totalErrorCount = 0;
    const allFileErrors: { fileName: string; index: number; itemIdentifier?: string; message: string }[] = [];
    const allNewlyCreatedTemplates: Template[] = [];
    let overallBatchContext = "";

    // First pass: gather all additionalContext from all items in all files
    const allAdditionalContexts: string[] = [];
    for (const file of bulkFiles) {
      try {
        const fileContent = await file.text();
        const parsedJsonForContext = JSON.parse(fileContent); // Could throw if file is not JSON
        const itemsForContext = Array.isArray(parsedJsonForContext) ? parsedJsonForContext : [parsedJsonForContext];
        
        itemsForContext.forEach((item: BulkTemplateUploadItem) => {
          if (item.additionalContext && item.additionalContext.trim() !== '') {
            allAdditionalContexts.push(item.additionalContext.trim());
          }
        });
      } catch (e) {
        // This catch is for JSON.parse errors or other file reading issues during context gathering.
        // The main processing loop below will also catch this and report it.
        // We can log it here if needed, but the user will be notified anyway.
        console.warn(`Could not pre-process file for context: ${file.name}`, e);
      }
    }
    if (allAdditionalContexts.length > 0) {
      overallBatchContext = allAdditionalContexts.join("\n\n---\n\n");
    }


    // Second pass: process each file for template generation
    for (const file of bulkFiles) {
      try {
        const fileContent = await file.text();
        const parsedJson = JSON.parse(fileContent); // This can throw if file is not valid JSON
        let itemsToProcess: any[];

        if (Array.isArray(parsedJson)) {
          itemsToProcess = parsedJson;
        } else if (typeof parsedJson === 'object' && parsedJson !== null) {
          itemsToProcess = [parsedJson]; // Treat single object as an array of one
        } else {
          // This case should ideally be caught by JSON.parse if the content isn't object/array
          // But as a fallback:
          throw new Error(`File "${file.name}" content is not a valid JSON object or array.`);
        }

        if (itemsToProcess.length === 0) {
          toast({ title: `File Empty or Invalid`, description: `File "${file.name}" contained no processable template items.`, variant: "default" });
          continue; // Skip to the next file
        }
        
        // Map to BulkTemplateUploadItem structure. No throwing here, let bulkAddTemplates validate.
        const templatesToImport: BulkTemplateUploadItem[] = itemsToProcess.map((item: any) => {
          return {
            workflowData: item.workflowData, // This might be undefined or not a string
            type: item.type || 'unknown',
            additionalContext: item.additionalContext,
            imageUrl: item.imageUrl,
            imageVisible: item.imageVisible,
            videoUrl: item.videoUrl,
          };
        });

        if (templatesToImport.length > 0) {
            const result = await bulkAddTemplates(templatesToImport, overallBatchContext);
            totalSuccessCount += result.successCount;
            totalErrorCount += result.errorCount;
            result.errors.forEach(err => {
              allFileErrors.push({ ...err, fileName: file.name });
            });
            if (result.newlyCreatedTemplates) {
              allNewlyCreatedTemplates.push(...result.newlyCreatedTemplates);
            }
        }

      } catch (error) { // Catches JSON.parse errors or other unexpected errors during file processing
        const errorMessage = error instanceof Error ? error.message : `Could not parse or process the file "${file.name}".`;
        console.error(`Bulk upload failed for file ${file.name}:`, error);
        toast({
          title: `Error Processing ${file.name}`,
          description: errorMessage,
          variant: "destructive",
          duration: 7000,
        });
        totalErrorCount += 1; 
      }
    }
    
    setGeneratedTemplatesForZip(allNewlyCreatedTemplates);

    let summaryMessage = `Bulk import process finished. Successfully imported ${totalSuccessCount} templates using AI generation.`;
    if (totalErrorCount > 0) {
      summaryMessage += ` Failed to import or generate ${totalErrorCount} items/files.`;
    }
    toast({
      title: "Bulk Import Processed",
      description: summaryMessage,
      variant: totalErrorCount > 0 ? "destructive" : "default",
      duration: totalErrorCount > 0 ? 10000 : 7000,
    });

    if (allFileErrors.length > 0) {
      console.error("Detailed bulk import errors:", allFileErrors);
      allFileErrors.forEach(err => {
        const itemContext = err.itemIdentifier || (typeof err.index === 'number' ? `Item ${err.index + 1}` : 'Item');
        toast({
          title: `Import Error (File: ${err.fileName}, ${itemContext})`,
          description: err.message,
          variant: "destructive",
          duration: 10000,
        });
      });
    }

    setBulkFiles([]);
    if (bulkFileInputRef.current) bulkFileInputRef.current.value = "";
    setIsBulkUploading(false);
  };

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

  const downloadGeneratedTemplatesAsZip = async () => {
    if (generatedTemplatesForZip.length === 0) {
      toast({ title: "No templates to download", description: "No templates were successfully generated in the last bulk upload.", variant: "default" });
      return;
    }

    const zip = new JSZip();
    let filesAddedToZip = 0;

    generatedTemplatesForZip.forEach(template => {
      if (template.templateData) {
        zip.file(`${template.slug}.json`, template.templateData);
        filesAddedToZip++;
      }
    });
    
    if (filesAddedToZip === 0) {
        toast({ title: "No template data", description: "None of the generated templates had downloadable workflow data.", variant: "destructive" });
        return;
    }

    try {
      const content = await zip.generateAsync({ type: "blob" });
      downloadBlob(content, "generated_agentverse_templates.zip");
      toast({ title: "Download Started", description: `Zipping ${filesAddedToZip} generated templates.` });
    } catch (error) {
      console.error("Error generating ZIP file:", error);
      toast({ title: "ZIP Generation Failed", description: "Could not create the ZIP file.", variant: "destructive" });
    }
  };


  return (
    <AdminAuthGuard>
      <div className="space-y-8 py-8">
        <header className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-4xl font-bold glow-text">Admin Dashboard</h1>
          <Button onClick={handleAddNew} size="lg" className="glow-button">
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Template
          </Button>
        </header>

        {showAddForm || editingTemplate ? (
          <AddTemplateForm
            key={editingTemplate ? editingTemplate.id : 'new'} 
            onSave={handleSaveTemplate}
            existingTemplate={editingTemplate}
            onDelete={promptDelete}
          />
        ) : null}

        <Card className="shadow-lg border-border">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center"><UploadCloud className="mr-3 h-6 w-6 text-primary"/>Bulk Template Import (AI Powered)</CardTitle>
            <CardDescription>Upload one or more JSON files. Each file can be an array of template items or a single template item. For each item, provide `workflowData` (n8n/Make.com JSON). AI will generate metadata. Optionally include `type`, `additionalContext`, `imageUrl`, etc. AI will use `additionalContext` from all items in all uploaded files as global guidance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="bulkTemplateFile" className="sr-only">Bulk template JSON files</label>
              <Input
                id="bulkTemplateFile"
                type="file"
                accept=".json,application/json"
                onChange={handleBulkFileChange}
                ref={bulkFileInputRef}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                disabled={isBulkUploading}
                multiple 
              />
              {bulkFiles.length > 0 && (
                <div className="text-xs text-muted-foreground mt-2">
                  <p className="font-semibold">Selected files ({bulkFiles.length}):</p>
                  <ul className="list-disc list-inside pl-4 max-h-24 overflow-y-auto">
                    {bulkFiles.map(file => (
                      <li key={file.name}>{file.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={handleBulkUpload} disabled={bulkFiles.length === 0 || isBulkUploading} className="flex-grow sm:flex-grow-0 glow-button">
                {isBulkUploading ? <Files className="mr-2 h-5 w-5 animate-spin" /> : <UploadCloud className="mr-2 h-5 w-5" />}
                {isBulkUploading ? `Uploading ${bulkFiles.length} file(s) & Generating...` : `Upload & Generate ${bulkFiles.length > 0 ? `(${bulkFiles.length}) ` : ''}Bulk Templates`}
              </Button>
              {generatedTemplatesForZip.length > 0 && !isBulkUploading && (
                 <Button onClick={downloadGeneratedTemplatesAsZip} variant="outline" className="flex-grow sm:flex-grow-0">
                   <Download className="mr-2 h-5 w-5" /> Download Generated Templates as ZIP ({generatedTemplatesForZip.length})
                 </Button>
              )}
            </div>
             <p className="text-xs text-muted-foreground">
              Each JSON file can be an array of template objects, or a single template object. Each object must have a `workflowData` field (string: n8n/Make.com JSON). Optional fields: `type` ('n8n', 'make.com'), `additionalContext` (string), `imageUrl` (string), `imageVisible` (boolean), `videoUrl` (string).
              <br/>
              `title`, `summary`, `setupGuide`, `useCases` will be AI-generated from `workflowData` and any `additionalContext`.
              <br/>
              `id`, `slug`, `createdAt`, `updatedAt` will be auto-generated by the system.
            </p>
          </CardContent>
        </Card>

        <Separator />

        <Card className="shadow-lg border-border">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center"><List className="mr-3 h-6 w-6 text-primary"/>Template Library Management</CardTitle>
            <CardDescription>View, edit, or delete existing templates.</CardDescription>
            <div className="mt-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading templates...</p>
            ) : filteredTemplates.length > 0 ? (
              <ul className="space-y-4">
                {filteredTemplates.map(template => (
                  <li key={template.id} className="p-4 bg-card/50 border border-border rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-primary/50 transition-colors">
                    <div>
                      <h3 className="font-semibold text-lg text-foreground">{template.title}</h3>
                      <p className="text-sm text-muted-foreground">{template.type.toUpperCase()} - Updated: {new Date(template.updatedAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 mt-2 sm:mt-0">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/templates/${template.slug}`} target="_blank">
                          <ExternalLink className="mr-1 h-4 w-4" /> View
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleEdit(template)}>
                        <Edit3 className="mr-1 h-4 w-4" /> Edit
                      </Button>
                       <Button variant="destructive" size="sm" onClick={() => promptDelete(template.id)}>
                          <Trash2 className="mr-1 h-4 w-4" /> Delete
                       </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-center py-4">No templates found matching your search, or the library is empty.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertTriangle className="h-6 w-6 mr-2 text-destructive" />
              Are you sure you want to delete this template?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the template
              "{templates.find(t => t.id === templateToDeleteId)?.title || 'this template'}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTemplateToDeleteId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className={buttonVariants({ variant: "destructive" })}
            >
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminAuthGuard>
  );
}

