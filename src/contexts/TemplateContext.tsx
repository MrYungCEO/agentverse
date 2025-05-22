
"use client";

import type { Template, TemplateWithoutId, WorkflowFile } from '@/types';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { generateTemplateMetadata, type GenerateTemplateMetadataOutput } from '@/ai/flows/template-generation';
import initialTemplatesData from '@/data/templates.json'; // Import from local JSON

// Structure expected for each item when processing for bulk/merge.
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
  addTemplate: (templateData: TemplateWithoutId) => Promise<Template>; // Keep Promise for potential async operations if ever needed
  bulkAddTemplates: (itemsToProcess: Array<BulkTemplateUploadItem | WorkflowFile>, mode: 'bulk' | 'merge', overallBatchContext?: string) => Promise<BulkAddResult>;
  getTemplateBySlug: (slug: string) => Template | undefined;
  updateTemplate: (updatedTemplate: Template) => Promise<void>; // Keep Promise
  deleteTemplate: (templateId: string) => Promise<void>; // Keep Promise
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

// Helper to ensure templates from JSON have all required fields
const ensureTemplateDefaults = (template: any, idBase?: string): Template => {
  const now = new Date().toISOString();
  const baseId = idBase || template.id || Date.now().toString();
  const title = template.title || 'Untitled Template';
  return {
    id: baseId,
    title: title,
    summary: template.summary || 'No summary available.',
    templateData: template.templateData || null,
    isCollection: template.isCollection || false,
    additionalFiles: Array.isArray(template.additionalFiles) ? template.additionalFiles : [],
    setupGuide: template.setupGuide || 'No setup guide available.',
    useCases: Array.isArray(template.useCases) ? template.useCases : [],
    type: template.type || (template.isCollection ? 'collection' : 'unknown'),
    imageUrl: template.imageUrl || null,
    imageVisible: template.imageVisible ?? true,
    videoUrl: template.videoUrl || null,
    iconName: template.iconName || null,
    slug: template.slug || generateSlug(title, baseId),
    createdAt: template.createdAt || now,
    updatedAt: template.updatedAt || now,
  };
};


export const TemplateProvider = ({ children }: { children: ReactNode }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("TemplateContext: Initializing templates from local JSON file...");
    try {
      const processedInitialTemplates = initialTemplatesData.map(t => ensureTemplateDefaults(t));
      setTemplates(processedInitialTemplates);
      console.log("TemplateContext: Templates loaded from JSON:", processedInitialTemplates.length);
    } catch (error) {
      console.error("TemplateContext: Error processing initial templates from JSON:", error);
      setTemplates([]);
    }
    setLoading(false);
  }, []);

  const addTemplate = useCallback(async (templateData: TemplateWithoutId): Promise<Template> => {
    setLoading(true);
    const now = new Date().toISOString();
    const newId = Date.now().toString(); // Simple ID generation
    const title = templateData.title || 'Untitled Template';
    const newTemplate: Template = {
      ...templateData,
      id: newId,
      slug: generateSlug(title, newId),
      createdAt: now,
      updatedAt: now,
      // Ensure defaults for optional fields that might be undefined
      templateData: templateData.templateData || null,
      isCollection: templateData.isCollection || false,
      additionalFiles: templateData.additionalFiles || [],
      imageUrl: templateData.imageUrl || null,
      imageVisible: templateData.imageVisible ?? true,
      videoUrl: templateData.videoUrl || null,
      iconName: templateData.iconName || null,
      type: templateData.type || (templateData.isCollection ? 'collection' : 'unknown')
    };

    setTemplates(prevTemplates => [...prevTemplates, newTemplate]);
    console.log("TemplateContext: Template added to in-memory list. Current count:", templates.length + 1);
    setLoading(false);
    return newTemplate;
  }, [templates.length]);


  const bulkAddTemplates = useCallback(async (
    itemsToProcess: Array<BulkTemplateUploadItem | WorkflowFile>,
    mode: 'bulk' | 'merge',
    overallBatchContext?: string
  ): Promise<BulkAddResult> => {
    setLoading(true);
    const results: BulkAddResult = { successCount: 0, errorCount: 0, errors: [], newlyCreatedTemplates: [] };
    const now = new Date().toISOString();
    const newTemplatesBatch: Template[] = [];

    if (mode === 'merge') {
      const workflowFiles = itemsToProcess as WorkflowFile[];
      if (workflowFiles.length === 0) {
        results.errors.push({ index: 0, message: "No files provided for merge operation." });
        results.errorCount = 1;
        setLoading(false);
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
        const uniqueSlug = generateSlug(title, newId);

        const templateToSave: Template = {
          id: newId,
          title: title,
          summary: aiGeneratedMetadata.summary || '',
          setupGuide: aiGeneratedMetadata.setupGuide || '',
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
          slug: uniqueSlug,
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
          results.errors.push({
            index: i,
            itemIdentifier,
            message: `Item is missing 'workflowData', it's not a string, or it's empty.`,
          });
          continue;
        }

        try {
          let combinedAdditionalContext = item.additionalContext || '';
          if (overallBatchContext && overallBatchContext.trim() !== '') {
            if (combinedAdditionalContext.trim() !== '') {
              combinedAdditionalContext += `\n\n--- Overall Batch Context ---\n${overallBatchContext}`;
            } else {
              combinedAdditionalContext = overallBatchContext;
            }
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
          const uniqueSlug = generateSlug(title, newId);

          const templateToSave: Template = {
            id: newId,
            title: title,
            summary: aiGeneratedMetadata.summary || '',
            setupGuide: aiGeneratedMetadata.setupGuide || '',
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
            slug: uniqueSlug,
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
      setTemplates(prevTemplates => [...prevTemplates, ...newTemplatesBatch]);
      console.log(`TemplateContext: ${newTemplatesBatch.length} templates added to in-memory list from bulk operation.`);
    }
    setLoading(false);
    return results;
  }, []);

  const getTemplateBySlug = useCallback((slug: string): Template | undefined => {
    return templates.find(template => template.slug === slug);
  }, [templates]);

  const updateTemplate = useCallback(async (updatedTemplateData: Template) => {
    setLoading(true);
    setTemplates(prevTemplates =>
      prevTemplates.map(t =>
        t.id === updatedTemplateData.id ? { ...updatedTemplateData, updatedAt: new Date().toISOString() } : t
      )
    );
    console.log("TemplateContext: Template updated in in-memory list.");
    setLoading(false);
  }, []);

  const deleteTemplate = useCallback(async (templateId: string) => {
    setLoading(true);
    setTemplates(prevTemplates => prevTemplates.filter(t => t.id !== templateId));
    console.log("TemplateContext: Template deleted from in-memory list.");
    setLoading(false);
  }, []);

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
