
"use client";

import type { Template, TemplateWithoutId, WorkflowFile, AdditionalFile } from '@/types';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { generateTemplateMetadata, type GenerateTemplateMetadataOutput } from '@/ai/flows/template-generation';
import templatesData from '@/data/templates.json'; // Import static JSON data

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
  addTemplate: (templateData: TemplateWithoutId) => Template;
  bulkAddTemplates: (itemsToProcess: Array<BulkTemplateUploadItem | WorkflowFile>, mode: 'bulk' | 'merge', overallBatchContext?: string) => Promise<BulkAddResult>;
  getTemplateBySlug: (slug: string) => Template | undefined;
  updateTemplate: (updatedTemplate: Template) => void;
  deleteTemplate: (templateId: string) => void;
  getTemplatesAsContextString: () => string;
  loading: boolean;
  searchTemplates: (searchTerm: string, typeFilter: 'all' | 'n8n' | 'make.com' | 'collection') => Template[];
}

const TemplateContext = createContext<TemplateContextType | undefined>(undefined);

const generateSlug = (title: string) => {
  if (!title) return Date.now().toString();
  return title
    .toLowerCase()
    .replace(/\s+/g, '-') 
    .replace(/[^\w-]+/g, '') 
    .replace(/--+/g, '-') 
    .replace(/^-+/, '') 
    .replace(/-+$/, ''); 
};

