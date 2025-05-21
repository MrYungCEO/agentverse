
"use client";

import type { FormEvent} from 'react';
import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, User, Bot, Loader2 } from 'lucide-react';
import { aiAssistantChatbot } from '@/ai/flows/ai-assistant-chatbot';
import { useTemplates } from '@/contexts/TemplateContext';
import { cn } from '@/lib/utils';
import ChatMessageMarkdownRenderer from './ChatMessageMarkdownRenderer';

interface ChatInterfaceProps {
  onClose?: () => void;
}

const MAX_HISTORY_MESSAGES = 10; // Consider last 10 messages (5 user, 5 AI turns approx)

export default function ChatInterface({ onClose }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { getTemplatesAsContextString, loading: templatesLoading } = useTemplates();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    }, 0);
    return () => clearTimeout(timer);
  }, [messages, isLoading]);

  useEffect(() => {
    setMessages([
      {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Hello! I'm AgentVerse AI. How can I help you find the perfect automation template today?\n\nFor example, you can ask:\n- *What templates do you have for email automation?*\n- *Tell me about the social media scheduler.*",
        timestamp: Date.now()
      }
    ]);
  }, []);


  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || templatesLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      const templateLibraryContext = getTemplatesAsContextString();

      const historyForAI = messages.slice(-MAX_HISTORY_MESSAGES);
      const chatHistoryString = historyForAI
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n');

      const aiResponse = await aiAssistantChatbot({
        question: currentInput,
        templateLibraryContext: templateLibraryContext,
        chatHistory: chatHistoryString || undefined,
      });

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse.answer,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chatbot error:", error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Sorry, I encountered an error. Please try again later.",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col max-h-[70vh] bg-card border border-border rounded-lg shadow-2xl shadow-primary/20 overflow-hidden">
      <header className="p-4 border-b border-border flex justify-between items-center bg-card/80 backdrop-blur-sm">
        <h3 className="text-lg font-semibold text-foreground glow-text">AI Assistant</h3>
        {onClose && <Button variant="ghost" size="icon" onClick={onClose}><Bot className="h-5 w-5"/></Button>}
      </header>

      <ScrollArea className="flex-grow min-h-0"> {/* Removed p-4 */}
        <div className="p-4 space-y-4"> {/* Added p-4 here */}
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex items-start gap-2 max-w-[85%] sm:max-w-[75%]",
                message.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
              )}
            >
              <Avatar className="h-8 w-8 border-2 border-primary/50 shrink-0">
                <AvatarImage src={message.role === 'user' ? `https://placehold.co/40x40/9D4EDD/FFFFFF?text=U` : `https://placehold.co/40x40/E5B8F4/1A122B?text=AI`} />
                <AvatarFallback>{message.role === 'user' ? <User/> : <Bot/>}</AvatarFallback>
              </Avatar>
              <div
                className={cn(
                  "p-3 rounded-xl shadow-md text-sm sm:text-base", 
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-none whitespace-pre-wrap break-words'
                    : 'bg-secondary text-secondary-foreground rounded-bl-none whitespace-pre-wrap break-words' // Changed from break-all to break-words
                )}
              >
                {message.role === 'assistant' ? (
                  <ChatMessageMarkdownRenderer content={message.content} />
                ) : (
                  <p>{message.content}</p> 
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-start gap-2 mr-auto max-w-[75%]">
               <Avatar className="h-8 w-8 border-2 border-primary/50 shrink-0">
                <AvatarImage src={`https://placehold.co/40x40/E5B8F4/1A122B?text=AI`} />
                <AvatarFallback><Bot/></AvatarFallback>
              </Avatar>
              <div className="p-3 rounded-xl shadow-md bg-secondary text-secondary-foreground rounded-bl-none">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="p-4 border-t border-border bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={templatesLoading ? "Loading templates..." : "Ask about templates..."}
            className="flex-grow text-base"
            disabled={isLoading || templatesLoading}
            aria-label="Chat input"
          />
          <Button type="submit" size="icon" disabled={isLoading || templatesLoading || !input.trim()} className="glow-button">
            <Send className="h-5 w-5" />
            <span className="sr-only">Send message</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
