
"use client";

import type { Template, TemplateWithoutId, WorkflowFile, AdditionalFile } from '@/types';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { generateTemplateMetadata, type GenerateTemplateMetadataOutput } from '@/ai/flows/template-generation';
// templates.json is no longer directly imported for initial data. It's managed via API.

export interface BulkTemplateUploadItem {
  workflowData: string;
  type?: 'n8n' | 'make.com' | 'unknown';
  additionalContext?: string;
  imageUrl?: string;
  imageVisible?: boolean;
  videoUrl?: string;
  iconName?: string;
  originalFilename?: string;
}

export interface BulkAddResult {
  successCount: number;
  errorCount: number;
  errors: { index: number; inputTitle?: string; itemIdentifier?: string; message: string }[];
  newlyCreatedTemplates: Template[];
}

interface TemplateContextType {
  templates: Template[];
  addTemplate: (templateData: TemplateWithoutId) => Promise<Template>;
  bulkAddTemplates: (itemsToProcess: Array<BulkTemplateUploadItem | WorkflowFile>, mode: 'bulk' | 'merge', overallBatchContext?: string) => Promise<BulkAddResult>;
  getTemplateBySlug: (slug: string) => Template | undefined;
  updateTemplate: (updatedTemplate: Template) => Promise<void>;
  deleteTemplate: (templateId: string) => Promise<void>;
  getTemplatesAsContextString: () => string;
  loading: boolean;
  searchTemplates: (searchTerm: string, typeFilter: 'all' | 'n8n' | 'make.com' | 'collection') => Template[];
}

const TemplateContext = createContext<TemplateContextType | undefined>(undefined);

const generateSlug = (title: string, idSuffix: string = '') => {
  if (!title) return Date.now().toString() + (idSuffix ? `-${idSuffix.substring(0, 6)}` : '');
  return title
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    + (idSuffix ? `-${idSuffix.substring(0, 6)}` : '');
};

