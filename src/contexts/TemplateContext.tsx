
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
  // orderBy, // Temporarily removed for debugging
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
const TEMPLATES_COLLECTION = 'templates';

const generateSlug = (title: string, idSuffix: string = '') => {
  if (!title) return Date.now().toString() + (idSuffix ? `-${idSuffix.substring(0,6)}` : '');
  return title
    .toLowerCase()
    .replace(/\s+/g, '-') 
    .replace(/[^\w-]+/g, '') 
    .replace(/--+/g, '-') 
    .replace(/^-+/, '') 
    .replace(/-+$/, '')
    + (idSuffix ? `-${idSuffix.substring(0,6)}` : ''); 
};

const mapDocToTemplate = (docSnapshot: any): Template => {
  const data = docSnapshot.data();
  const id = docSnapshot.id;
  const title = data.title || 'Untitled Template';

  // Helper to safely convert Firestore Timestamp or other date representations to ISO string
  const safeDateToISOString = (dateValue: any, fallback: Date = new Date()): string => {
    if (dateValue instanceof Timestamp) {
      return dateValue.toDate().toISOString();
    }
    if (dateValue && typeof dateValue.seconds === 'number' && typeof dateValue.nanoseconds === 'number') {
      return new Timestamp(dateValue.seconds, dateValue.nanoseconds).toDate().toISOString();
    }
    if (typeof dateValue === 'string' || typeof dateValue === 'number') {
      const parsedDate = new Date(dateValue);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString();
      }
    }
    return fallback.toISOString();
  };
  
  const now = new Date(); // Fallback for missing dates

  return {
    title: title,
    summary: data.summary || 'No summary available.',
    templateData: data.templateData || null,
    isCollection: data.isCollection || false,
    additionalFiles: Array.isArray(data.additionalFiles) ? data.additionalFiles : [],
    setupGuide: data.setupGuide || 'No setup guide available.',
    useCases: Array.isArray(data.useCases) ? data.useCases : [],
    type: data.type || (data.isCollection ? 'collection' : 'unknown'),
    imageUrl: data.imageUrl || null,
    imageVisible: data.imageVisible ?? true, 
    videoUrl: data.videoUrl || null,
    iconName: data.iconName || null,
    id: id,
    slug: data.slug || generateSlug(title, id),
    createdAt: safeDateToISOString(data.createdAt, now),
    updatedAt: safeDateToISOString(data.updatedAt, now),
  } as Template;
};


