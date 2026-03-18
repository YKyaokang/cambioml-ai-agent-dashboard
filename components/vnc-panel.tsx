"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
import { Monitor, RefreshCw } from "lucide-react";

interface VncPanelProps {
  streamUrl: string | null;
  isInitializing: boolean;
  onRefresh: () => void;
}

/**
 * VncPanel is intentionally wrapped in memo with a custom comparator that
 * checks only the props it cares about. This prevents chat message updates
 * from causing the iframe to reload.
 */
const VncPanelInner = ({ streamUrl, isInitializing, onRefresh }: VncPanelProps) => {
  return (
    <div className="relative w-full h-full bg-[#0a0a0f] flex items-center justify-center">
      {streamUrl ? (
        <>
          <iframe
            src={streamUrl}
            className="w-full h-full border-0"
            style={{ display: "block" }}
            allow="autoplay"
            title="Remote Desktop"
          />
          <Button
            onClick={onRefresh}
            disabled={isInitializing}
            className="absolute top-3 right-3 z-10 bg-black/60 hover:bg-black/80 text-white border border-white/10 backdrop-blur-sm text-xs px-3 py-1.5 h-auto rounded-lg gap-1.5"
          >
            <RefreshCw
              className={`w-3 h-3 ${isInitializing ? "animate-spin" : ""}`}
            />
            {isInitializing ? "Creating..." : "New Desktop"}
          </Button>
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 text-white/40">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Monitor className="w-8 h-8" />
          </div>
          <p className="text-sm font-medium">
            {isInitializing ? "Initializing desktop..." : "Loading stream..."}
          </p>
          {isInitializing && (
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-[#7c6fcd] animate-pulse"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const VncPanel = memo(VncPanelInner, (prev, next) => {
  // Only re-render when URL, initializing state or callback reference changes
  return (
    prev.streamUrl === next.streamUrl &&
    prev.isInitializing === next.isInitializing &&
    prev.onRefresh === next.onRefresh
  );
});
