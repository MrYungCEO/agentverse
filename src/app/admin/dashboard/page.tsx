
"use client";

import React, { useState, useRef, type ChangeEvent, type FormEvent } from 'react';
import AdminAuthGuard from '@/components/admin/AdminAuthGuard';
import AddTemplateForm from '@/components/admin/AddTemplateForm';
import { useTemplates } from '@/contexts/TemplateContext';
import type { Template, TemplateWithoutId } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { List, Edit3, PlusCircle, ExternalLink, Trash2, Search, AlertTriangle, UploadCloud, FileJson, Files } from 'lucide-react';
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
import { buttonVariants } from "@/components/ui/button"; 


// Structure expected for each item in the bulk upload JSON file
interface BulkTemplateUploadItem {
  workflowData: string; 
  type?: 'n8n' | 'make.com' | 'unknown';
  additionalContext?: string;
  imageUrl?: string;
  imageVisible?: boolean;
  videoUrl?: string;
}


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
    } else {
      setBulkFiles([]);
    }
  };

  const handleBulkUpload = async () => {
    if (bulkFiles.length === 0) {
      toast({ title: "No Files Selected", description: "Please select one or more JSON files to upload.", variant: "destructive" });
      return;
    }
    setIsBulkUploading(true);
    let totalSuccessCount = 0;
    let totalErrorCount = 0;
    const allFileErrors: { fileName: string; index: number; itemIdentifier?: string; message: string }[] = [];

    for (const file of bulkFiles) {
      try {
        const fileContent = await file.text();
        const parsedJson = JSON.parse(fileContent);

        if (!Array.isArray(parsedJson)) {
          throw new Error(`File "${file.name}" must contain an array of template objects.`);
        }
        
        const templatesToImport: BulkTemplateUploadItem[] = parsedJson.map((item: any, index: number) => {
          if (typeof item.workflowData !== 'string') {
            throw new Error(`Item at index ${index} in file "${file.name}" is missing 'workflowData' or it's not a string.`);
          }
          return {
            workflowData: item.workflowData,
            type: item.type,
            additionalContext: item.additionalContext,
            imageUrl: item.imageUrl,
            imageVisible: item.imageVisible,
            videoUrl: item.videoUrl,
          };
        });

        const result = await bulkAddTemplates(templatesToImport);
        totalSuccessCount += result.successCount;
        totalErrorCount += result.errorCount;
        result.errors.forEach(err => {
          allFileErrors.push({ ...err, fileName: file.name });
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : `Could not parse or process the file "${file.name}".`;
        console.error(`Bulk upload failed for file ${file.name}:`, error);
        toast({
          title: `Error Processing ${file.name}`,
          description: errorMessage,
          variant: "destructive",
          duration: 7000,
        });
        totalErrorCount += 1; // Count this file processing as an error for summary
      }
    }

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
        toast({
          title: `Import Error (File: ${err.fileName}, Item: ${err.itemIdentifier || `Item ${err.index + 1}`})`,
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
            <CardDescription>Upload one or more JSON files. For each item in a file, provide `workflowData` (n8n/Make.com JSON). AI will generate metadata. Optionally include `type`, `additionalContext`, `imageUrl`, etc.</CardDescription>
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
                  <p className="font-semibold">Selected files:</p>
                  <ul className="list-disc list-inside pl-4 max-h-24 overflow-y-auto">
                    {bulkFiles.map(file => (
                      <li key={file.name}>{file.name}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <Button onClick={handleBulkUpload} disabled={bulkFiles.length === 0 || isBulkUploading} className="w-full sm:w-auto glow-button">
              {isBulkUploading ? <Files className="mr-2 h-5 w-5 animate-spin" /> : <UploadCloud className="mr-2 h-5 w-5" />}
              {isBulkUploading ? `Uploading ${bulkFiles.length} file(s) & Generating...` : `Upload & Generate ${bulkFiles.length > 0 ? `(${bulkFiles.length}) ` : ''}Bulk Templates`}
            </Button>
             <p className="text-xs text-muted-foreground">
              Ensure each JSON file contains an array of template objects. Each object must have a `workflowData` field (string containing the n8n/Make.com template JSON). Optional fields: `type` ('n8n', 'make.com'), `additionalContext` (string), `imageUrl` (string), `imageVisible` (boolean), `videoUrl` (string).
              <br/>
              `title`, `summary`, `setupGuide`, `useCases` will be AI-generated from `workflowData`.
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

