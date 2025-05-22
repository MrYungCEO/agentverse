
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
  writeBatch,
  getDoc
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
  newlyCreatedTemplates: Template[]; // These are based on pre-save data, mainly for dashboard ZIP download
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
    + (idSuffix ? `-${idSuffix.substring(0,6)}` : ''); 
};

// Helper to convert Firestore doc data to Template type
const mapDocToTemplate = (docSnapshot: any): Template => {
  const data = docSnapshot.data();
  return {
    title: data.title || 'Untitled Template',
    summary: data.summary || 'No summary available.',
    templateData: data.templateData || '',
    isCollection: data.isCollection || false,
    additionalFiles: data.additionalFiles || [],
    setupGuide: data.setupGuide || 'No setup guide available.',
    useCases: Array.isArray(data.useCases) ? data.useCases : [],
    type: data.type || (data.isCollection ? 'collection' : 'unknown'),
    imageUrl: data.imageUrl || undefined,
    imageVisible: data.imageVisible ?? true, 
    videoUrl: data.videoUrl || undefined,
    iconName: data.iconName || undefined,
    id: docSnapshot.id,
    slug: data.slug || generateSlug(data.title || 'untitled', docSnapshot.id),
    createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
    updatedAt: (data.updatedAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);


  const addTemplate = useCallback(async (templateData: TemplateWithoutId): Promise<Template> => {
    const newTemplateDataForFirestore = {
      ...templateData,
      // Ensure defaults for optional fields if not provided by templateData
      title: templateData.title || 'Untitled Template',
      summary: templateData.summary || '',
      type: templateData.type || (templateData.isCollection ? 'collection' : 'unknown'),
      isCollection: templateData.isCollection || false,
      imageVisible: templateData.imageVisible ?? true,
      videoUrl: templateData.videoUrl || null, // Store null if empty
      iconName: templateData.iconName || null, // Store null if empty
      additionalFiles: templateData.additionalFiles || [],
      useCases: Array.isArray(templateData.useCases) ? templateData.useCases : [],
      setupGuide: templateData.setupGuide || '',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      slug: '', // Placeholder, will be updated
    };
    
    let docRef;
    try {
      docRef = await addDoc(collection(firestore, TEMPLATES_COLLECTION), newTemplateDataForFirestore);
      const uniqueSlug = generateSlug(newTemplateDataForFirestore.title, docRef.id);
      await updateDoc(doc(firestore, TEMPLATES_COLLECTION, docRef.id), { slug: uniqueSlug });
      
      await fetchTemplates(); // Re-fetch all templates

      const savedDoc = await getDoc(docRef); // Get the newly added doc to return it
      if (savedDoc.exists()) {
        return mapDocToTemplate(savedDoc);
      } else {
        console.error("Failed to retrieve newly added template from Firestore after saving.");
        // Fallback or throw more specific error
        throw new Error("Template saved but could not be retrieved for confirmation.");
      }
    } catch (error) {
      console.error("Error adding template to Firestore:", error);
      throw error; 
    }
  }, [fetchTemplates]);


  const bulkAddTemplates = useCallback(async (
    itemsToProcess: Array<BulkTemplateUploadItem | WorkflowFile>, 
    mode: 'bulk' | 'merge', 
    overallBatchContext?: string
  ): Promise<BulkAddResult> => {
    const results: BulkAddResult = { successCount: 0, errorCount: 0, errors: [], newlyCreatedTemplates: [] };
    const batch = writeBatch(firestore);
    const templatesToPotentiallyAdd: Omit<Template, 'id' | 'createdAt' | 'updatedAt' | 'slug'>[] = [];

    if (mode === 'merge') {
      const workflowFiles = itemsToProcess as WorkflowFile[];
      if (workflowFiles.length === 0) {
        results.errors.push({ index: 0, message: "No files provided for merge operation." });
        results.errorCount = 1;
        return results; // No setLoading(false) here as fetchTemplates will handle it if called
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
        
        const docRef = doc(collection(firestore, TEMPLATES_COLLECTION)); 
        const uniqueSlug = generateSlug(aiGeneratedMetadata.title, docRef.id);

        const templateToSave: Omit<Template, 'id'> = {
          title: aiGeneratedMetadata.title,
          summary: aiGeneratedMetadata.summary,
          setupGuide: aiGeneratedMetadata.setupGuide,
          useCases: aiGeneratedMetadata.useCases,
          templateData: templateDataForStorage, 
          isCollection: true,
          type: 'collection',
          iconName: aiGeneratedMetadata.iconName || undefined,
          imageUrl: (itemsToProcess[0] as BulkTemplateUploadItem)?.imageUrl, 
          imageVisible: (itemsToProcess[0] as BulkTemplateUploadItem)?.imageVisible ?? true,
          videoUrl: (itemsToProcess[0] as BulkTemplateUploadItem)?.videoUrl || undefined,
          additionalFiles: [],
          // These will be Timestamps in Firestore, string placeholders for local construction if needed for BulkAddResult
          createdAt: Timestamp.now().toDate().toISOString(), 
          updatedAt: Timestamp.now().toDate().toISOString(), 
          slug: uniqueSlug,
        };

        batch.set(docRef, { ...templateToSave, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), slug: uniqueSlug });
        // For BulkAddResult.newlyCreatedTemplates, we use the pre-save constructed object
        results.newlyCreatedTemplates.push({ ...templateToSave, id: docRef.id });
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

          const docRef = doc(collection(firestore, TEMPLATES_COLLECTION)); 
          const uniqueSlug = generateSlug(aiGeneratedMetadata.title, docRef.id);

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
            additionalFiles: [], 
            createdAt: Timestamp.now().toDate().toISOString(), 
            updatedAt: Timestamp.now().toDate().toISOString(), 
            slug: uniqueSlug,
          };
          
          batch.set(docRef, { ...templateToSave, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), slug: uniqueSlug });
          results.newlyCreatedTemplates.push({ ...templateToSave, id: docRef.id });
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
    
    if (results.successCount > 0) { // Only commit if there's something to save
        try {
          await batch.commit();
        } catch (error) {
            console.error("Error committing batch to Firestore:", error);
            // Adjust counts if commit fails for all successful items
            results.errorCount += results.successCount; 
            results.successCount = 0;
            results.errors.push({ index: -1, itemIdentifier: "Batch Commit", message: "Failed to save templates to database."})
            results.newlyCreatedTemplates = []; 
        }
    }
    
    if (results.successCount > 0 || itemsToProcess.length > 0) { // Fetch even if some items failed but some were processed for commit
        await fetchTemplates();
    }
    
    return results;
  }, [fetchTemplates]);

  const getTemplateBySlug = useCallback((slug: string): Template | undefined => {
    return templates.find(template => template.slug === slug);
  }, [templates]);

  const updateTemplate = useCallback(async (updatedTemplateData: Template) => {
    try {
      const templateRef = doc(firestore, TEMPLATES_COLLECTION, updatedTemplateData.id);
      // Generate slug consistently, ensuring suffix for uniqueness
      const uniqueSlug = generateSlug(updatedTemplateData.title, updatedTemplateData.id);
      
      const dataToUpdate = {
        ...updatedTemplateData,
        slug: uniqueSlug,
        updatedAt: Timestamp.now(),
      };
      const { id, createdAt, ...finalDataToUpdate } = dataToUpdate; // createdAt should not be updated here. id is path.

      await updateDoc(templateRef, finalDataToUpdate);
      await fetchTemplates();
    } catch (error) {
      console.error("Error updating template in Firestore:", error);
      throw error;
    }
  }, [fetchTemplates]);

  const deleteTemplate = useCallback(async (templateId: string) => {
    try {
      const templateRef = doc(firestore, TEMPLATES_COLLECTION, templateId);
      await deleteDoc(templateRef);
      await fetchTemplates();
    } catch (error) {
      console.error("Error deleting template from Firestore:", error);
      throw error;
    }
  }, [fetchTemplates]);

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

    