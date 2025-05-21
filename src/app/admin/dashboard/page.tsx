
"use client";

import React, { useState, useRef, type ChangeEvent, type FormEvent } from 'react';
import AdminAuthGuard from '@/components/admin/AdminAuthGuard';
import AddTemplateForm from '@/components/admin/AddTemplateForm';
import { useTemplates, type BulkTemplateUploadItem } from '@/contexts/TemplateContext';
import type { Template, TemplateWithoutId, WorkflowFile } from '@/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { List, Edit3, PlusCircle, ExternalLink, Trash2, Search, AlertTriangle, UploadCloud, FileJson, Files, Download, Package, Combine } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import JSZip from 'jszip';
import { Badge } from '@/components/ui/badge';


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
  const [bulkImportMode, setBulkImportMode] = useState<'bulk' | 'merge'>('bulk');


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
    (template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.summary.toLowerCase().includes(searchTerm.toLowerCase()))
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
      setGeneratedTemplatesForZip([]); 
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
    const allNewlyCreatedTemplatesForZip: Template[] = [];
    let overallBatchContext = "";

    const allWorkflowFiles: WorkflowFile[] = [];
    const allItemsForBulkMode: BulkTemplateUploadItem[] = [];

    // First pass: Read all files, gather all additionalContext, and structure data for chosen mode
    for (const file of bulkFiles) {
      try {
        const fileContent = await file.text();
        const parsedJson = JSON.parse(fileContent);
        
        let itemsFromFile: any[] = [];
        if (Array.isArray(parsedJson)) {
            itemsFromFile = parsedJson;
        } else if (typeof parsedJson === 'object' && parsedJson !== null) {
            // For single object file or raw workflow file, check for common workflow structure
            if ((parsedJson.nodes && parsedJson.connections) || (parsedJson.flow && parsedJson.name)) { // n8n or Make.com raw
                itemsFromFile = [{ workflowData: parsedJson, type: (parsedJson.nodes && parsedJson.connections) ? 'n8n' : 'make.com' }];
            } else if (parsedJson.workflowData) { // Object with workflowData key
                itemsFromFile = [parsedJson];
            } else {
                toast({ title: `File Content Invalid`, description: `File "${file.name}" content is not a recognized workflow object or array of workflows.`, variant: "destructive" });
                totalErrorCount++;
                allFileErrors.push({ fileName: file.name, index: -1, message: "File content is not a valid JSON object or array."});
                continue;
            }
        } else {
          toast({ title: `File Content Invalid`, description: `File "${file.name}" content is not a valid JSON object or array.`, variant: "destructive" });
          totalErrorCount++;
          allFileErrors.push({ fileName: file.name, index: -1, message: "File content is not a valid JSON object or array."});
          continue; 
        }
        
        itemsFromFile.forEach((item: any, index: number) => {
          const originalFilename = file.name;
          let workflowDataContent: string | undefined;
          let itemType: 'n8n' | 'make.com' | 'unknown' = item.type || 'unknown'; // Get type from item first
          let itemAdditionalContext: string | undefined = item.additionalContext;
          let itemImageUrl: string | undefined = item.imageUrl;
          let itemImageVisible: boolean | undefined = item.imageVisible;
          let itemVideoUrl: string | undefined = item.videoUrl;

          if (typeof item.workflowData === 'object' && item.workflowData !== null) {
            workflowDataContent = JSON.stringify(item.workflowData);
             if (!item.type && item.workflowData.nodes && item.workflowData.connections) itemType = 'n8n';
             else if (!item.type && item.workflowData.flow && item.workflowData.name) itemType = 'make.com';

          } else if (typeof item.workflowData === 'string') { // workflowData is already a string
            workflowDataContent = item.workflowData;
            // Type inference from string content is hard, rely on provided type or default
          } else if (typeof item === 'object' && item !== null && !item.workflowData) {
            // This is the case for a raw workflow file (single object)
            workflowDataContent = JSON.stringify(item); // Use the parsed item as workflow data
             if (item.nodes && item.connections) itemType = 'n8n';
             else if (item.flow && item.name) itemType = 'make.com';
          }
          
          if (workflowDataContent) {
            if (itemAdditionalContext && itemAdditionalContext.trim() !== '') {
                 overallBatchContext += (overallBatchContext ? "\n\n---\n\n" : "") + `Context from ${originalFilename}${Array.isArray(parsedJson) ? ` (item ${index + 1})` : ''}:\n${itemAdditionalContext.trim()}`;
            }
            allWorkflowFiles.push({ filename: originalFilename, content: workflowDataContent }); // For merge mode and ZIP download
            allItemsForBulkMode.push({
                workflowData: workflowDataContent,
                type: itemType,
                additionalContext: itemAdditionalContext, 
                imageUrl: itemImageUrl,
                imageVisible: itemImageVisible,
                videoUrl: itemVideoUrl,
                originalFilename: originalFilename,
            });
          } else {
            totalErrorCount++;
            allFileErrors.push({ fileName: originalFilename, index: index, message: "Item does not have valid workflowData or is not a direct workflow object."});
          }
        });
      } catch (e) {
        console.error(`Error processing file ${file.name} for pre-scan or structuring:`, e);
        totalErrorCount++;
        allFileErrors.push({ fileName: file.name, index: -1, message: `Could not parse or structure file: ${(e as Error).message}`});
      }
    }

    // Second pass: Call bulkAddTemplates based on mode
    if (bulkImportMode === 'merge') {
      if (allWorkflowFiles.length > 0) {
        // For merge mode, itemsToImport for bulkAddTemplates will be the array of WorkflowFile
        const result = await bulkAddTemplates(allWorkflowFiles, 'merge', overallBatchContext.trim() || undefined);
        totalSuccessCount += result.successCount;
        totalErrorCount += result.errorCount;
        result.errors.forEach(err => allFileErrors.push({ ...err, fileName: "Merged Collection Operation" }));
        if (result.newlyCreatedTemplates) allNewlyCreatedTemplatesForZip.push(...result.newlyCreatedTemplates);
      } else if (bulkFiles.length > 0) { 
         toast({ title: "No processable workflow data found", description: "None of the uploaded files contained valid workflow data for merging.", variant: "destructive" });
      }
    } else { // mode === 'bulk'
      if (allItemsForBulkMode.length > 0) {
        // For bulk mode, itemsToImport for bulkAddTemplates will be the array of BulkTemplateUploadItem
        const result = await bulkAddTemplates(allItemsForBulkMode, 'bulk', overallBatchContext.trim() || undefined);
        totalSuccessCount += result.successCount;
        totalErrorCount += result.errorCount;
        result.errors.forEach(err => {
            const originalItem = allItemsForBulkMode.find((_,itemIdx) => itemIdx === err.index); // Find based on index in allItemsForBulkMode
            allFileErrors.push({ ...err, fileName: originalItem?.originalFilename || "Bulk Operation Item" });
        });
        if (result.newlyCreatedTemplates) allNewlyCreatedTemplatesForZip.push(...result.newlyCreatedTemplates);

      } else if (bulkFiles.length > 0) {
         toast({ title: "No processable workflow data found", description: "None of the uploaded files contained valid workflow data for bulk import.", variant: "destructive" });
      }
    }
    
    setGeneratedTemplatesForZip(allNewlyCreatedTemplatesForZip);

    let summaryMessage = `Bulk import process (${bulkImportMode} mode) finished. Successfully imported ${totalSuccessCount} template entr${totalSuccessCount === 1 ? 'y' : 'ies'} using AI generation.`;
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
      allFileErrors.forEach(err => {
        const itemCtx = err.itemIdentifier || (typeof err.index === 'number' ? `Item ${err.index + 1}` : 'Item');
        toast({
          title: `Import Error (File: ${err.fileName}, ${itemCtx})`,
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
      toast({ title: "No templates to download", description: "No templates were successfully generated in the last operation.", variant: "default" });
      return;
    }

    const zip = new JSZip();
    let filesAddedToZip = 0;

    for (const template of generatedTemplatesForZip) {
      if (template.isCollection && template.templateData) {
        try {
          const workflowFiles = JSON.parse(template.templateData) as WorkflowFile[];
          workflowFiles.forEach(wf => {
            const safeFilename = wf.filename.replace(/[^a-z0-9_.-]/gi, '_');
            zip.file(safeFilename, wf.content);
            filesAddedToZip++;
          });
        } catch (e) {
          console.error("Error parsing workflow collection for zipping:", template.title, e);
        }
      } else if (!template.isCollection && template.templateData) {
        const filename = (template.slug || template.title.replace(/[^a-z0-9_.-]/gi, '_') || `template_${template.id}`) + '.json';
        zip.file(filename, template.templateData);
        filesAddedToZip++;
      }
    }
    
    if (filesAddedToZip === 0) {
        toast({ title: "No template data", description: "None of the generated templates had downloadable workflow data.", variant: "destructive" });
        return;
    }

    try {
      const content = await zip.generateAsync({ type: "blob" });
      const zipFilename = bulkImportMode === 'merge' ? "merged_collection_workflows.zip" : "generated_individual_workflows.zip";
      downloadBlob(content, zipFilename);
      toast({ title: "Download Started", description: `Zipping ${filesAddedToZip} workflow file(s).` });
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
            <CardDescription>
              Upload one or more JSON files. Each file can be a raw n8n/Make.com workflow, an object with a `workflowData` key, or an array of such objects.
              AI will generate metadata. `additionalContext` from items will guide AI.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div>
                <label htmlFor="bulkImportMode" className="text-sm font-medium text-muted-foreground">Import Mode</label>
                 <Select value={bulkImportMode} onValueChange={(value: 'bulk' | 'merge') => setBulkImportMode(value)} disabled={isBulkUploading}>
                    <SelectTrigger id="bulkImportMode" className="w-full">
                        <SelectValue placeholder="Select import mode" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="bulk"><Package className="mr-2 h-4 w-4 inline-block"/>Bulk (Individual Entries)</SelectItem>
                        <SelectItem value="merge"><Combine className="mr-2 h-4 w-4 inline-block"/>Merge (Single Collection Entry)</SelectItem>
                    </SelectContent>
                </Select>
                 <p className="text-xs text-muted-foreground mt-1">
                    {bulkImportMode === 'bulk' ? "Each workflow object becomes a separate template." : "All workflows from all files are combined into one template entry."}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={handleBulkUpload} disabled={bulkFiles.length === 0 || isBulkUploading} className="flex-grow sm:flex-grow-0 glow-button">
                {isBulkUploading ? <Files className="mr-2 h-5 w-5 animate-spin" /> : <UploadCloud className="mr-2 h-5 w-5" />}
                {isBulkUploading ? `Processing ${bulkFiles.length} file(s)...` : `Upload & Generate (${bulkImportMode})`}
              </Button>
              {generatedTemplatesForZip.length > 0 && !isBulkUploading && (
                 <Button onClick={downloadGeneratedTemplatesAsZip} variant="outline" className="flex-grow sm:flex-grow-0">
                   <Download className="mr-2 h-5 w-5" /> Download Generated as ZIP ({generatedTemplatesForZip.length})
                 </Button>
              )}
            </div>
             <p className="text-xs text-muted-foreground">
              Supported JSON file structures:
              <br/> - A raw workflow JSON object (n8n or Make.com).
              <br/> - An object with a `workflowData` key (containing the raw workflow as a string or object) and other optional keys like `type`, `additionalContext`, `imageUrl`, `imageVisible`, `videoUrl`.
              <br/> - An array of the above object structures.
              <br/>
              `title`, `summary`, `setupGuide`, `useCases` will be AI-generated based on `workflowData` and `additionalContext`.
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
                      <h3 className="font-semibold text-lg text-foreground">{template.title} {template.isCollection && <Badge variant="outline" className="ml-2">Collection</Badge>}</h3>
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

    