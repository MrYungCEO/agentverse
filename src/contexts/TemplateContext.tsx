"use client";

import type { Template, TemplateWithoutId } from '@/types';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface TemplateContextType {
  templates: Template[];
  addTemplate: (templateData: TemplateWithoutId) => Template;
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
  return title
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
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
    imageVisible: false, // Example of hidden image
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
          imageVisible: true, // Default for older templates
          ...t,
        }));
        setTemplates(parsedTemplates);
      } else {
        setTemplates(initialTemplates);
        localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(initialTemplates));
      }
    } catch (error) {
      console.error("Failed to access localStorage for templates:", error);
      setTemplates(initialTemplates); 
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

  const addTemplate = useCallback((templateData: TemplateWithoutId): Template => {
    const newId = Date.now().toString();
    const newSlug = generateSlug(templateData.title) || newId;
    const newTemplate: Template = {
      imageVisible: true, // Default for new templates
      ...templateData,
      id: newId,
      slug: `${newSlug}-${newId}`, 
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setTemplates(prevTemplates => {
      const updated = [...prevTemplates, newTemplate];
      saveTemplatesToLocalStorage(updated);
      return updated;
    });
    return newTemplate;
  }, [saveTemplatesToLocalStorage]);

  const getTemplateBySlug = useCallback((slug: string): Template | undefined => {
    return templates.find(template => template.slug === slug);
  }, [templates]);

  const updateTemplate = useCallback((updatedTemplate: Template) => {
    const newSlug = generateSlug(updatedTemplate.title) || updatedTemplate.id;
    const templateWithPotentiallyNewLabel: Template = {
        ...updatedTemplate,
        slug: `${newSlug}-${updatedTemplate.id}`, 
        updatedAt: new Date().toISOString()
    };

    setTemplates(prevTemplates => {
      const updated = prevTemplates.map(t => t.id === templateWithPotentiallyNewLabel.id ? templateWithPotentiallyNewLabel : t);
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
    // Not including imageUrl or imageVisible in AI context for now as it's less relevant for text-based Q&A
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