export const TemplateProvider = ({ children }: { children: ReactNode }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize templates from the imported JSON file
    const initialTemplatesWithDefaults = templatesData.map((t: any) => ({
      ...t,
      id: t.id || Date.now().toString() + Math.random().toString(36).substring(2,9), // Ensure ID
      slug: t.slug || generateSlug(t.title) + '-' + (t.id || Date.now().toString()), // Ensure slug
      createdAt: t.createdAt || new Date().toISOString(),
      updatedAt: t.updatedAt || new Date().toISOString(),
      imageVisible: t.imageVisible ?? true, 
      videoUrl: t.videoUrl || undefined,
      isCollection: t.isCollection || false,
      type: t.type || (t.isCollection ? 'collection' : 'unknown'),
      iconName: t.iconName || undefined,
      additionalFiles: t.additionalFiles || [],
    }));
    setTemplates(initialTemplatesWithDefaults as Template[]);
    setLoading(false);
  }, []);

  const internalAddTemplate = (templateData: TemplateWithoutId, idSuffix: string = ''): Template => {
    const newId = `${Date.now().toString()}${idSuffix || Math.random().toString(36).substring(2,9)}`;
    const baseSlug = generateSlug(templateData.title);
    let uniqueSlug = `${baseSlug}-${newId}`;
    
    // Ensure slug is unique within the current in-memory state
    let counter = 1;
    while (templates.some(t => t.slug === uniqueSlug)) {
        uniqueSlug = `${baseSlug}-${newId}-${counter++}`;
    }
    
    const newTemplate: Template = {
      ...templateData, 
      id: newId,
      slug: uniqueSlug, 
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      imageVisible: templateData.imageVisible ?? true,
      videoUrl: templateData.videoUrl || undefined,
      isCollection: templateData.isCollection || false,
      type: templateData.type || (templateData.isCollection ? 'collection' : 'unknown'),
      iconName: templateData.iconName || undefined,
      additionalFiles: templateData.additionalFiles || [],
    };
    return newTemplate;
  };
  
  const addTemplate = useCallback((templateData: TemplateWithoutId): Template => {
    const newTemplate = internalAddTemplate(templateData);
    setTemplates(prevTemplates => {
      const updated = [...prevTemplates, newTemplate];
      // No local storage persistence
      return updated;
    });
    return newTemplate;
  }, [templates]); // Added templates to dependency array for unique slug generation


  const bulkAddTemplates = useCallback(async (
    itemsToProcess: Array<BulkTemplateUploadItem | WorkflowFile>, 
    mode: 'bulk' | 'merge', 
    overallBatchContext?: string
  ): Promise<BulkAddResult> => {
    const results: BulkAddResult = { successCount: 0, errorCount: 0, errors: [], newlyCreatedTemplates: [] };
    const batchNewlyAddedTemplates: Template[] = [];

    if (mode === 'merge') {
      const workflowFiles = itemsToProcess as WorkflowFile[];
      if (workflowFiles.length === 0) {
        results.errors.push({ index: 0, message: "No files provided for merge operation." });
        results.errorCount = 1;
        return results;
      }

      const combinedWorkflowDataForAI = workflowFiles.map(wf => wf.content).join('\n\n---\n\n');
      const templateDataForStorage = JSON.stringify(workflowFiles); 

      try {
        const aiGeneratedMetadata: GenerateTemplateMetadataOutput = await generateTemplateMetadata({
          templateData: combinedWorkflowDataForAI,
          additionalContext: overallBatchContext || undefined,
        });

        if (!aiGeneratedMetadata.title || aiGeneratedMetadata.title.trim() === "") {
          throw new Error('AI failed to generate a non-empty title for the merged collection.');
        }
        
        const templateDataForAdd: TemplateWithoutId = {
          title: aiGeneratedMetadata.title,
          summary: aiGeneratedMetadata.summary,
          setupGuide: aiGeneratedMetadata.setupGuide,
          useCases: aiGeneratedMetadata.useCases,
          templateData: templateDataForStorage, 
          isCollection: true,
          type: 'collection',
          iconName: aiGeneratedMetadata.iconName || undefined,
          additionalFiles: [], 
        };
        const newTemplate = internalAddTemplate(templateDataForAdd, "-merged");
        batchNewlyAddedTemplates.push(newTemplate);
        results.successCount++;
      } catch (error) {
        results.errorCount++;
        results.errors.push({
          index: 0, 
          itemIdentifier: "Merged Collection",
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
            message: `Item is missing 'workflowData', 'workflowData' is not a string, or 'workflowData' is empty.`,
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

          if (!aiGeneratedMetadata.title || aiGeneratedMetadata.title.trim() === "") {
            throw new Error('AI failed to generate a non-empty title for the template.');
          }

          const templateDataForAdd: TemplateWithoutId = {
            title: aiGeneratedMetadata.title,
            summary: aiGeneratedMetadata.summary,
            setupGuide: aiGeneratedMetadata.setupGuide,
            useCases: aiGeneratedMetadata.useCases,
            templateData: item.workflowData, 
            isCollection: false,
            type: item.type || 'unknown',
            imageUrl: item.imageUrl,
            imageVisible: item.imageVisible ?? true,
            videoUrl: item.videoUrl || undefined,
            iconName: aiGeneratedMetadata.iconName || item.iconName || undefined, 
            additionalFiles: [], 
          };
          
          const newTemplate = internalAddTemplate(templateDataForAdd, `-${i}`);
          batchNewlyAddedTemplates.push(newTemplate);
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
    
    if (batchNewlyAddedTemplates.length > 0) {
      setTemplates(prevTemplates => {
        const updated = [...prevTemplates, ...batchNewlyAddedTemplates];
        // No local storage persistence
        return updated;
      });
      results.newlyCreatedTemplates = batchNewlyAddedTemplates;
    }
    return results;
  }, [templates]); // Added templates to dependency array

  const getTemplateBySlug = useCallback((slug: string): Template | undefined => {
    return templates.find(template => template.slug === slug);
  }, [templates]);

  const updateTemplate = useCallback((updatedTemplateData: Template) => {
    const baseSlug = generateSlug(updatedTemplateData.title);
    let uniqueSlug = `${baseSlug}-${updatedTemplateData.id}`;
    let counter = 1;
    
    // Ensure slug is unique if title changed, excluding the current template itself from check
    while (templates.some(t => t.id !== updatedTemplateData.id && t.slug === uniqueSlug)) {
        uniqueSlug = `${baseSlug}-${updatedTemplateData.id}-${counter++}`;
    }

    const templateWithPotentiallyNewSlug: Template = {
        ...updatedTemplateData,
        imageVisible: updatedTemplateData.imageVisible ?? true,
        videoUrl: updatedTemplateData.videoUrl || undefined,
        iconName: updatedTemplateData.iconName || undefined,
        slug: uniqueSlug, 
        updatedAt: new Date().toISOString(),
        isCollection: updatedTemplateData.isCollection || false,
        type: updatedTemplateData.type || (updatedTemplateData.isCollection ? 'collection' : 'unknown'),
        additionalFiles: updatedTemplateData.additionalFiles || [],
    };

    setTemplates(prevTemplates => {
      const updated = prevTemplates.map(t => t.id === templateWithPotentiallyNewSlug.id ? templateWithPotentiallyNewSlug : t);
      // No local storage persistence
      return updated;
    });
  }, [templates]); // Added templates to dependency array

  const deleteTemplate = useCallback((templateId: string) => {
    setTemplates(prevTemplates => {
      const updated = prevTemplates.filter(t => t.id !== templateId);
      // No local storage persistence
      return updated;
    });
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
        } catch (e) { context += `This is a collection of workflow files.\n`;}
      }
      if (t.additionalFiles && t.additionalFiles.length > 0) {
        context += `Additional files: ${t.additionalFiles.map(f => f.filename).join(', ')}\n`;
      }
      context += `Use Cases: ${t.useCases.join(', ')}\nSetup involves: ${t.setupGuide.substring(0,150)}...\n`;
      return context;
    }).join("\n---\n");
  }, [templates]);

  const searchTemplates = useCallback((searchTerm: string, typeFilter: 'all' | 'n8n' | 'make.com' | 'collection'): Template[] => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return templates.filter(template => {
      const matchesSearch = template.title.toLowerCase().includes(lowerSearchTerm) ||
                            template.summary.toLowerCase().includes(lowerSearchTerm);
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
