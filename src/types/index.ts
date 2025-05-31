
export interface WorkflowFile {
  filename: string;
  content: string; // The raw JSON string of the workflow
}

export interface AdditionalFile {
  filename: string;
  content: string; // File content, could be text or data URI for binary files
}

export interface Template {
  id: string;
  title: string;
  summary: string;
  templateData?: string; // For single: raw workflow JSON. For collection: JSON.stringify(WorkflowFile[])
  isCollection?: boolean; // True if this template represents a merged collection
  additionalFiles?: AdditionalFile[]; // Array of additional files

  setupGuide: string; // Markdown or steps
  useCases: string[];
  keyFeatures: string[];
  type: 'n8n' | 'make.com' | 'unknown' | 'collection'; // Added 'collection'
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  slug: string;
  imageUrl?: string; // Data URI or URL for the template image
  imageVisible?: boolean; // Controls visibility of the image
  videoUrl?: string; // Optional URL for a video (e.g., YouTube)
  iconName?: string; // Optional Lucide icon name
  price: string;
  paymentLink?: string | null;
}

export type TemplateWithoutId = Omit<Template, 'id' | 'createdAt' | 'updatedAt' | 'slug' | 'price' | 'paymentLink'>;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}
