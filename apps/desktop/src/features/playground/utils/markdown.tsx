import React, { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';

interface CodeBlockProps {
  language: string;
  code: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const highlightSyntax = (text: string, _lang: string) => {
    const lines = text.split('\n');
    return lines.map((line, lineIdx) => {
      // Tokenize basic elements
      const tokens: React.ReactNode[] = [];
      let remaining = line;
      let keyCounter = 0;

      // Handle full line comments
      const trimmed = line.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('--')) {
        return (
          <div key={lineIdx} className="text-zinc-500 italic">
            {line || ' '}
          </div>
        );
      }

      // Regex for keywords, strings, numbers
      const regex =
        /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b(?:const|let|var|function|return|if|else|for|while|import|export|from|default|class|extends|async|await|try|catch|finally|throw|new|typeof|interface|type|public|private|def|elif|lambda|yield|self|None|True|False|nil|struct|fn|pub|impl|match|SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|JOIN|GROUP|BY|ORDER|LIMIT)\b)|(\b\d+(?:\.\d+)?\b)/g;

      let lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(remaining)) !== null) {
        // Text before match
        if (match.index > lastIndex) {
          tokens.push(
            <span key={keyCounter++} className="text-zinc-200">
              {remaining.substring(lastIndex, match.index)}
            </span>
          );
        }

        const [fullMatch, stringMatch, keywordMatch, numberMatch] = match;

        if (stringMatch) {
          tokens.push(
            <span key={keyCounter++} className="text-emerald-400">
              {stringMatch}
            </span>
          );
        } else if (keywordMatch) {
          tokens.push(
            <span key={keyCounter++} className="text-purple-400 font-semibold">
              {keywordMatch}
            </span>
          );
        } else if (numberMatch) {
          tokens.push(
            <span key={keyCounter++} className="text-amber-400">
              {numberMatch}
            </span>
          );
        }

        lastIndex = match.index + fullMatch.length;
      }

      // Remaining line text
      if (lastIndex < remaining.length) {
        tokens.push(
          <span key={keyCounter++} className="text-zinc-200">
            {remaining.substring(lastIndex)}
          </span>
        );
      }

      return (
        <div key={lineIdx} className="leading-5">
          {tokens.length > 0 ? tokens : ' '}
        </div>
      );
    });
  };

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-[#272b35] bg-[#0c0d11] text-xs font-mono select-text shadow-sm">
      {/* Code Header */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#14161d] border-b border-[#222530] text-[11px] select-none">
        <div className="flex items-center gap-1.5 text-zinc-400">
          <Terminal className="w-3.5 h-3.5 text-zinc-500" />
          <span className="font-semibold uppercase tracking-wider text-[10px] text-zinc-300">
            {language || 'code'}
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-[#1f222d] text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-400 font-sans">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 text-zinc-400" />
              <span className="text-[10px] font-sans">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Body */}
      <div className="p-3.5 overflow-x-auto text-zinc-200 scrollbar-thin">
        {highlightSyntax(code, language)}
      </div>
    </div>
  );
};

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  if (!content) return null;

  // Split content by code block markers (```)
  const parts = content.split(/(```[\s\S]*?```)/g);

  return (
    <div className="space-y-2 select-text leading-relaxed">
      {parts.map((part, partIdx) => {
        if (!part) return null;

        // Fenced code block
        if (part.startsWith('```') && part.endsWith('```')) {
          const firstLineEnd = part.indexOf('\n');
          const rawLang =
            firstLineEnd > 3 ? part.substring(3, firstLineEnd).trim().toLowerCase() : '';
          const code =
            firstLineEnd !== -1
              ? part.substring(firstLineEnd + 1, part.length - 3)
              : part.substring(3, part.length - 3);

          return <CodeBlock key={partIdx} language={rawLang} code={code.replace(/\r\n/g, '\n')} />;
        }

        // Standard text, lists, headers, tables
        return <FormattedParagraph key={partIdx} text={part} />;
      })}
    </div>
  );
};

const FormattedParagraph: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: React.ReactNode[] = [];
  let isOrderedList = false;

  const flushList = () => {
    if (listItems.length > 0) {
      if (isOrderedList) {
        elements.push(
          <ol key={`ol-${elements.length}`} className="list-decimal pl-5 space-y-1 my-1.5">
            {listItems}
          </ol>
        );
      } else {
        elements.push(
          <ul key={`ul-${elements.length}`} className="list-disc pl-5 space-y-1 my-1.5">
            {listItems}
          </ul>
        );
      }
      listItems = [];
      inList = false;
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Headers
    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h1 key={idx} className="text-base font-bold text-zinc-100 mt-2 mb-1">
          {renderInlineMarkdown(trimmed.substring(2))}
        </h1>
      );
      return;
    }
    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={idx} className="text-sm font-bold text-zinc-100 mt-2 mb-1">
          {renderInlineMarkdown(trimmed.substring(3))}
        </h2>
      );
      return;
    }
    if (trimmed.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={idx} className="text-xs font-bold text-zinc-200 mt-1.5 mb-1">
          {renderInlineMarkdown(trimmed.substring(4))}
        </h3>
      );
      return;
    }

    // Bullet list
    const bulletMatch = line.match(/^(\s*)[*-]\s+(.+)$/);
    if (bulletMatch) {
      if (inList && isOrderedList) flushList();
      inList = true;
      isOrderedList = false;
      listItems.push(
        <li key={`li-${idx}`} className="text-zinc-200 text-xs">
          {renderInlineMarkdown(bulletMatch[2])}
        </li>
      );
      return;
    }

    // Numbered list
    const numberMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (numberMatch) {
      if (inList && !isOrderedList) flushList();
      inList = true;
      isOrderedList = true;
      listItems.push(
        <li key={`li-${idx}`} className="text-zinc-200 text-xs">
          {renderInlineMarkdown(numberMatch[2])}
        </li>
      );
      return;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      flushList();
      elements.push(
        <blockquote
          key={idx}
          className="border-l-2 border-zinc-400 dark:border-zinc-600 pl-3 py-0.5 my-1.5 text-zinc-600 dark:text-zinc-400 italic text-xs bg-zinc-50 dark:bg-zinc-900/40 rounded-r"
        >
          {renderInlineMarkdown(trimmed.substring(2))}
        </blockquote>
      );
      return;
    }

    // Empty line
    if (!trimmed) {
      flushList();
      return;
    }

    // Regular line
    flushList();
    elements.push(
      <p key={idx} className="text-xs text-zinc-200 leading-relaxed">
        {renderInlineMarkdown(line)}
      </p>
    );
  });

  flushList();

  return <div className="space-y-1">{elements}</div>;
};

// Render inline bold, italic, and code
function renderInlineMarkdown(str: string): React.ReactNode {
  // Regex to match inline `code`, **bold**, *italic*
  const parts: React.ReactNode[] = [];
  let remaining = str;
  let keyCounter = 0;

  const inlineRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = inlineRegex.exec(remaining)) !== null) {
    if (match.index > lastIndex) {
      parts.push(remaining.substring(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={keyCounter++}
          className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-[#171922] border border-zinc-200 dark:border-[#262937] text-[#111111] dark:text-zinc-200 font-mono text-[11px]"
        >
          {token.substring(1, token.length - 1)}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(
        <strong key={keyCounter++} className="font-semibold text-zinc-100">
          {token.substring(2, token.length - 2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(
        <em key={keyCounter++} className="italic text-zinc-300">
          {token.substring(1, token.length - 1)}
        </em>
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < remaining.length) {
    parts.push(remaining.substring(lastIndex));
  }

  return parts.length > 0 ? parts : str;
}
