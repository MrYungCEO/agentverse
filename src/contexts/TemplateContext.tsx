
"use client";

import type { Template, TemplateWithoutId, WorkflowFile, AdditionalFile } from '@/types';
import type { ReactNode } from 'react';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { generateTemplateMetadata, type GenerateTemplateMetadataOutput } from '@/ai/flows/template-generation';
import { firestore } from '@/lib/firebase'; // Import Firestore instance
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  Timestamp,
  query,
  orderBy,
  writeBatch
} from 'firebase/firestore';

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
  addTemplate: (templateData: TemplateWithoutId) => Promise<Template>; // Made async
  bulkAddTemplates: (itemsToProcess: Array<BulkTemplateUploadItem | WorkflowFile>, mode: 'bulk' | 'merge', overallBatchContext?: string) => Promise<BulkAddResult>;
  getTemplateBySlug: (slug: string) => Template | undefined;
  updateTemplate: (updatedTemplate: Template) => Promise<void>; // Made async
  deleteTemplate: (templateId: string) => Promise<void>; // Made async
  getTemplatesAsContextString: () => string;
  loading: boolean;
  searchTemplates: (searchTerm: string, typeFilter: 'all' | 'n8n' | 'make.com' | 'collection') => Template[];
}

const TemplateContext = createContext<TemplateContextType | undefined>(undefined);
const TEMPLATES_COLLECTION = 'templates';

const generateSlug = (title: string, idSuffix: string = '') => {
  if (!title) return Date.now().toString() + idSuffix;
  return title
    .toLowerCase()
    .replace(/\s+/g, '-') 
    .replace(/[^\w-]+/g, '') 
    .replace(/--+/g, '-') 
    .replace(/^-+/, '') 
    .replace(/-+$/, '')
    + (idSuffix ? `-${idSuffix}` : ''); 
};

// Helper to convert Firestore doc data to Template type
const mapDocToTemplate = (docSnapshot: any): Template => {
  const data = docSnapshot.data();
  return {
    ...data,
    id: docSnapshot.id,
    createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
    updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
    imageVisible: data.imageVisible ?? true,
    videoUrl: data.videoUrl || undefined,
    isCollection: data.isCollection || false,
    type: data.type || (data.isCollection ? 'collection' : 'unknown'),
    iconName: data.iconName || undefined,
    additionalFiles: data.additionalFiles || [],
  } as Template;
};


