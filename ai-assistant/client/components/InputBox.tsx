"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface InputBoxProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  isCoding?: boolean;
}

export function InputBox({ onSend, disabled, isCoding }: InputBoxProps) {
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (input.trim()) {
      onSend(input);
      setInput("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Coding questions get a multi-line, monospace textarea: Tab inserts a real
  // tab instead of moving focus, and Enter inserts a newline — you send with
  // Ctrl+Enter (or Cmd+Enter on Mac) or the button, since plain Enter is
  // needed for writing actual code.
  const handleCodeKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = input.slice(0, start) + "  " + input.slice(end);
      setInput(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
      return;
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isCoding) {
    return (
      <div className="border-t border-border bg-background p-4">
        <div className="flex flex-col gap-2">
          <textarea
            placeholder="// Write your solution here...&#10;// Tab inserts a real tab, Enter makes a new line&#10;// Ctrl+Enter (Cmd+Enter on Mac) to submit"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleCodeKeyDown}
            disabled={disabled}
            rows={6}
            spellCheck={false}
            className="w-full rounded-lg border border-border bg-muted/40 font-mono text-sm p-3 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Ctrl+Enter to submit
            </span>
            <Button onClick={handleSend} disabled={disabled || !input.trim()}>
              Submit Code
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-background p-4">
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Type your answer..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={disabled}
          className="flex-1"
        />
        <Button onClick={handleSend} disabled={disabled || !input.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
