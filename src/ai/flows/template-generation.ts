
'use server';

/**
 * @fileOverview A flow for generating template metadata (title, summary, setup guide, use cases, iconName) from an n8n or Make.com template.
 *
 * - generateTemplateMetadata - A function that handles the template metadata generation process.
 * - GenerateTemplateMetadataInput - The input type for the generateTemplateMetadata function.
 * - GenerateTemplateMetadataOutput - The return type for the generateTemplateMetadata function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateTemplateMetadataInputSchema = z.object({
  templateData: z
    .string()
    .describe('The n8n or Make.com template data in JSON format.'),
  additionalContext: z.string().optional().describe('Optional additional context or instructions for the AI to consider during generation.'),
});
export type GenerateTemplateMetadataInput = z.infer<
  typeof GenerateTemplateMetadataInputSchema
>;

const GenerateTemplateMetadataOutputSchema = z.object({
  title: z.string().describe('The generated title for the template.'),
  summary: z.string().describe('The generated summary for the template.'),
  setupGuide: z
    .string()
    .describe('The generated setup guide for the template (steps or markdown).'),
  useCases: z
    .array(z.string())
    .describe('The generated list of real-world use cases for the template.'),
  keyFeatures: z
    .array(z.string())
    .describe('A list of key features of the template.'),
  iconName: z.string().optional().describe('A relevant Lucide icon name (e.g., Zap, Mail, BarChart, Database, Cloud, Users, Settings, FileText, Rocket, Lightbulb, Sparkles) for the template, or an empty string if no specific icon is suitable.'),
});
export type GenerateTemplateMetadataOutput = z.infer<
  typeof GenerateTemplateMetadataOutputSchema
>;

export async function generateTemplateMetadata(
  input: GenerateTemplateMetadataInput
): Promise<GenerateTemplateMetadataOutput> {
  return generateTemplateMetadataFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateTemplateMetadataPrompt',
  input: {schema: GenerateTemplateMetadataInputSchema},
  output: {schema: GenerateTemplateMetadataOutputSchema},
  prompt: `You are an AI assistant helping an admin generate metadata for a template.

Based on the provided template data, which can be either JSON (for n8n or Make.com workflows) or HTML, generate a title, summary, setup guide, use cases, and suggest a relevant Lucide icon name.
If the input is HTML, extract relevant information from the HTML structure and content.
The icon name should be a single PascalCase string from the lucide-react library (e.g., 'Zap', 'Mail', 'BarChart', 'Database', 'Cloud', 'Users', 'Settings', 'FileText', 'Rocket', 'Lightbulb', 'Sparkles'). If no specific icon seems highly relevant, provide an empty string for the iconName.
{{#if additionalContext}}
Consider the following additional context provided by the user:
{{additionalContext}}
{{/if}}

Template Data:
{{templateData}}

Output a JSON object with the following keys:
- title: The generated title for the template.
- summary: The generated summary for the template.
- setupGuide: The generated setup guide for the template (steps or markdown).
- useCases: A list of real-world use cases for the template.
- keyFeatures: A list of key features of the template.
- iconName: The suggested Lucide icon name (e.g., "Mail", "BarChart", or "" if none).
  `,config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_ONLY_HIGH',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_LOW_AND_ABOVE',
      },
    ],
  },
});

const generateTemplateMetadataFlow = ai.defineFlow(
  {
    name: 'generateTemplateMetadataFlow',
    inputSchema: GenerateTemplateMetadataInputSchema,
    outputSchema: GenerateTemplateMetadataOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
