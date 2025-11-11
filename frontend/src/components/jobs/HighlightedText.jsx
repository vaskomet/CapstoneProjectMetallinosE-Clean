import React from 'react';

/**
 * Component for rendering text with search highlights
 * 
 * The backend sends highlighted text wrapped in <mark> tags.
 * This component safely renders the HTML and applies styling.
 * 
 * @param {string} highlighted - HTML string with <mark> tags from backend
 * @param {string} fallback - Original text to show if no highlighting available
 * @param {string} className - Additional CSS classes
 */
const HighlightedText = ({ highlighted, fallback, className = '' }) => {
  // If no highlighted version, show original text
  if (!highlighted) {
    return <span className={className}>{fallback}</span>;
  }

  // Render highlighted HTML with custom styling for <mark> tags
  return (
    <span 
      className={className}
      dangerouslySetInnerHTML={{ __html: highlighted }}
      style={{
        // Apply styling to <mark> tags
        '--mark-bg': '#fef08a',
        '--mark-color': '#854d0e',
      }}
    />
  );
};

// Add global styles for <mark> tags via inline style
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    mark {
      background-color: #fef08a;
      color: #854d0e;
      font-weight: 600;
      padding: 2px 4px;
      border-radius: 2px;
    }
  `;
  if (!document.querySelector('style[data-highlight-styles]')) {
    style.setAttribute('data-highlight-styles', 'true');
    document.head.appendChild(style);
  }
}

export default HighlightedText;
