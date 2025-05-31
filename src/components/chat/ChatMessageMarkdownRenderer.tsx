
import React from 'react';

interface ChatMessageMarkdownRendererProps {
  content: string;
}

const ChatMessageMarkdownRenderer: React.FC<ChatMessageMarkdownRendererProps> = ({ content }) => {
  const applyInlineFormatting = (lineContent: string): JSX.Element => {
    // Split by bold/italic markers. This is a simplified approach.
    const parts = lineContent.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g).filter(Boolean);

    return (
      <>
        {parts.map((part, index) => {
          if (part.match(/^(\*\*|__)(.*)(\*\*|__)$/)) {
            return <strong key={index}>{part.substring(2, part.length - 2)}</strong>;
          }
          if (part.match(/^(\*|_)(.*)(\*|_)$/)) {
            return <em key={index}>{part.substring(1, part.length - 1)}</em>;
          }
          // Return text as a React Fragment to ensure it has a key in a list
          return <React.Fragment key={index}>{part}</React.Fragment>;
        })}
      </>
    );
  };

  const lines = content.split('\n');
  const elements: JSX.Element[] = [];
  let currentListItems: JSX.Element[] = [];
  let currentListType: 'ul' | 'ol' | null = null;

  const flushList = () => {
    if (currentListItems.length > 0) {
      const listKey = `${currentListType}-${elements.length}`;
      if (currentListType === 'ol') {
        elements.push(
          <ol key={listKey} className="list-decimal list-inside my-1 pl-5 break-words">
            {currentListItems}
          </ol>
        );
      } else if (currentListType === 'ul') {
        elements.push(
          <ul key={listKey} className="list-disc list-inside my-1 pl-5 break-words">
            {currentListItems}
          </ul>
        );
      }
      currentListItems = [];
      currentListType = null;
    }
  };

  lines.forEach((line, index) => {
    const olListItemMatch = line.match(/^(\s*\d+\.\s+)(.*)/); // Ordered list: "1. item"
    const ulListItemMatch = line.match(/^(\s*[-*]\s+)(.*)/);    // Unordered list: "- item" or "* item"

    if (olListItemMatch) {
      if (currentListType !== 'ol') {
        flushList();
        currentListType = 'ol';
      }
      currentListItems.push(<li className="break-words" key={`li-${index}-${elements.length}`}>{applyInlineFormatting(olListItemMatch[2].trim())}</li>);
    } else if (ulListItemMatch) {
      if (currentListType !== 'ul') {
        flushList();
        currentListType = 'ul';
      }
      currentListItems.push(<li className="break-words" key={`li-${index}-${elements.length}`}>{applyInlineFormatting(ulListItemMatch[2].trim())}</li>);
    } else {
      flushList(); // End any current list if this line is not a list item
      if (line.trim() !== '') {
        elements.push(<p key={`p-${index}-${elements.length}`} className="my-0.5 break-words">{applyInlineFormatting(line)}</p>);
      }
    }
  });

  flushList(); // Ensure any list at the end of the content is flushed

  return <>{elements}</>;
};

export default ChatMessageMarkdownRenderer;
