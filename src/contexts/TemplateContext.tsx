
"use client";

import type { Template, TemplateWithoutId, WorkflowFile } from '@/types';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { generateTemplateMetadata } from '@/ai/flows/template-generation';

// Structure expected for each item when processing for bulk/merge.
// In 'bulk' mode, itemsToImport will be an array of these (usually one per file, but could be more if file itself is an array).
// In 'merge' mode, itemsToImport will be an array of WorkflowFile (which has filename and content).
export interface BulkTemplateUploadItem {
  workflowData: string; // Renamed from templateData in the uploaded file for clarity
  type?: 'n8n' | 'make.com' | 'unknown';
  additionalContext?: string;
  imageUrl?: string;
  imageVisible?: boolean;
  videoUrl?: string;
  iconName?: string;
  originalFilename?: string; // Added to carry the original filename
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
  // `itemsToImport` is WorkflowFile[] for 'merge', and BulkTemplateUploadItem[] for 'bulk'
  bulkAddTemplates: (itemsToProcess: Array<BulkTemplateUploadItem | WorkflowFile>, mode: 'bulk' | 'merge', overallBatchContext?: string) => Promise<BulkAddResult>;
  getTemplateBySlug: (slug: string) => Template | undefined;
  updateTemplate: (updatedTemplate: Template) => void;
  deleteTemplate: (templateId: string) => void;
  getTemplatesAsContextString: () => string;
  loading: boolean;
  searchTemplates: (searchTerm: string, typeFilter: 'all' | 'n8n' | 'make.com' | 'collection') => Template[];
}

const TemplateContext = createContext<TemplateContextType | undefined>(undefined);

const TEMPLATE_STORAGE_KEY = 'agentverse_templates';

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


const initialTemplates: Template[] = [
  {
    id: '1',
    title: 'Automated Email Responder',
    summary: 'Responds to common customer inquiries using predefined email templates and AI-powered personalization.',
    templateData: '{"name": "Email Responder Workflow", "nodes": []}',
    isCollection: false,
    setupGuide: '1. Connect your Gmail account.\n2. Define common inquiry types.\n3. Customize response templates.\n4. Activate the agent.',
    useCases: ['Customer support automation', 'Sales follow-ups', 'Feedback collection'],
    type: 'n8n',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    slug: 'automated-email-responder',
    imageUrl: `https://placehold.co/1200x600/1A122B/E5B8F4?text=Email+Responder`,
    imageVisible: true,
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 
    iconName: 'Mail',
  },
  {
    id: '2',
    title: 'Airtable to Slack Notifier',
    summary: 'Sends notifications to a Slack channel whenever a new record is added or updated in an Airtable base.',
    templateData: '{"name": "Airtable Slack Notifier", "modules": []}',
    isCollection: false,
    setupGuide: '1. Authenticate Airtable.\n2. Select your Base and Table.\n3. Authenticate Slack.\n4. Choose your channel and customize message format.',
    useCases: ['Project management updates', 'New lead alerts', 'Data entry notifications'],
    type: 'make.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    slug: 'airtable-to-slack-notifier',
    imageUrl: `https://placehold.co/1200x600/1A122B/E5B8F4?text=Airtable+Slack`,
    imageVisible: true,
    iconName: 'DatabaseZap',
  },
  {
    id: '3',
    title: 'Social Media Content Scheduler',
    summary: 'Automatically posts content to multiple social media platforms based on a predefined schedule.',
    isCollection: false,
    setupGuide: '1. Connect social media accounts (Twitter, Facebook, LinkedIn).\n2. Prepare your content calendar (spreadsheet or Airtable).\n3. Configure posting frequency and times.\n4. Run the automation.',
    useCases: ['Brand visibility', 'Consistent online presence', 'Marketing campaigns'],
    type: 'n8n',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    slug: 'social-media-content-scheduler',
    imageUrl: `https://placehold.co/1200x600/1A122B/E5B8F4?text=Social+Scheduler`,
    imageVisible: false, 
    iconName: 'Share2',
  }
];


