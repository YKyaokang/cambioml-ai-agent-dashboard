"use client";

import { useState } from "react";
import { useEventStore, type ToolEvent, type AgentStatus } from "@/lib/event-store";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  Activity,
  Terminal,
  Monitor,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  Circle,
  Loader2,
} from "lucide-react";

const STATUS_STYLES: Record<ToolEvent["status"], string> = {
  pending:  "text-white/40",
  running:  "text-[#7c6fcd]",
  success:  "text-emerald-400",
  aborted:  "text-amber-400",
  error:    "text-red-400",
};

function StatusIcon({ status }: { status: ToolEvent["status"] }) {
  switch (status) {
    case "running": return <Loader2 className="w-3 h-3 animate-spin text-[#7c6fcd]" />;
    case "success": return <CheckCircle2 className="w-3 h-3 text-emerald-400" />;
    case "aborted": return <XCircle className="w-3 h-3 text-amber-400" />;
    case "error":   return <XCircle className="w-3 h-3 text-red-400" />;
    default:        return <Circle className="w-3 h-3 text-white/20" />;
  }
}

function AgentStatusBadge({ status }: { status: AgentStatus }) {
  const styles: Record<AgentStatus, string> = {
    idle:    "bg-white/5 text-white/40",
    running: "bg-[#7c6fcd]/20 text-[#7c6fcd] animate-pulse",
    error:   "bg-red-500/20 text-red-400",
  };
  const labels: Record<AgentStatus, string> = {
    idle: "Idle", running: "Running", error: "Error",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium", styles[status])}>
      <Zap className="w-2.5 h-2.5" />
      {labels[status]}
    </span>
  );
}

function EventRow({ event }: { event: ToolEvent }) {
  const [open, setOpen] = useState(false);
  const label = event.type === "computer" ? event.action : `bash`;
  const detail =
    event.type === "bash"
      ? event.command.slice(0, 50)
      : event.type === "computer" && event.payload.coordinate
        ? `(${(event.payload.coordinate as number[])[0]}, ${(event.payload.coordinate as number[])[1]})`
        : "";

  return (
    <div className="border-b border-white/[0.04] last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.03] transition-colors group"
      >
        <StatusIcon status={event.status} />
        <span className={cn("text-[11px] font-mono font-medium flex-1 truncate", STATUS_STYLES[event.status])}>
          {label}
          {detail && (
            <span className="text-white/30 font-normal ml-1">{detail}</span>
          )}
        </span>
        {event.duration !== undefined && (
          <span className="text-[10px] text-white/25 flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" />
            {event.duration}ms
          </span>
        )}
        {open
          ? <ChevronDown className="w-3 h-3 text-white/20" />
          : <ChevronRight className="w-3 h-3 text-white/20 group-hover:text-white/40" />}
      </button>

      {open && (
        <div className="px-3 pb-2">
          <pre className="text-[10px] text-white/40 bg-black/30 rounded p-2 overflow-x-auto max-h-48 whitespace-pre-wrap break-all">
            {JSON.stringify(
              event.type === "computer"
                ? { action: event.action, payload: event.payload, status: event.status, id: event.id }
                : { command: event.command, status: event.status, id: event.id },
              null,
              2,
            )}
          </pre>
        </div>
      )}
    </div>
  );
}

export function DebugPanel() {
  const { events, derived } = useEventStore();
  const [tab, setTab] = useState<"events" | "stats">("events");

  const actionEntries = Object.entries(derived.eventCountByAction).sort(
    ([, a], [, b]) => b - a,
  );

  return (
    <div className="flex flex-col h-full bg-[#0a0a10] text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-[#7c6fcd]" />
          <span className="text-[11px] font-semibold text-white/60 uppercase tracking-widest">
            Debug
          </span>
        </div>
        <AgentStatusBadge status={derived.agentStatus} />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/[0.06] shrink-0">
        {(["events", "stats"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 py-1.5 text-[11px] font-medium transition-colors",
              tab === t
                ? "text-[#7c6fcd] border-b-2 border-[#7c6fcd]"
                : "text-white/30 hover:text-white/60",
            )}
          >
            {t === "events" ? `Events (${derived.totalEvents})` : "Stats"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "events" ? (
          events.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-6 text-white/20">
              <Activity className="w-6 h-6" />
              <p className="text-xs">No events yet</p>
            </div>
          ) : (
            <div>
              {[...events].reverse().map((ev) => (
                <EventRow key={ev.id} event={ev} />
              ))}
            </div>
          )
        ) : (
          <div className="p-3 space-y-3">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Total Events" value={derived.totalEvents} icon={<Zap className="w-3.5 h-3.5" />} />
              <StatCard
                label="Running"
                value={derived.runningEventId ? "1" : "0"}
                icon={<Loader2 className="w-3.5 h-3.5" />}
              />
            </div>
            {/* Per-action */}
            {actionEntries.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-widest text-white/25 mb-2">By Action</p>
                {actionEntries.map(([action, count]) => (
                  <div key={action} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      {action === "bash"
                        ? <Terminal className="w-3 h-3 text-white/30 shrink-0" />
                        : <Monitor className="w-3 h-3 text-white/30 shrink-0" />}
                      <span className="text-[11px] text-white/50 truncate font-mono">{action}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-1 rounded-full bg-[#7c6fcd]/50"
                        style={{
                          width: `${Math.max(8, (count / derived.totalEvents) * 80)}px`,
                        }}
                      />
                      <span className="text-[11px] text-white/60 font-mono w-4 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-2.5 flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-white/30">
        {icon}
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <span className="text-lg font-bold text-white/70">{value}</span>
    </div>
  );
}
