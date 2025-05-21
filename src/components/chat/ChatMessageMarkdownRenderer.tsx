
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

  const flushList = () => {
    if (currentListItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc list-inside my-1 pl-4">
          {currentListItems}
        </ul>
      );
      currentListItems = [];
    }
  };

  lines.forEach((line, index) => {
    const listItemMatch = line.match(/^(\s*-\s|\s*\*\s)(.*)/); // Matches lines starting with '-' or '*' for list items

    if (listItemMatch) {
      // If it's a list item, add it to currentListItems
      currentListItems.push(<li key={`li-${index}-${elements.length}`}>{applyInlineFormatting(listItemMatch[2].trim())}</li>);
    } else {
      // Not a list item, so if we were building a list, flush it first
      flushList();
      
      if (line.trim() !== '') {
        // If the line is not empty, treat it as a paragraph
        elements.push(<p key={`p-${index}-${elements.length}`} className="my-0.5">{applyInlineFormatting(line)}</p>);
      }
      // Removed explicit <br /> generation for empty lines; paragraph/list margins will handle spacing.
    }
  });

  flushList(); // Ensure any list at the end of the content is flushed

  return <>{elements}</>;
};

export default ChatMessageMarkdownRenderer;