export const TemplateProvider = ({ children }: { children: ReactNode }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedTemplates = localStorage.getItem(TEMPLATE_STORAGE_KEY);
      if (storedTemplates) {
        const parsedTemplates = JSON.parse(storedTemplates).map((t: any) => ({
          ...t,
          imageVisible: t.imageVisible ?? true, 
          videoUrl: t.videoUrl || undefined,
          isCollection: t.isCollection || false,
          type: t.type || (t.isCollection ? 'collection' : 'unknown'),
          iconName: t.iconName || undefined,
        }));
        setTemplates(parsedTemplates);
      } else {
        const initialWithDefaults = initialTemplates.map(t => ({
            ...t, 
            imageVisible: t.imageVisible ?? true, 
            videoUrl: t.videoUrl || undefined,
            isCollection: t.isCollection || false,
            type: t.type || (t.isCollection ? 'collection' : 'unknown'),
            iconName: t.iconName || undefined,
        }));
        setTemplates(initialWithDefaults);
        localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(initialWithDefaults));
      }
    } catch (error) {
      console.error("Failed to access localStorage for templates:", error);
      const initialWithDefaults = initialTemplates.map(t => ({
        ...t, 
        imageVisible: t.imageVisible ?? true, 
        videoUrl: t.videoUrl || undefined,
        isCollection: t.isCollection || false,
        type: t.type || (t.isCollection ? 'collection' : 'unknown'),
        iconName: t.iconName || undefined,
      }));
      setTemplates(initialWithDefaults); 
    }
    setLoading(false);
  }, []);

  const saveTemplatesToLocalStorage = useCallback((updatedTemplates: Template[]) => {
    try {
      localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(updatedTemplates));
    } catch (error) {
      console.error("Failed to save templates to localStorage:", error);
    }
  }, []);

  const internalAddTemplate = (templateData: TemplateWithoutId, idSuffix: string = ''): Template => {
    const newId = `${Date.now().toString()}${idSuffix}`;
    const baseSlug = generateSlug(templateData.title);
    const newSlug = `${baseSlug}-${newId}`; 
    
    const newTemplate: Template = {
      ...templateData, 
      id: newId,
      slug: newSlug, 
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      imageVisible: templateData.imageVisible ?? true,
      videoUrl: templateData.videoUrl || undefined,
      isCollection: templateData.isCollection || false,
      type: templateData.type || (templateData.isCollection ? 'collection' : 'unknown'),
      iconName: templateData.iconName || undefined,
    };
    return newTemplate;
  };
  
  const addTemplate = useCallback((templateData: TemplateWithoutId): Template => {
    const newTemplate = internalAddTemplate(templateData);
    setTemplates(prevTemplates => {
      const updated = [...prevTemplates, newTemplate];
      saveTemplatesToLocalStorage(updated);
      return updated;
    });
    return newTemplate;
  }, [saveTemplatesToLocalStorage]);


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

      const combinedWorkflowData = workflowFiles.map(wf => wf.content).join('\n\n---\n\n');

      try {
        const aiGeneratedMetadata = await generateTemplateMetadata({
          templateData: combinedWorkflowData,
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
          templateData: JSON.stringify(workflowFiles), // Store the collection manifest
          isCollection: true,
          type: 'collection',
          // image/video/iconName for merged items could be set if there's a way to specify them for the collection
        };
        const newTemplate = internalAddTemplate(templateDataForAdd, "-merged");
        batchNewlyAddedTemplates.push(newTemplate);
        results.successCount++;
      } catch (error) {
        results.errorCount++;
        results.errors.push({
          index: 0, // Only one item in merge mode
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

          const aiGeneratedMetadata = await generateTemplateMetadata({
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
            iconName: item.iconName || undefined,
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
        saveTemplatesToLocalStorage(updated);
        return updated;
      });
      results.newlyCreatedTemplates = batchNewlyAddedTemplates;
    }
    return results;
  }, [saveTemplatesToLocalStorage, internalAddTemplate]);

  const getTemplateBySlug = useCallback((slug: string): Template | undefined => {
    return templates.find(template => template.slug === slug);
  }, [templates]);

  const updateTemplate = useCallback((updatedTemplate: Template) => {
    const baseSlug = generateSlug(updatedTemplate.title);
    const templateWithPotentiallyNewSlug: Template = {
        ...updatedTemplate,
        imageVisible: updatedTemplate.imageVisible ?? true,
        videoUrl: updatedTemplate.videoUrl || undefined,
        iconName: updatedTemplate.iconName || undefined,
        slug: `${baseSlug}-${updatedTemplate.id}`, 
        updatedAt: new Date().toISOString(),
        isCollection: updatedTemplate.isCollection || false,
        type: updatedTemplate.type || (updatedTemplate.isCollection ? 'collection' : 'unknown'),
    };

    setTemplates(prevTemplates => {
      const updated = prevTemplates.map(t => t.id === templateWithPotentiallyNewSlug.id ? templateWithPotentiallyNewSlug : t);
      saveTemplatesToLocalStorage(updated);
      return updated;
    });
  }, [saveTemplatesToLocalStorage]);

  const deleteTemplate = useCallback((templateId: string) => {
    setTemplates(prevTemplates => {
      const updated = prevTemplates.filter(t => t.id !== templateId);
      saveTemplatesToLocalStorage(updated);
      return updated;
    });
  }, [saveTemplatesToLocalStorage]);

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
