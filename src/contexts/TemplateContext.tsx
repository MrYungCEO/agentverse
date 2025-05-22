
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

// Helper to convert Firestore doc data to Template type
const mapDocToTemplate = (docSnapshot: any): Template => {
  const data = docSnapshot.data();
  const id = docSnapshot.id;
  const title = data.title || 'Untitled Template';

  return {
    title: title,
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
    id: id,
    slug: data.slug || generateSlug(title, id), // Ensure slug is generated if missing
    createdAt: (data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt || Date.now())).toISOString(),
    updatedAt: (data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt || Date.now())).toISOString(),
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
      const q = query(templatesCollectionRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      console.log(`TemplateContext: Fetched ${querySnapshot.docs.length} documents from Firestore collection '${TEMPLATES_COLLECTION}'.`);
      
      const fetchedTemplates = querySnapshot.docs.map(doc => {
        try {
          return mapDocToTemplate(doc);
        } catch (mapError) {
          console.error(`TemplateContext: Error mapping document with ID ${doc.id}:`, mapError, doc.data());
          return null; // Skip this document if mapping fails
        }
      }).filter(template => template !== null) as Template[]; // Filter out any nulls from mapping errors

      console.log("TemplateContext: Mapped templates:", JSON.parse(JSON.stringify(fetchedTemplates))); // Deep copy for logging
      setTemplates(fetchedTemplates);
    } catch (error) {
      console.error("TemplateContext: Detailed error fetching templates from Firestore:", error);
    } finally {
      setLoading(false);
      console.log("TemplateContext: Finished fetching templates. Loading set to false.");
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);


  const addTemplate = useCallback(async (templateData: TemplateWithoutId): Promise<Template> => {
    const newTemplateDataForFirestore = {
      ...templateData,
      title: templateData.title || 'Untitled Template',
      summary: templateData.summary || '',
      type: templateData.type || (templateData.isCollection ? 'collection' : 'unknown'),
      isCollection: templateData.isCollection || false,
      imageVisible: templateData.imageVisible ?? true,
      videoUrl: templateData.videoUrl || null, 
      iconName: templateData.iconName || null,
      additionalFiles: templateData.additionalFiles || [],
      useCases: Array.isArray(templateData.useCases) ? templateData.useCases : [],
      setupGuide: templateData.setupGuide || '',
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      slug: '', // Placeholder, will be updated after doc creation
    };
    
    let docRef;
    try {
      docRef = await addDoc(collection(firestore, TEMPLATES_COLLECTION), newTemplateDataForFirestore);
      const uniqueSlug = generateSlug(newTemplateDataForFirestore.title, docRef.id);
      await updateDoc(doc(firestore, TEMPLATES_COLLECTION, docRef.id), { slug: uniqueSlug });
      
      console.log("TemplateContext: Template added, re-fetching all templates.");
      await fetchTemplates(); 

      const savedDocSnapshot = await getDoc(docRef);
      if (savedDocSnapshot.exists()) {
        return mapDocToTemplate(savedDocSnapshot);
      } else {
        console.error("TemplateContext: Failed to retrieve newly added template from Firestore after saving.");
        throw new Error("Template saved but could not be retrieved for confirmation.");
      }
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
    // const templatesToPotentiallyAdd: Omit<Template, 'id' | 'createdAt' | 'updatedAt' | 'slug'>[] = []; // Not used

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
        
        const docRef = doc(collection(firestore, TEMPLATES_COLLECTION)); 
        const uniqueSlug = generateSlug(aiGeneratedMetadata.title, docRef.id);
        const now = Timestamp.now();

        const templateToSave: Omit<Template, 'id' | 'createdAt' | 'updatedAt'> & {createdAt: Timestamp, updatedAt: Timestamp} = {
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
          createdAt: now, 
          updatedAt: now, 
          slug: uniqueSlug,
        };

        batch.set(docRef, templateToSave);
        results.newlyCreatedTemplates.push({ ...templateToSave, id: docRef.id, createdAt: now.toDate().toISOString(), updatedAt: now.toDate().toISOString() });
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
          const now = Timestamp.now();

          const templateToSave: Omit<Template, 'id' | 'createdAt' | 'updatedAt'> & {createdAt: Timestamp, updatedAt: Timestamp} = {
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
            createdAt: now, 
            updatedAt: now, 
            slug: uniqueSlug,
          };
          
          batch.set(docRef, templateToSave);
          results.newlyCreatedTemplates.push({ ...templateToSave, id: docRef.id, createdAt: now.toDate().toISOString(), updatedAt: now.toDate().toISOString() });
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
    
    if (results.successCount > 0 || itemsToProcess.length > 0) {
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
      const uniqueSlug = generateSlug(updatedTemplateData.title, updatedTemplateData.id);
      
      const dataToUpdateForFirestore = {
        ...updatedTemplateData,
        slug: uniqueSlug,
        updatedAt: Timestamp.now(),
        // Ensure createdAt is not overwritten if it exists and is already a Timestamp
        // or convert from ISO string if that's what updatedTemplateData.createdAt holds
        createdAt: updatedTemplateData.createdAt && !(updatedTemplateData.createdAt instanceof Timestamp) 
                    ? Timestamp.fromDate(new Date(updatedTemplateData.createdAt)) 
                    : updatedTemplateData.createdAt, 
      };
      // Remove id from the data object itself before sending to Firestore
      const { id, ...finalDataToUpdate } = dataToUpdateForFirestore; 

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

    
