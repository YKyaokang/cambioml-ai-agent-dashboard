"use client";

import { memo } from "react";
import type { ToolEvent } from "@/lib/event-store";
import {
  Camera,
  CheckCircle2,
  Circle,
  Clock,
  Keyboard,
  KeyRound,
  Loader2,
  MousePointer,
  MousePointerClick,
  ScrollText,
  Terminal,
  XCircle,
  MonitorPlay,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolCallDetailProps {
  event: ToolEvent | null;
}

const ACTION_ICON: Record<string, React.ElementType> = {
  screenshot: Camera,
  left_click: MousePointer,
  right_click: MousePointerClick,
  double_click: MousePointerClick,
  mouse_move: MousePointer,
  type: Keyboard,
  key: KeyRound,
  wait: Clock,
  scroll: ScrollText,
  left_click_drag: MousePointer,
  bash: Terminal,
};

function StatusChip({ status }: { status: ToolEvent["status"] }) {
  const map: Record<
    ToolEvent["status"],
    { label: string; cls: string; icon: React.ReactNode }
  > = {
    pending: {
      label: "Pending",
      cls: "bg-white/5 text-white/40",
      icon: <Circle className="w-3 h-3" />,
    },
    running: {
      label: "Running",
      cls: "bg-[#7c6fcd]/20 text-[#7c6fcd]",
      icon: <Loader2 className="w-3 h-3 animate-spin" />,
    },
    success: {
      label: "Success",
      cls: "bg-emerald-500/20 text-emerald-400",
      icon: <CheckCircle2 className="w-3 h-3" />,
    },
    aborted: {
      label: "Aborted",
      cls: "bg-amber-500/20 text-amber-400",
      icon: <XCircle className="w-3 h-3" />,
    },
    error: {
      label: "Error",
      cls: "bg-red-500/20 text-red-400",
      icon: <XCircle className="w-3 h-3" />,
    },
  };
  const { label, cls, icon } = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        cls,
      )}
    >
      {icon}
      {label}
    </span>
  );
}

const PureToolCallDetail = ({ event }: ToolCallDetailProps) => {
  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-white/20 p-8">
        <MonitorPlay className="w-10 h-10" />
        <p className="text-sm text-center">
          Click a tool call in the chat to see details here
        </p>
      </div>
    );
  }

  const actionKey = event.type === "computer" ? event.action : "bash";
  const Icon = ACTION_ICON[actionKey] ?? Circle;
  const title = event.type === "computer" ? event.action : "bash";

  const payloadData =
    event.type === "computer"
      ? event.payload
      : { command: event.command };

  const resultData =
    event.type === "computer"
      ? event.result
      : event.result;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="px-4 py-4 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-[#7c6fcd]/15 border border-[#7c6fcd]/20 flex items-center justify-center">
            <Icon className="w-4.5 h-4.5 text-[#7c6fcd]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white font-mono">{title}</p>
            <p className="text-[10px] text-white/30 mt-0.5">
              {new Date(event.timestamp).toLocaleTimeString()}
            </p>
          </div>
          <div className="ml-auto">
            <StatusChip status={event.status} />
          </div>
        </div>
        {event.duration !== undefined && (
          <div className="flex items-center gap-1.5 text-[11px] text-white/30">
            <Clock className="w-3 h-3" />
            Duration: {event.duration}ms
          </div>
        )}
      </div>

      {/* Payload */}
      <div className="px-4 py-3 border-b border-white/[0.06]">
        <p className="text-[10px] uppercase tracking-widest text-white/25 mb-2">
          Payload
        </p>
        <pre className="text-[11px] text-white/50 bg-black/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(payloadData, null, 2)}
        </pre>
      </div>

      {/* Result */}
      {resultData !== undefined && (
        <div className="px-4 py-3">
          <p className="text-[10px] uppercase tracking-widest text-white/25 mb-2">
            Result
          </p>
          {typeof resultData === "object" &&
          resultData !== null &&
          "type" in resultData &&
          resultData.type === "image" ? (
            <div className="rounded-lg overflow-hidden border border-white/[0.08]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/png;base64,${
                  (resultData as { type: "image"; data: string }).data
                }`}
                alt="Screenshot result"
                className="w-full"
              />
            </div>
          ) : (
            <pre className="text-[11px] text-white/50 bg-black/30 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
              {typeof resultData === "string"
                ? resultData
                : JSON.stringify(resultData, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

export const ToolCallDetail = memo(PureToolCallDetail, (prev, next) => {
  if (prev.event === null && next.event === null) return true;
  if (prev.event === null || next.event === null) return false;
  return (
    prev.event.id === next.event.id &&
    prev.event.status === next.event.status &&
    prev.event.duration === next.event.duration
  );
});