export const TemplateProvider = ({ children }: { children: ReactNode }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplatesFromAPI = useCallback(async () => {
    console.log("TemplateContext: Fetching templates from API...");
    setLoading(true);
    try {
      const response = await fetch('/api/templates');
      if (!response.ok) {
        throw new Error(`Failed to fetch templates: ${response.statusText}`);
      }
      const data = await response.json();
      // Ensure data is an array before setting state
      if (Array.isArray(data)) {
        // Ensure defaults for each template, especially dates which might not be ISO strings from JSON
        const processedData = data.map(t => ({
          ...t,
          createdAt: t.createdAt || new Date().toISOString(),
          updatedAt: t.updatedAt || new Date().toISOString(),
          isCollection: t.isCollection ?? false,
          imageVisible: t.imageVisible ?? true,
          useCases: Array.isArray(t.useCases) ? t.useCases : [],
          additionalFiles: Array.isArray(t.additionalFiles) ? t.additionalFiles : [],
          imageUrl: t.imageUrl || null,
          videoUrl: t.videoUrl || null,
          iconName: t.iconName || null,
          templateData: t.templateData || null,
          type: t.type || (t.isCollection ? 'collection' : 'unknown'),
        }));
        setTemplates(processedData);
        console.log("TemplateContext: Templates loaded from API:", processedData.length);
      } else {
        console.error("TemplateContext: API did not return an array. Received:", data);
        setTemplates([]); // Default to empty if data is not an array
      }
    } catch (error) {
      console.error("TemplateContext: Error fetching templates from API:", error);
      setTemplates([]); // Default to empty on error
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTemplatesFromAPI();
  }, [fetchTemplatesFromAPI]);

  const saveTemplatesToAPI = useCallback(async (updatedTemplates: Template[]) => {
    console.log("TemplateContext: Saving templates to API...");
    try {
      const response = await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedTemplates),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to save templates: ${response.statusText} - ${errorData.message}`);
      }
      console.log("TemplateContext: Templates successfully saved to API.");
      // Optionally re-fetch or trust the local state if the POST implies success means the file is updated.
      // For simplicity, we'll assume the local state is now the source of truth until next full fetch.
    } catch (error) {
      console.error("TemplateContext: Error saving templates to API:", error);
      // Potentially show a toast to the user about the save failure
    }
  }, []);

  const addTemplate = useCallback(async (templateData: TemplateWithoutId): Promise<Template> => {
    const now = new Date().toISOString();
    const newId = Date.now().toString();
    const title = templateData.title || 'Untitled Template';
    const newTemplate: Template = {
      id: newId,
      slug: generateSlug(title, newId),
      title,
      summary: templateData.summary || 'No summary.',
      templateData: templateData.templateData || null,
      isCollection: templateData.isCollection ?? false,
      setupGuide: templateData.setupGuide || 'No setup guide.',
      useCases: Array.isArray(templateData.useCases) ? templateData.useCases : [],
      type: templateData.type || (templateData.isCollection ? 'collection' : 'unknown'),
      createdAt: now,
      updatedAt: now,
      imageUrl: templateData.imageUrl || null,
      imageVisible: templateData.imageVisible ?? true,
      videoUrl: templateData.videoUrl || null,
      iconName: templateData.iconName || null,
      additionalFiles: Array.isArray(templateData.additionalFiles) ? templateData.additionalFiles : [],
    };

    const updatedTemplates = [...templates, newTemplate];
    setTemplates(updatedTemplates);
    await saveTemplatesToAPI(updatedTemplates);
    console.log("TemplateContext: Template added locally. Attempted save to API. Current count:", updatedTemplates.length);
    return newTemplate;
  }, [templates, saveTemplatesToAPI]);

  const bulkAddTemplates = useCallback(async (
    itemsToProcess: Array<BulkTemplateUploadItem | WorkflowFile>,
    mode: 'bulk' | 'merge',
    overallBatchContext?: string
  ): Promise<BulkAddResult> => {
    const results: BulkAddResult = { successCount: 0, errorCount: 0, errors: [], newlyCreatedTemplates: [] };
    const now = new Date().toISOString();
    const newTemplatesBatch: Template[] = []; // Templates to be added in this operation

    if (mode === 'merge') {
      const workflowFiles = itemsToProcess as WorkflowFile[];
      if (workflowFiles.length === 0) {
        results.errors.push({ index: 0, message: "No files provided for merge operation." });
        results.errorCount = 1;
        return results;
      }
      const combinedWorkflowDataForAI = workflowFiles.map(wf => wf.content).join('\n\n---\n\n');
      const templateDataForStorage = JSON.stringify(workflowFiles.map(wf => ({ filename: wf.filename, content: wf.content })));
      try {
        const aiGeneratedMetadata: GenerateTemplateMetadataOutput = await generateTemplateMetadata({
          templateData: combinedWorkflowDataForAI,
          additionalContext: overallBatchContext || undefined,
        });
        const title = aiGeneratedMetadata.title || 'Untitled Merged Collection';
        if (title.trim() === "") {
          throw new Error('AI failed to generate a non-empty title for the merged collection.');
        }
        const newId = Date.now().toString();
        const templateToSave: Template = {
          id: newId,
          title,
          summary: aiGeneratedMetadata.summary || 'No summary.',
          setupGuide: aiGeneratedMetadata.setupGuide || 'No setup guide.',
          useCases: Array.isArray(aiGeneratedMetadata.useCases) ? aiGeneratedMetadata.useCases : [],
          templateData: templateDataForStorage,
          isCollection: true,
          type: 'collection',
          iconName: aiGeneratedMetadata.iconName || null,
          imageUrl: (itemsToProcess[0] as BulkTemplateUploadItem)?.imageUrl || null,
          imageVisible: (itemsToProcess[0] as BulkTemplateUploadItem)?.imageVisible ?? true,
          videoUrl: (itemsToProcess[0] as BulkTemplateUploadItem)?.videoUrl || null,
          additionalFiles: [],
          createdAt: now,
          updatedAt: now,
          slug: generateSlug(title, newId),
        };
        newTemplatesBatch.push(templateToSave);
        results.newlyCreatedTemplates.push(templateToSave);
        results.successCount++;
      } catch (error) {
        results.errorCount++;
        results.errors.push({
          index: 0,
          itemIdentifier: "Merged Collection Operation",
          message: error instanceof Error ? error.message : 'An unknown error occurred during AI generation for merged collection.',
        });
      }
    } else { // mode === 'bulk'
      const bulkItems = itemsToProcess as BulkTemplateUploadItem[];
      for (let i = 0; i < bulkItems.length; i++) {
        const item = bulkItems[i];
        const itemIdentifier = item.originalFilename || `Item ${i + 1}` + (item.type ? ` (${item.type})` : '');
        if (!item.workflowData || typeof item.workflowData !== 'string' || item.workflowData.trim() === '') {
          results.errorCount++;
          results.errors.push({ index: i, itemIdentifier, message: `Item is missing 'workflowData', it's not a string, or it's empty.` });
          continue;
        }
        try {
          let combinedAdditionalContext = item.additionalContext || '';
          if (overallBatchContext && overallBatchContext.trim() !== '') {
            combinedAdditionalContext = combinedAdditionalContext.trim() ? `${combinedAdditionalContext}\n\n--- Overall Batch Context ---\n${overallBatchContext}` : overallBatchContext;
          }
          const aiGeneratedMetadata: GenerateTemplateMetadataOutput = await generateTemplateMetadata({
            templateData: item.workflowData,
            additionalContext: combinedAdditionalContext.trim() || undefined,
          });
          const title = aiGeneratedMetadata.title || `Untitled Template ${i + 1}`;
          if (title.trim() === "") {
            throw new Error('AI failed to generate a non-empty title for the template.');
          }
          const newId = `${Date.now().toString()}-${i}`;
          const templateToSave: Template = {
            id: newId,
            title,
            summary: aiGeneratedMetadata.summary || 'No summary.',
            setupGuide: aiGeneratedMetadata.setupGuide || 'No setup guide.',
            useCases: Array.isArray(aiGeneratedMetadata.useCases) ? aiGeneratedMetadata.useCases : [],
            templateData: item.workflowData,
            isCollection: false,
            type: item.type || 'unknown',
            imageUrl: item.imageUrl || null,
            imageVisible: item.imageVisible ?? true,
            videoUrl: item.videoUrl || null,
            iconName: aiGeneratedMetadata.iconName || item.iconName || null,
            additionalFiles: [],
            createdAt: now,
            updatedAt: now,
            slug: generateSlug(title, newId),
          };
          newTemplatesBatch.push(templateToSave);
          results.newlyCreatedTemplates.push(templateToSave);
          results.successCount++;
        } catch (error) {
          results.errorCount++;
          results.errors.push({
            index: i,
            itemIdentifier,
            inputTitle: item.type,
            message: error instanceof Error ? error.message : 'An unknown error occurred during AI generation or template creation.',
          });
        }
      }
    }

    if (newTemplatesBatch.length > 0) {
      const updatedTemplates = [...templates, ...newTemplatesBatch];
      setTemplates(updatedTemplates);
      await saveTemplatesToAPI(updatedTemplates);
      console.log(`TemplateContext: ${newTemplatesBatch.length} templates added locally from bulk. Attempted save to API.`);
    }
    return results;
  }, [templates, saveTemplatesToAPI]);

  const getTemplateBySlug = useCallback((slug: string): Template | undefined => {
    return templates.find(template => template.slug === slug);
  }, [templates]);

  const updateTemplate = useCallback(async (updatedTemplateData: Template) => {
    const updatedTemplates = templates.map(t =>
      t.id === updatedTemplateData.id ? { ...updatedTemplateData, updatedAt: new Date().toISOString() } : t
    );
    setTemplates(updatedTemplates);
    await saveTemplatesToAPI(updatedTemplates);
    console.log("TemplateContext: Template updated locally. Attempted save to API.");
  }, [templates, saveTemplatesToAPI]);

  const deleteTemplate = useCallback(async (templateId: string) => {
    const updatedTemplates = templates.filter(t => t.id !== templateId);
    setTemplates(updatedTemplates);
    await saveTemplatesToAPI(updatedTemplates);
    console.log("TemplateContext: Template deleted locally. Attempted save to API.");
  }, [templates, saveTemplatesToAPI]);

  const getTemplatesAsContextString = useCallback((): string => {
    if (templates.length === 0) {
      return "No templates are currently available in the library.";
    }
    return templates.map(t => {
      let context = `Template Title: ${t.title}\nSummary: ${t.summary}\nType: ${t.type}\n`;
      if (t.iconName) context += `Icon: ${t.iconName}\n`;
      if (t.isCollection && t.templateData) {
        try {
          const collectionFiles = JSON.parse(t.templateData) as WorkflowFile[];
          context += `This is a collection of ${collectionFiles.length} workflow files: ${collectionFiles.map(f => f.filename).join(', ')}\n`;
        } catch (e) { context += `This is a collection of workflow files.\n`; }
      }
      if (t.additionalFiles && t.additionalFiles.length > 0) {
        context += `Additional files: ${t.additionalFiles.map(f => f.filename).join(', ')}\n`;
      }
      context += `Use Cases: ${t.useCases.join(', ')}\nSetup involves: ${t.setupGuide.substring(0, 150)}...\n`;
      return context;
    }).join("\n---\n");
  }, [templates]);

  const searchTemplates = useCallback((searchTerm: string, typeFilter: 'all' | 'n8n' | 'make.com' | 'collection'): Template[] => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return templates.filter(template => {
      const titleMatch = template.title?.toLowerCase().includes(lowerSearchTerm) ?? false;
      const summaryMatch = template.summary?.toLowerCase().includes(lowerSearchTerm) ?? false;
      const matchesSearch = titleMatch || summaryMatch;
      const currentType = template.isCollection ? 'collection' : template.type;
      const matchesType = typeFilter === 'all' || currentType === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [templates]);

  return (
    <TemplateContext.Provider value={{
      templates,
      addTemplate,
      bulkAddTemplates,
      getTemplateBySlug,
      updateTemplate,
      deleteTemplate,
      getTemplatesAsContextString,
      loading,
      searchTemplates
    }}>
      {children}
    </TemplateContext.Provider>
  );
};

export const useTemplates = (): TemplateContextType => {
  const context = useContext(TemplateContext);
  if (context === undefined) {
    throw new Error('useTemplates must be used within a TemplateProvider');
  }
  return context;
};
