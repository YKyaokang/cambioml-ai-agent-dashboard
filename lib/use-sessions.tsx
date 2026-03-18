"use client";

import { useCallback, useEffect, useState } from "react";
import type { Message } from "ai";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  sandboxId: string | null;
}

const STORAGE_KEY = "ai-agent-sessions";
const MAX_SESSIONS = 20;

function generateId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function createSession(): ChatSession {
  return {
    id: generateId(),
    title: "New session",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    sandboxId: null,
  };
}

function loadSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]): void {
  if (typeof window === "undefined") return;
  try {
    // Keep only the last MAX_SESSIONS to avoid quota issues
    const trimmed = sessions.slice(-MAX_SESSIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Silently fail on storage quota exceeded
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseSessionsReturn {
  sessions: ChatSession[];
  activeSession: ChatSession;
  createNewSession: () => void;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  updateActiveSessionMessages: (messages: Message[]) => void;
  updateActiveSessionSandboxId: (sandboxId: string | null) => void;
  renameSession: (id: string, title: string) => void;
}

export function useSessions(): UseSessionsReturn {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const stored = loadSessions();
    if (stored.length === 0) {
      const initial = createSession();
      return [initial];
    }
    return stored;
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const stored = loadSessions();
    return stored.length > 0 ? stored[stored.length - 1].id : sessions[0]?.id ?? "";
  });

  // Persist on every change
  useEffect(() => {
    saveSessions(sessions);
  }, [sessions]);

  const activeSession: ChatSession =
    sessions.find((s) => s.id === activeSessionId) ?? sessions[sessions.length - 1];

  const createNewSession = useCallback(() => {
    const newSession = createSession();
    setSessions((prev) => [...prev, newSession]);
    setActiveSessionId(newSession.id);
  }, []);

  const switchSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== id);
        if (filtered.length === 0) {
          const fresh = createSession();
          setActiveSessionId(fresh.id);
          return [fresh];
        }
        if (id === activeSessionId) {
          setActiveSessionId(filtered[filtered.length - 1].id);
        }
        return filtered;
      });
    },
    [activeSessionId],
  );

  const updateActiveSessionMessages = useCallback(
    (messages: Message[]) => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeSessionId) return s;
          // Derive a title from the first user message
          const firstUserMsg = messages.find((m) => m.role === "user");
          const title =
            firstUserMsg && typeof firstUserMsg.content === "string"
              ? firstUserMsg.content.slice(0, 40)
              : s.title;
          return {
            ...s,
            messages,
            title: s.title === "New session" && title ? title : s.title,
            updatedAt: Date.now(),
          };
        }),
      );
    },
    [activeSessionId],
  );

  const updateActiveSessionSandboxId = useCallback(
    (sandboxId: string | null) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId ? { ...s, sandboxId } : s,
        ),
      );
    },
    [activeSessionId],
  );

  const renameSession = useCallback((id: string, title: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title } : s)),
    );
  }, []);

  return {
    sessions,
    activeSession,
    createNewSession,
    switchSession,
    deleteSession,
    updateActiveSessionMessages,
    updateActiveSessionSandboxId,
    renameSession,
  };
}
