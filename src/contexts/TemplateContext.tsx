
"use client";

import type { Template, TemplateWithoutId } from '@/types';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { generateTemplateMetadata } from '@/ai/flows/template-generation';

// Structure expected for each item in the bulk upload JSON file
export interface BulkTemplateUploadItem {
  workflowData: string; // Renamed from templateData in the uploaded file for clarity
  type?: 'n8n' | 'make.com' | 'unknown';
  additionalContext?: string;
  imageUrl?: string;
  imageVisible?: boolean;
  videoUrl?: string;
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
  bulkAddTemplates: (itemsToImport: BulkTemplateUploadItem[], overallBatchContext?: string) => Promise<BulkAddResult>;
  getTemplateBySlug: (slug: string) => Template | undefined;
  updateTemplate: (updatedTemplate: Template) => void;
  deleteTemplate: (templateId: string) => void;
  getTemplatesAsContextString: () => string;
  loading: boolean;
  searchTemplates: (searchTerm: string, typeFilter: 'all' | 'n8n' | 'make.com') => Template[];
}

const TemplateContext = createContext<TemplateContextType | undefined>(undefined);

const TEMPLATE_STORAGE_KEY = 'agentverse_templates';

const generateSlug = (title: string) => {
  if (!title) return Date.now().toString(); // Fallback if title is empty
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
    setupGuide: '1. Connect your Gmail account.\n2. Define common inquiry types.\n3. Customize response templates.\n4. Activate the agent.',
    useCases: ['Customer support automation', 'Sales follow-ups', 'Feedback collection'],
    type: 'n8n',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    slug: 'automated-email-responder',
    imageUrl: `https://placehold.co/1200x600/1A122B/E5B8F4?text=Email+Responder`,
    imageVisible: true,
    videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 
  },
  {
    id: '2',
    title: 'Airtable to Slack Notifier',
    summary: 'Sends notifications to a Slack channel whenever a new record is added or updated in an Airtable base.',
    templateData: '{"name": "Airtable Slack Notifier", "modules": []}',
    setupGuide: '1. Authenticate Airtable.\n2. Select your Base and Table.\n3. Authenticate Slack.\n4. Choose your channel and customize message format.',
    useCases: ['Project management updates', 'New lead alerts', 'Data entry notifications'],
    type: 'make.com',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    slug: 'airtable-to-slack-notifier',
    imageUrl: `https://placehold.co/1200x600/1A122B/E5B8F4?text=Airtable+Slack`,
    imageVisible: true,
  },
  {
    id: '3',
    title: 'Social Media Content Scheduler',
    summary: 'Automatically posts content to multiple social media platforms based on a predefined schedule.',
    // templateData intentionally left undefined for this example to test disabled download
    setupGuide: '1. Connect social media accounts (Twitter, Facebook, LinkedIn).\n2. Prepare your content calendar (spreadsheet or Airtable).\n3. Configure posting frequency and times.\n4. Run the automation.',
    useCases: ['Brand visibility', 'Consistent online presence', 'Marketing campaigns'],
    type: 'n8n',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    slug: 'social-media-content-scheduler',
    imageUrl: `https://placehold.co/1200x600/1A122B/E5B8F4?text=Social+Scheduler`,
    imageVisible: false, 
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
        }));
        setTemplates(parsedTemplates);
      } else {
        setTemplates(initialTemplates.map(t => ({...t, imageVisible: t.imageVisible ?? true, videoUrl: t.videoUrl || undefined })));
        localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(initialTemplates));
      }
    } catch (error) {
      console.error("Failed to access localStorage for templates:", error);
      setTemplates(initialTemplates.map(t => ({...t, imageVisible: t.imageVisible ?? true, videoUrl: t.videoUrl || undefined }))); 
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
    const newSlug = `${baseSlug}-${newId}`; // Ensure slug uniqueness
    
    const newTemplate: Template = {
      ...templateData, 
      id: newId,
      slug: newSlug, 
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      imageVisible: templateData.imageVisible ?? true,
      videoUrl: templateData.videoUrl || undefined,
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


  const bulkAddTemplates = useCallback(async (itemsToImport: BulkTemplateUploadItem[], overallBatchContext?: string): Promise<BulkAddResult> => {
    const results: BulkAddResult = { successCount: 0, errorCount: 0, errors: [], newlyCreatedTemplates: [] };
    const batchNewlyAddedTemplates: Template[] = [];

    for (let i = 0; i < itemsToImport.length; i++) {
      const item = itemsToImport[i];
      const itemIdentifier = `Item ${i + 1}` + (item.type ? ` (${item.type})` : '');

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
          type: item.type || 'unknown',
          imageUrl: item.imageUrl,
          imageVisible: item.imageVisible ?? true,
          videoUrl: item.videoUrl || undefined,
        };
        
        const newTemplate = internalAddTemplate(templateDataForAdd, `-${i}`);
        batchNewlyAddedTemplates.push(newTemplate);
        results.successCount++;

      } catch (error) {
        results.errorCount++;
        results.errors.push({
          index: i,
          itemIdentifier,
          inputTitle: item.type, // or some other identifier from item if available
          message: error instanceof Error ? error.message : 'An unknown error occurred during AI generation or template creation.',
        });
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
    const templateWithPotentiallyNewSlug: Template = { // Renamed variable for clarity
        ...updatedTemplate,
        imageVisible: updatedTemplate.imageVisible ?? true,
        videoUrl: updatedTemplate.videoUrl || undefined,
        slug: `${baseSlug}-${updatedTemplate.id}`, 
        updatedAt: new Date().toISOString()
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
    return templates.map(t => 
      `Template Title: ${t.title}\nSummary: ${t.summary}\nType: ${t.type}\nUse Cases: ${t.useCases.join(', ')}\nSetup involves: ${t.setupGuide.substring(0,150)}...\n`
    ).join("\n---\n");
  }, [templates]);

  const searchTemplates = useCallback((searchTerm: string, typeFilter: 'all' | 'n8n' | 'make.com'): Template[] => {
    const lowerSearchTerm = searchTerm.toLowerCase();
    return templates.filter(template => {
      const matchesSearch = template.title.toLowerCase().includes(lowerSearchTerm) ||
                            template.summary.toLowerCase().includes(lowerSearchTerm);
      const matchesType = typeFilter === 'all' || template.type === typeFilter;
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

