
export interface Template {
  id: string;
  title: string;
  summary: string;
  templateData?: string; // Raw JSON data from n8n or Make.com
  setupGuide: string; // Markdown or steps
  useCases: string[];
  type: 'n8n' | 'make.com' | 'unknown';
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  slug: string;
  imageUrl?: string; // Data URI or URL for the template image
  imageVisible?: boolean; // Controls visibility of the image
  videoUrl?: string; // Optional URL for a video (e.g., YouTube)
}

export type TemplateWithoutId = Omit<Template, 'id' | 'createdAt' | 'updatedAt' | 'slug'>;

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}