export const TemplateProvider = ({ children }: { children: ReactNode }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const templatesCollectionRef = collection(firestore, TEMPLATES_COLLECTION);
      const q = query(templatesCollectionRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const fetchedTemplates = querySnapshot.docs.map(mapDocToTemplate);
      setTemplates(fetchedTemplates);
    } catch (error) {
      console.error("Error fetching templates from Firestore:", error);
      // Keep existing templates or set to empty on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);


  const addTemplate = useCallback(async (templateData: TemplateWithoutId): Promise<Template> => {
    setLoading(true);
    try {
      const baseSlug = generateSlug(templateData.title);
      // Firestore ID will be generated, so suffix for slug might not be needed if Firestore ID is part of slug
      // For now, let's keep slug simple based on title, Firestore handles uniqueness with document ID

      const newTemplateDataForFirestore = {
        ...templateData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        // Slug will be set after we get the ID, or based on title
        slug: '', // Placeholder, will be updated
      };
      
      const docRef = await addDoc(collection(firestore, TEMPLATES_COLLECTION), newTemplateDataForFirestore);
      
      const uniqueSlug = generateSlug(templateData.title, docRef.id.substring(0, 6));
      await updateDoc(doc(firestore, TEMPLATES_COLLECTION, docRef.id), { slug: uniqueSlug });
      
      const newTemplate: Template = {
        ...templateData,
        id: docRef.id,
        slug: uniqueSlug,
        createdAt: (newTemplateDataForFirestore.createdAt as Timestamp).toDate().toISOString(),
        updatedAt: (newTemplateDataForFirestore.updatedAt as Timestamp).toDate().toISOString(),
        imageVisible: templateData.imageVisible ?? true,
        videoUrl: templateData.videoUrl || undefined,
        isCollection: templateData.isCollection || false,
        type: templateData.type || (templateData.isCollection ? 'collection' : 'unknown'),
        iconName: templateData.iconName || undefined,
        additionalFiles: templateData.additionalFiles || [],
      };

      setTemplates(prevTemplates => [newTemplate, ...prevTemplates]); // Add to beginning for newest first
      return newTemplate;
    } catch (error) {
      console.error("Error adding template to Firestore:", error);
      throw error; // Re-throw for the calling component to handle
    } finally {
      setLoading(false);
    }
  }, []);


  const bulkAddTemplates = useCallback(async (
    itemsToProcess: Array<BulkTemplateUploadItem | WorkflowFile>, 
    mode: 'bulk' | 'merge', 
    overallBatchContext?: string
  ): Promise<BulkAddResult> => {
    setLoading(true);
    const results: BulkAddResult = { successCount: 0, errorCount: 0, errors: [], newlyCreatedTemplates: [] };
    const batch = writeBatch(firestore);
    const templatesToAddLocally: Template[] = [];

    if (mode === 'merge') {
      const workflowFiles = itemsToProcess as WorkflowFile[];
      if (workflowFiles.length === 0) {
        results.errors.push({ index: 0, message: "No files provided for merge operation." });
        results.errorCount = 1;
        setLoading(false);
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
        
        const docRef = doc(collection(firestore, TEMPLATES_COLLECTION)); // Prepare new doc ref
        const uniqueSlug = generateSlug(aiGeneratedMetadata.title, docRef.id.substring(0, 6));

        const templateToSave: Omit<Template, 'id'> = {
          title: aiGeneratedMetadata.title,
          summary: aiGeneratedMetadata.summary,
          setupGuide: aiGeneratedMetadata.setupGuide,
          useCases: aiGeneratedMetadata.useCases,
          templateData: templateDataForStorage, 
          isCollection: true,
          type: 'collection',
          iconName: aiGeneratedMetadata.iconName || undefined,
          imageUrl: (itemsToProcess[0] as BulkTemplateUploadItem)?.imageUrl, // Attempt to get from first item
          imageVisible: (itemsToProcess[0] as BulkTemplateUploadItem)?.imageVisible ?? true,
          videoUrl: (itemsToProcess[0] as BulkTemplateUploadItem)?.videoUrl || undefined,
          additionalFiles: [],
          createdAt: Timestamp.now().toDate().toISOString(), // Temp string for local state, Firestore handles Timestamp
          updatedAt: Timestamp.now().toDate().toISOString(), // Temp string for local state
          slug: uniqueSlug,
        };

        batch.set(docRef, { ...templateToSave, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
        
        templatesToAddLocally.push({ ...templateToSave, id: docRef.id });
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

          if (!aiGeneratedMetadata.title || aiGeneratedMetadata.title.trim() === "") {
            throw new Error('AI failed to generate a non-empty title for the template.');
          }

          const docRef = doc(collection(firestore, TEMPLATES_COLLECTION)); // Prepare new doc ref
          const uniqueSlug = generateSlug(aiGeneratedMetadata.title, docRef.id.substring(0, 6));

          const templateToSave: Omit<Template, 'id'> = {
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
            additionalFiles: [], // additionalFiles for individual items in bulk not handled in this pass
            createdAt: Timestamp.now().toDate().toISOString(), // Placeholder for local
            updatedAt: Timestamp.now().toDate().toISOString(), // Placeholder for local
            slug: uniqueSlug,
          };
          
          batch.set(docRef, { ...templateToSave, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
          templatesToAddLocally.push({ ...templateToSave, id: docRef.id });
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
    
    try {
      await batch.commit();
      if (templatesToAddLocally.length > 0) {
        setTemplates(prevTemplates => [...templatesToAddLocally.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) , ...prevTemplates]);
        results.newlyCreatedTemplates = templatesToAddLocally;
      }
    } catch (error) {
        console.error("Error committing batch to Firestore:", error);
        results.errorCount += templatesToAddLocally.length; // All batched items failed if commit fails
        results.successCount = 0;
        results.errors.push({ index: -1, itemIdentifier: "Batch Commit", message: "Failed to save templates to database."})
        results.newlyCreatedTemplates = []; // Clear if batch failed
    } finally {
        setLoading(false);
    }
    return results;
  }, []);

  const getTemplateBySlug = useCallback((slug: string): Template | undefined => {
    return templates.find(template => template.slug === slug);
  }, [templates]);

  const updateTemplate = useCallback(async (updatedTemplateData: Template) => {
    setLoading(true);
    try {
      const templateRef = doc(firestore, TEMPLATES_COLLECTION, updatedTemplateData.id);
      const baseSlug = generateSlug(updatedTemplateData.title);
      let uniqueSlug = `${baseSlug}-${updatedTemplateData.id.substring(0, 6)}`;
      
      // Basic check for slug uniqueness (excluding self) can be done against local state if needed,
      // but ideally Firestore rules or backend logic would ensure true uniqueness if it's critical.
      // For now, we rely on the ID-based suffix.

      const dataToUpdate = {
        ...updatedTemplateData,
        slug: uniqueSlug,
        updatedAt: Timestamp.now(),
      };
      // Remove id from data to update as it's the document key
      const { id, ...finalDataToUpdate } = dataToUpdate; 

      await updateDoc(templateRef, finalDataToUpdate);
      setTemplates(prevTemplates => 
        prevTemplates.map(t => t.id === updatedTemplateData.id ? { ...updatedTemplateData, slug: uniqueSlug, updatedAt: (dataToUpdate.updatedAt as Timestamp).toDate().toISOString() } : t)
      );
    } catch (error) {
      console.error("Error updating template in Firestore:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteTemplate = useCallback(async (templateId: string) => {
    setLoading(true);
    try {
      const templateRef = doc(firestore, TEMPLATES_COLLECTION, templateId);
      await deleteDoc(templateRef);
      setTemplates(prevTemplates => prevTemplates.filter(t => t.id !== templateId));
    } catch (error) {
      console.error("Error deleting template from Firestore:", error);
      throw error;
    } finally {
      setLoading(false);
    }
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


    