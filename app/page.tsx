"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { toast } from "sonner";
import equal from "fast-deep-equal";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { PreviewMessage } from "@/components/message";
import { Input } from "@/components/input";
import { VncPanel } from "@/components/vnc-panel";
import { SessionSidebar } from "@/components/session-sidebar";
import { DebugPanel } from "@/components/debug-panel";
import { ToolCallDetail } from "@/components/tool-call-detail";
import { AISDKLogo } from "@/components/icons";
import { DeployButton, ProjectInfo } from "@/components/project-info";
import { PromptSuggestions } from "@/components/prompt-suggestions";
import { getDesktopURL } from "@/lib/sandbox/utils";
import { useScrollToBottom } from "@/lib/use-scroll-to-bottom";
import { useSessions } from "@/lib/use-sessions";
import {
  EventStoreProvider,
  useEventStore,
  type ToolEvent,
  type ComputerAction,
} from "@/lib/event-store";
import { ABORTED } from "@/lib/utils";
import { Bug, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { Message } from "ai";

function Dashboard() {
  const { addEvent, updateEvent, clearEvents } = useEventStore();
  const {
    sessions,
    activeSession,
    createNewSession,
    switchSession,
    deleteSession,
    updateActiveSessionMessages,
    updateActiveSessionSandboxId,
    renameSession,
  } = useSessions();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [debugOpen, setDebugOpen] = useState(false);
  // setSelectedEvent is used when session changes; tool-call clicks can wire it in future
  const [selectedEvent, setSelectedEvent] = useState<ToolEvent | null>(null); // eslint-disable-line @typescript-eslint/no-unused-vars
  const [isInitializing, setIsInitializing] = useState(true);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const sandboxIdRef = useRef<string | null>(activeSession.sandboxId);
  sandboxIdRef.current = activeSession.sandboxId;
  const [containerRef, endRef] = useScrollToBottom();

  const {
    messages, input, handleInputChange, handleSubmit,
    status, stop: stopGeneration, append, setMessages,
  } = useChat({
    api: "/api/chat",
    id: activeSession.id,
    body: { sandboxId: activeSession.sandboxId },
    maxSteps: 30,
    initialMessages: activeSession.messages as Message[],
    onError: (error) => {
      console.error(error);
      toast.error("There was an error", { description: "Please try again later.", richColors: true, position: "top-center" });
    },
  });

  const prevMessagesRef = useRef<Message[]>([]);
  useEffect(() => {
    if (!equal(prevMessagesRef.current, messages)) {
      prevMessagesRef.current = messages;
      updateActiveSessionMessages(messages);
    }
  }, [messages, updateActiveSessionMessages]);

  const processedPartIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const msg of messages) {
      if (msg.role !== "assistant") continue;
      for (const part of msg.parts ?? []) {
        if (part.type !== "tool-invocation") continue;
        const inv = part.toolInvocation;
        const partId = `${msg.id}-${inv.toolCallId}`;
        const newStatus = inv.state === "result"
          ? inv.result === ABORTED ? ("aborted" as const) : ("success" as const)
          : ("running" as const);
        if (processedPartIds.current.has(partId)) {
          updateEvent(inv.toolCallId, { status: newStatus, ...(inv.state === "result" ? { result: inv.result as string } : {}) });
          continue;
        }
        processedPartIds.current.add(partId);
        if (inv.toolName === "computer") {
          addEvent({ id: inv.toolCallId, timestamp: Date.now(), type: "computer", action: (inv.args as { action: ComputerAction }).action, payload: inv.args as Record<string, unknown>, status: newStatus });
        } else if (inv.toolName === "bash") {
          addEvent({ id: inv.toolCallId, timestamp: Date.now(), type: "bash", command: (inv.args as { command: string }).command, status: newStatus });
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const stop = () => {
    stopGeneration();
    const lastMsg = messages.at(-1);
    const lastPart = lastMsg?.parts?.at(-1);
    if (lastMsg?.role === "assistant" && lastPart?.type === "tool-invocation") {
      setMessages((prev) => [...prev.slice(0, -1), { ...lastMsg, parts: [...lastMsg.parts.slice(0, -1), { ...lastPart, toolInvocation: { ...lastPart.toolInvocation, state: "result", result: ABORTED } }] }]);
    }
  };

  const refreshDesktop = useCallback(async () => {
    try {
      setIsInitializing(true);
      const { streamUrl: url, id } = await getDesktopURL(sandboxIdRef.current ?? undefined);
      setStreamUrl(url);
      updateActiveSessionSandboxId(id);
    } catch (err) { console.error("Failed to refresh desktop:", err); }
    finally { setIsInitializing(false); }
  }, [updateActiveSessionSandboxId]);

  useEffect(() => {
    const id = sandboxIdRef.current;
    if (!id) return;
    const kill = () => navigator.sendBeacon(`/api/kill-desktop?sandboxId=${encodeURIComponent(id)}`);
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const killEvt = isIOS || isSafari ? "pagehide" : "beforeunload";
    window.addEventListener(killEvt, kill);
    return () => { window.removeEventListener(killEvt, kill); kill(); };
  }, [activeSession.sandboxId]);

  useEffect(() => {
    (async () => {
      try {
        setIsInitializing(true);
        const { streamUrl: url, id } = await getDesktopURL(sandboxIdRef.current ?? undefined);
        setStreamUrl(url); updateActiveSessionSandboxId(id);
      } catch (err) { console.error("Failed to initialize desktop:", err); toast.error("Failed to initialize desktop"); }
      finally { setIsInitializing(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prevSessionId = useRef(activeSession.id);
  useEffect(() => {
    if (prevSessionId.current !== activeSession.id) {
      prevSessionId.current = activeSession.id;
      processedPartIds.current.clear();
      clearEvents();
      setSelectedEvent(null);
    }
  }, [activeSession.id, clearEvents]);

  const isLoading = status !== "ready";

  return (
    <div className="flex h-dvh bg-[#080810] text-white overflow-hidden">
      <div className={`shrink-0 transition-all duration-200 ease-in-out overflow-hidden border-r border-white/[0.05] ${sidebarOpen ? "w-48" : "w-0"}`}>
        <SessionSidebar sessions={sessions} activeSessionId={activeSession.id} onCreateSession={createNewSession} onSwitchSession={switchSession} onDeleteSession={deleteSession} onRenameSession={renameSession} />
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center justify-between px-3 py-2 border-b border-white/[0.05] shrink-0 bg-[#0c0c14]">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => setSidebarOpen((v) => !v)} className="w-7 h-7 text-white/40 hover:text-white/80 hover:bg-white/5 rounded-md">
              {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </Button>
            <AISDKLogo />
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setDebugOpen((v) => !v)}
              className={`h-7 px-2.5 text-xs gap-1.5 rounded-lg ${debugOpen ? "bg-[#7c6fcd]/20 text-[#7c6fcd] hover:bg-[#7c6fcd]/30" : "text-white/40 hover:text-white/80 hover:bg-white/5"}`}>
              <Bug className="w-3.5 h-3.5" /> Debug
            </Button>
            <DeployButton />
          </div>
        </header>
        <div className="flex-1 min-h-0">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={30} minSize={22} className="flex flex-col min-h-0">
              <ResizablePanelGroup direction="vertical" className="h-full">
                <ResizablePanel defaultSize={debugOpen ? 65 : 100} minSize={30} className="flex flex-col min-h-0">
                  <div ref={containerRef} className="flex-1 overflow-y-auto py-4 space-y-2 px-2">
                    {messages.length === 0 && <ProjectInfo />}
                    {messages.map((message, i) => (
                      <PreviewMessage key={message.id} message={message} isLoading={isLoading} status={status} isLatestMessage={i === messages.length - 1} />
                    ))}
                    <div ref={endRef} className="pb-2" />
                  </div>
                  {messages.length === 0 && (
                    <PromptSuggestions disabled={isInitializing} submitPrompt={(p) => append({ role: "user", content: p })} />
                  )}
                  <div className="shrink-0 p-3 border-t border-white/[0.05] bg-[#0c0c14]">
                    <form onSubmit={handleSubmit}>
                      <Input handleInputChange={handleInputChange} input={input} isInitializing={isInitializing} isLoading={isLoading} status={status} stop={stop} />
                    </form>
                  </div>
                </ResizablePanel>
                {debugOpen && (
                  <>
                    <ResizableHandle withHandle />
                    <ResizablePanel defaultSize={35} minSize={20} className="min-h-0">
                      <DebugPanel />
                    </ResizablePanel>
                  </>
                )}
              </ResizablePanelGroup>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={70} minSize={40} className="min-h-0">
              <ResizablePanelGroup direction="vertical" className="h-full">
                <ResizablePanel defaultSize={70} minSize={30} className="min-h-0">
                  <VncPanel streamUrl={streamUrl} isInitializing={isInitializing} onRefresh={refreshDesktop} />
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={30} minSize={15} className="min-h-0 bg-[#0c0c14] border-t border-white/[0.05]">
                  <ToolCallDetail event={selectedEvent} />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <EventStoreProvider>
      <Dashboard />
    </EventStoreProvider>
  );
}

