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
});
export type AiAssistantChatbotInput = z.infer<typeof AiAssistantChatbotInputSchema>;

const AiAssistantChatbotOutputSchema = z.object({
  answer: z.string().describe('The answer to the user question, based on the template library context.'),
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
  Use this information to answer the user's question accurately and concisely.

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
