// helpers/parseMentions.js
import React from 'react';

/**
 * Matches patterns like "@[zubzug](10)" 
 * capturing "zubzug" as match[1] and "10" as match[2].
 */
const mentionRegex = /@\[([^\]]+)\]\((\d+)\)/g;

/**
 * Parses mention markup in text and replaces it with clickable elements.
 *
 * @param {string} text - The string that may contain mention markup.
 * @param {function} onProfileClick - A callback receiving the userId to navigate to.
 * @returns {Array<React.Node>} - Mixed array of strings and React elements.
 */

export const extractMentionsFromMarkup = (text) => {
    const mentionRegex = /\@\[(.*?)\]\((\d+)\)/g;
    let matches = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      matches.push({ display: match[1], id: match[2] });
    }
  
    return matches;
  };
  

export function parseMentions(text, onProfileClick) {
    let parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(text)) !== null) {
        const start = match.index;
        const end = mentionRegex.lastIndex;

        // Push text before the mention
        if (start > lastIndex) {
            parts.push(text.slice(lastIndex, start));
        }

        const username = match[1];
        const userId = match[2];

        // Insert clickable mention
        parts.push(
            <span
                key={`mention-${start}-${end}`}
                style={{ color: 'blue', cursor: 'pointer' }}
                onClick={() => onProfileClick && onProfileClick(userId)}
            >
                {username}
            </span>
        );

        lastIndex = end;
    }

    // Push any remaining text after last mention
    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }

    return parts;
}
