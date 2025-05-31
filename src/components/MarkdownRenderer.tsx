"use client";

import React from 'react';
import { cn } from "@/lib/utils"; // Assuming cn is needed for prose class

interface MarkdownRendererProps {
  content: string;
  className?: string; // Optional className for the container div
}

// Enhanced markdown to HTML renderer, relying on prose for styling
const MarkdownRenderer = ({ content, className }: MarkdownRendererProps) => {
  const elements: JSX.Element[] = [];
  let currentListType: 'ul' | 'ol' | null = null;
  let listItems: JSX.Element[] = [];

  const applyInlineFormatting = (text: string): (string | JSX.Element)[] => {
    const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g);
    return parts.map((part, index) => {
      if (!part) return null;
      if (part.match(/^(\*\*|__)(.*)(\*\*|__)$/)) {
        return <strong key={index}>{part.substring(2, part.length - 2)}</strong>;
      }
      if (part.match(/^(\*|_)(.*)(\*|_)$/)) {
        return <em key={index}>{part.substring(1, part.length - 1)}</em>;
      }
      return part;
    }).filter(Boolean) as (string | JSX.Element)[];
  };

  const flushList = () => {
    if (listItems.length > 0) {
      if (currentListType === 'ol') {
        elements.push(<ol key={`list-${elements.length}`} className="list-decimal list-inside my-2 pl-4">{listItems}</ol>);
      } else {
        elements.push(<ul key={`list-${elements.length}`} className="list-disc list-inside my-2 pl-4">{listItems}</ul>);
      }
      listItems = [];
      currentListType = null;
    }
  };

  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const textContent = headingMatch[2];
      elements.push(React.createElement(`h${level}`, { key: `h-${index}`, className: `my-3 font-semibold text-foreground ${level === 1 ? 'text-2xl' : level === 2 ? 'text-xl' : 'text-lg'}` }, applyInlineFormatting(textContent)));
      return;
    }

    const ulListItemMatch = line.match(/^[-*]\s+(.*)/);
    if (ulListItemMatch) {
      if (currentListType !== 'ul') {
        flushList();
        currentListType = 'ul';
      }
      listItems.push(<li key={`li-${index}`}>{applyInlineFormatting(ulListItemMatch[1])}</li>);
      return;
    }

    const olListItemMatch = line.match(/^\d+\.\s+(.*)/);
    if (olListItemMatch) {
      if (currentListType !== 'ol') {
        flushList();
        currentListType = 'ol';
      }
      listItems.push(<li key={`li-${index}`}>{applyInlineFormatting(olListItemMatch[1])}</li>);
      return;
    }

    flushList();
    if (line.trim()) {
      elements.push(<p key={`p-${index}`} className="my-2 leading-relaxed">{applyInlineFormatting(line)}</p>);
    }
  });

  flushList();

  return (
    <div className={cn("prose prose-invert max-w-none text-foreground", className)}>
      {elements}
    </div>
  );
};

export default MarkdownRenderer;
