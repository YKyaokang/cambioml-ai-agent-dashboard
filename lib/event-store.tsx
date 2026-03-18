"use client";

import {
  createContext,
  useCallback,
  useContext,
  useReducer,
  useRef,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// Discriminated union types for tool events
// ---------------------------------------------------------------------------

export type ToolEventStatus = "pending" | "running" | "success" | "aborted" | "error";

export type ComputerAction =
  | "screenshot"
  | "left_click"
  | "right_click"
  | "double_click"
  | "mouse_move"
  | "type"
  | "key"
  | "wait"
  | "scroll"
  | "left_click_drag";

export type ToolEventType = "computer" | "bash";

interface BaseToolEvent {
  id: string;
  timestamp: number;
  status: ToolEventStatus;
  duration?: number; // ms, set when status transitions to success/aborted/error
}

export interface ComputerToolEvent extends BaseToolEvent {
  type: "computer";
  action: ComputerAction;
  payload: Record<string, unknown>;
  result?: string | { type: "image"; data: string };
}

export interface BashToolEvent extends BaseToolEvent {
  type: "bash";
  command: string;
  result?: string;
}

export type ToolEvent = ComputerToolEvent | BashToolEvent;

// ---------------------------------------------------------------------------
// Derived state helpers
// ---------------------------------------------------------------------------

export type AgentStatus = "idle" | "running" | "error";

export interface EventStoreDerived {
  totalEvents: number;
  eventCountByAction: Record<string, number>;
  agentStatus: AgentStatus;
  runningEventId: string | null;
}

export function deriveState(events: ToolEvent[]): EventStoreDerived {
  const eventCountByAction: Record<string, number> = {};
  let runningEventId: string | null = null;
  let agentStatus: AgentStatus = "idle";

  for (const ev of events) {
    const key = ev.type === "computer" ? ev.action : "bash";
    eventCountByAction[key] = (eventCountByAction[key] ?? 0) + 1;
    if (ev.status === "running") {
      runningEventId = ev.id;
      agentStatus = "running";
    }
    if (ev.status === "error") agentStatus = "error";
  }

  return {
    totalEvents: events.length,
    eventCountByAction,
    agentStatus,
    runningEventId,
  };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

type Action =
  | { type: "ADD_EVENT"; event: ToolEvent }
  | { type: "UPDATE_EVENT"; id: string; patch: Partial<ToolEvent> }
  | { type: "CLEAR" };

function reducer(state: ToolEvent[], action: Action): ToolEvent[] {
  switch (action.type) {
    case "ADD_EVENT":
      return [...state, action.event];
    case "UPDATE_EVENT":
      return state.map((ev) =>
        ev.id === action.id ? ({ ...ev, ...action.patch } as ToolEvent) : ev,
      );
    case "CLEAR":
      return [];
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface EventStoreContextValue {
  events: ToolEvent[];
  derived: EventStoreDerived;
  addEvent: (event: ToolEvent) => void;
  updateEvent: (id: string, patch: Partial<ToolEvent>) => void;
  clearEvents: () => void;
}

const EventStoreContext = createContext<EventStoreContextValue | null>(null);

export function EventStoreProvider({ children }: { children: ReactNode }) {
  const [events, dispatch] = useReducer(reducer, []);
  const startTimes = useRef<Map<string, number>>(new Map());

  const addEvent = useCallback((event: ToolEvent) => {
    startTimes.current.set(event.id, Date.now());
    dispatch({ type: "ADD_EVENT", event });
  }, []);

  const updateEvent = useCallback((id: string, patch: Partial<ToolEvent>) => {
    const isTerminal =
      patch.status === "success" ||
      patch.status === "aborted" ||
      patch.status === "error";
    if (isTerminal) {
      const start = startTimes.current.get(id);
      if (start) {
        patch = { ...patch, duration: Date.now() - start };
        startTimes.current.delete(id);
      }
    }
    dispatch({ type: "UPDATE_EVENT", id, patch });
  }, []);

  const clearEvents = useCallback(() => {
    startTimes.current.clear();
    dispatch({ type: "CLEAR" });
  }, []);

  const derived = deriveState(events);

  return (
    <EventStoreContext.Provider
      value={{ events, derived, addEvent, updateEvent, clearEvents }}
    >
      {children}
    </EventStoreContext.Provider>
  );
}

export function useEventStore(): EventStoreContextValue {
  const ctx = useContext(EventStoreContext);
  if (!ctx) throw new Error("useEventStore must be used inside EventStoreProvider");
  return ctx;
}
