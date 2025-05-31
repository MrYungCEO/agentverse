
'use server';
/**
 * @fileOverview An AI assistant chatbot that answers user questions about available templates.
 *
 * - aiAssistantChatbot - A function that handles the chatbot interaction.
 * - AiAssistantChatbotInput - The input type for the aiAssistantChatbot function.
 * - AiAssistantChatbotOutput - The return type for the aiAssistantChatbot function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiAssistantChatbotInputSchema = z.object({
  question: z.string().describe('The user question about the available templates.'),
  templateLibraryContext: z.string().describe('The context of the full template library.'),
  chatHistory: z.string().optional().describe('A summary of the recent conversation history preceding the current user question, with each turn on a new line. Example: "User: Hello\\nAssistant: Hi there!"'),
});
export type AiAssistantChatbotInput = z.infer<typeof AiAssistantChatbotInputSchema>;

const AiAssistantChatbotOutputSchema = z.object({
  answer: z.string().describe('The answer to the user question, based on the template library context and conversation history.'),
});
export type AiAssistantChatbotOutput = z.infer<typeof AiAssistantChatbotOutputSchema>;

export async function aiAssistantChatbot(input: AiAssistantChatbotInput): Promise<AiAssistantChatbotOutput> {
  return aiAssistantChatbotFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiAssistantChatbotPrompt',
  input: {schema: AiAssistantChatbotInputSchema},
  output: {schema: AiAssistantChatbotOutputSchema},
  prompt: `You are a helpful AI assistant that answers user questions about available automation templates.
You have access to the full template library context, which contains information about all available templates.
Your primary goal is to answer questions based on the template library.

IMPORTANT FORMATTING INSTRUCTIONS:
- When providing lists or steps, ensure EACH item or step starts on a NEW LINE.
- For numbered lists, use the format:
  1. First item.
  2. Second item.
- For bulleted lists, use the format:
  - First bullet point.
  - Second bullet point.
- Use markdown for bold (\`**text**\`) and italics (\`*text*\`).

{{#if chatHistory}}
For context, here is the recent conversation history:
{{{chatHistory}}}
---
Use the conversation history to understand follow-up questions or references to previous parts of the discussion.
{{/if}}

Based on the template library context and the conversation history (if any), answer the following current user question accurately and concisely, adhering to the formatting instructions above.

Template Library Context:
{{templateLibraryContext}}

User Question:
{{question}}

Answer:
  `,
});

const aiAssistantChatbotFlow = ai.defineFlow(
  {
    name: 'aiAssistantChatbotFlow',
    inputSchema: AiAssistantChatbotInputSchema,
    outputSchema: AiAssistantChatbotOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

