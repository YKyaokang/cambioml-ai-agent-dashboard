"use client";

import { useState } from "react";
import type { ChatSession } from "@/lib/use-sessions";
import { Button } from "@/components/ui/button";
import { MessageSquare, Plus, Trash2, Edit3, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onCreateSession: () => void;
  onSwitchSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
}

export function SessionSidebar({
  sessions,
  activeSessionId,
  onCreateSession,
  onSwitchSession,
  onDeleteSession,
  onRenameSession,
}: SessionSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const startEdit = (session: ChatSession) => {
    setEditingId(session.id);
    setEditValue(session.title);
  };

  const confirmEdit = (id: string) => {
    if (editValue.trim()) onRenameSession(id, editValue.trim());
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  return (
    <aside className="flex flex-col h-full bg-[#0e0e16] border-r border-white/[0.06] w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-white/[0.06]">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/30">
          Sessions
        </span>
        <Button
          size="icon"
          variant="ghost"
          onClick={onCreateSession}
          className="w-6 h-6 text-white/40 hover:text-white/80 hover:bg-white/5 rounded-md"
          title="New session"
        >
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto py-1 space-y-0.5 px-1">
        {[...sessions].reverse().map((session) => {
          const isActive = session.id === activeSessionId;
          const isEditing = editingId === session.id;
          return (
            <div
              key={session.id}
              className={cn(
                "group relative flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer transition-all duration-150",
                isActive
                  ? "bg-[#7c6fcd]/20 text-white"
                  : "text-white/50 hover:text-white/80 hover:bg-white/[0.04]",
              )}
              onClick={() => !isEditing && onSwitchSession(session.id)}
            >
              <MessageSquare
                className={cn(
                  "w-3.5 h-3.5 shrink-0 transition-colors",
                  isActive ? "text-[#7c6fcd]" : "text-white/30",
                )}
              />

              {isEditing ? (
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmEdit(session.id);
                    if (e.key === "Escape") cancelEdit();
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 min-w-0 bg-white/10 border border-[#7c6fcd]/40 rounded px-1.5 py-0.5 text-xs text-white outline-none"
                />
              ) : (
                <span className="flex-1 min-w-0 text-xs truncate">
                  {session.title}
                </span>
              )}

              <div
                className={cn(
                  "flex items-center gap-0.5 transition-opacity",
                  isEditing
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100",
                )}
                onClick={(e) => e.stopPropagation()}
              >
                {isEditing ? (
                  <>
                    <button
                      onClick={() => confirmEdit(session.id)}
                      className="p-0.5 text-green-400 hover:text-green-300 rounded"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="p-0.5 text-white/40 hover:text-white/70 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEdit(session)}
                      className="p-0.5 text-white/30 hover:text-white/70 rounded"
                      title="Rename"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onDeleteSession(session.id)}
                      className="p-0.5 text-white/30 hover:text-red-400 rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer stats */}
      <div className="px-3 py-2 border-t border-white/[0.06]">
        <p className="text-[10px] text-white/20">
          {sessions.length} session{sessions.length !== 1 ? "s" : ""} stored
        </p>
      </div>
    </aside>
  );
}