export const TemplateProvider = ({ children }: { children: ReactNode }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    console.log("TemplateContext: Starting to fetch templates from Firestore...");
    setLoading(true);
    try {
      const templatesCollectionRef = collection(firestore, TEMPLATES_COLLECTION);
      // Temporarily removed orderBy to simplify the query for debugging
      const q = query(templatesCollectionRef /*, orderBy("createdAt", "desc")*/);
      const querySnapshot = await getDocs(q);
      console.log(`TemplateContext: Fetched ${querySnapshot.docs.length} documents from Firestore collection '${TEMPLATES_COLLECTION}'.`);
      
      const fetchedTemplates = querySnapshot.docs.map(doc => {
        try {
          return mapDocToTemplate(doc);
        } catch (mapError) {
          console.error(`TemplateContext: Error mapping document with ID ${doc.id}:`, mapError, doc.data());
          return null; 
        }
      }).filter(template => template !== null) as Template[]; 

      console.log("TemplateContext: Mapped templates:", JSON.parse(JSON.stringify(fetchedTemplates)));
      setTemplates(fetchedTemplates);
    } catch (error) {
      console.error("TemplateContext: Detailed error fetching templates from Firestore:", error);
      setTemplates([]); // Set to empty array on error to avoid stale data
    } finally {
      setLoading(false);
      console.log("TemplateContext: Finished fetching templates. Loading set to false.");
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const addTemplate = useCallback(async (templateData: TemplateWithoutId): Promise<Template> => {
    const now = Timestamp.now();
    const title = templateData.title || 'Untitled Template';
    const newTemplateDataForFirestore = {
      title: title,
      summary: templateData.summary || '',
      templateData: templateData.templateData || null, 
      isCollection: templateData.isCollection || false,
      additionalFiles: Array.isArray(templateData.additionalFiles) ? templateData.additionalFiles : [],
      setupGuide: templateData.setupGuide || '',
      useCases: Array.isArray(templateData.useCases) ? templateData.useCases : [],
      type: templateData.type || (templateData.isCollection ? 'collection' : 'unknown'),
      imageUrl: templateData.imageUrl || null, 
      imageVisible: templateData.imageVisible ?? true,
      videoUrl: templateData.videoUrl || null, 
      iconName: templateData.iconName || null, 
      createdAt: now,
      updatedAt: now,
      slug: '', // Placeholder, will be updated after doc creation
    };
    
    let docRef;
    try {
      docRef = await addDoc(collection(firestore, TEMPLATES_COLLECTION), newTemplateDataForFirestore);
      const uniqueSlug = generateSlug(title, docRef.id);
      await updateDoc(doc(firestore, TEMPLATES_COLLECTION, docRef.id), { slug: uniqueSlug });
      
      console.log("TemplateContext: Template added. Re-fetching all templates.");
      await fetchTemplates(); 

      const savedDocSnapshot = await getDoc(docRef);
      if (!savedDocSnapshot.exists()) {
        console.error("TemplateContext: Failed to retrieve newly added template from Firestore after saving.");
        throw new Error("Template saved but could not be retrieved for confirmation.");
      }
      return mapDocToTemplate(savedDocSnapshot);

    } catch (error) {
      console.error("TemplateContext: Error adding template to Firestore:", error);
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
    const now = Timestamp.now();

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

        const title = aiGeneratedMetadata.title || 'Untitled Merged Collection';
        if (title.trim() === "") {
          throw new Error('AI failed to generate a non-empty title for the merged collection.');
        }
        
        const docRef = doc(collection(firestore, TEMPLATES_COLLECTION)); 
        const uniqueSlug = generateSlug(title, docRef.id);
        
        const templateToSave = {
          title: title,
          summary: aiGeneratedMetadata.summary || '',
          setupGuide: aiGeneratedMetadata.setupGuide || '',
          useCases: Array.isArray(aiGeneratedMetadata.useCases) ? aiGeneratedMetadata.useCases : [],
          templateData: templateDataForStorage, 
          isCollection: true,
          type: 'collection' as 'collection',
          iconName: aiGeneratedMetadata.iconName || null,
          imageUrl: (itemsToProcess[0] as BulkTemplateUploadItem)?.imageUrl || null, 
          imageVisible: (itemsToProcess[0] as BulkTemplateUploadItem)?.imageVisible ?? true,
          videoUrl: (itemsToProcess[0] as BulkTemplateUploadItem)?.videoUrl || null,
          additionalFiles: [],
          createdAt: now, 
          updatedAt: now, 
          slug: uniqueSlug,
        };

        batch.set(docRef, templateToSave);
        results.newlyCreatedTemplates.push({ 
            ...templateToSave, 
            id: docRef.id, 
            createdAt: now.toDate().toISOString(), 
            updatedAt: now.toDate().toISOString() 
        });
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

          const docRef = doc(collection(firestore, TEMPLATES_COLLECTION)); 
          const uniqueSlug = generateSlug(title, docRef.id);
          
          const templateToSave = {
            title: title,
            summary: aiGeneratedMetadata.summary || '',
            setupGuide: aiGeneratedMetadata.setupGuide || '',
            useCases: Array.isArray(aiGeneratedMetadata.useCases) ? aiGeneratedMetadata.useCases : [],
            templateData: item.workflowData, 
            isCollection: false,
            type: item.type || ('unknown' as 'unknown'),
            imageUrl: item.imageUrl || null,
            imageVisible: item.imageVisible ?? true,
            videoUrl: item.videoUrl || null,
            iconName: aiGeneratedMetadata.iconName || item.iconName || null, 
            additionalFiles: [], 
            createdAt: now, 
            updatedAt: now, 
            slug: uniqueSlug,
          };
          
          batch.set(docRef, templateToSave);
          results.newlyCreatedTemplates.push({ 
              ...templateToSave, 
              id: docRef.id, 
              createdAt: now.toDate().toISOString(), 
              updatedAt: now.toDate().toISOString() 
          });
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
    
    if (results.successCount > 0) { 
        try {
          await batch.commit();
          console.log("TemplateContext: Bulk add batch committed successfully.");
        } catch (error) {
            console.error("TemplateContext: Error committing bulk add batch to Firestore:", error);
            results.errorCount += results.successCount; 
            results.successCount = 0;
            results.errors.push({ index: -1, itemIdentifier: "Batch Commit", message: "Failed to save templates to database."})
            results.newlyCreatedTemplates = []; 
        }
    }
    
    if (results.successCount > 0 || (itemsToProcess.length > 0 && results.errorCount > 0) ) { 
        console.log("TemplateContext: Bulk operation finished, re-fetching all templates.");
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
      const title = updatedTemplateData.title || 'Untitled Template';
      const uniqueSlug = generateSlug(title, updatedTemplateData.id);
      
      const dataToUpdateForFirestore = {
        title: title,
        summary: updatedTemplateData.summary || '',
        templateData: updatedTemplateData.templateData || null,
        isCollection: updatedTemplateData.isCollection || false,
        additionalFiles: Array.isArray(updatedTemplateData.additionalFiles) ? updatedTemplateData.additionalFiles : [],
        setupGuide: updatedTemplateData.setupGuide || '',
        useCases: Array.isArray(updatedTemplateData.useCases) ? updatedTemplateData.useCases : [],
        type: updatedTemplateData.type || (updatedTemplateData.isCollection ? 'collection' : 'unknown'),
        imageUrl: updatedTemplateData.imageUrl || null,
        imageVisible: updatedTemplateData.imageVisible ?? true,
        videoUrl: updatedTemplateData.videoUrl || null,
        iconName: updatedTemplateData.iconName || null,
        slug: uniqueSlug,
        updatedAt: Timestamp.now(),
        // Ensure createdAt is a Firestore Timestamp if it's coming from an ISO string
        createdAt: updatedTemplateData.createdAt instanceof Timestamp 
                    ? updatedTemplateData.createdAt 
                    : Timestamp.fromDate(new Date(updatedTemplateData.createdAt)),
      };
      
      const { id, ...finalDataToUpdate } = dataToUpdateForFirestore as any; 
      await updateDoc(templateRef, finalDataToUpdate);
      console.log("TemplateContext: Template updated, re-fetching all templates.");
      await fetchTemplates();
    } catch (error) {
      console.error("TemplateContext: Error updating template in Firestore:", error);
      throw error;
    }
  }, [fetchTemplates]);

  const deleteTemplate = useCallback(async (templateId: string) => {
    try {
      const templateRef = doc(firestore, TEMPLATES_COLLECTION, templateId);
      await deleteDoc(templateRef);
      console.log("TemplateContext: Template deleted, re-fetching all templates.");
      await fetchTemplates();
    } catch (error) {
      console.error("TemplateContext: Error deleting template from Firestore:", error);
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


