"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, X } from 'lucide-react';
import ChatInterface from './ChatInterface';
import { cn } from '@/lib/utils';

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleChat = () => setIsOpen(!isOpen);

  return (
    <>
      <div className="fixed bottom-6 right-6 z-[9998]">
        <Button
          size="lg"
          variant="default"
          className="rounded-full p-4 h-16 w-16 shadow-2xl shadow-primary/40 glow-button- εται flex items-center justify-center"
          onClick={toggleChat}
          aria-label={isOpen ? "Close chat" : "Open chat"}
        >
          {isOpen ? <X className="h-7 w-7" /> : <MessageSquare className="h-7 w-7" />}
        </Button>
      </div>

      {/* Chat Window */}
      <div
        className={cn(
          "fixed bottom-24 right-6 z-[9997] w-[90vw] max-w-md h-auto transform transition-all duration-300 ease-in-out",
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
        )}
      >
        {isOpen && <ChatInterface onClose={toggleChat} />}
      </div>
    </>
  );
}
