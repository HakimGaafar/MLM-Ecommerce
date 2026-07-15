import type { OrderReturnStatus } from "@mlm/db";

export type ReturnTimelineStepId =
  | "SUBMITTED"
  | "RECEIVED"
  | "INSPECTION"
  | "REFUND"
  | "COMPLETED";

export type ReturnTimelineStepState =
  | "complete"
  | "current"
  | "upcoming"
  | "failed"
  | "cancelled";

export type ReturnTimelineStep = {
  id: ReturnTimelineStepId;
  state: ReturnTimelineStepState;
};

export type ReturnRefundTimeline = {
  steps: ReturnTimelineStep[];
  isTerminal: boolean;
};

const STEP_ORDER: ReturnTimelineStepId[] = [
  "SUBMITTED",
  "RECEIVED",
  "INSPECTION",
  "REFUND",
  "COMPLETED",
];

type PhaseInfo = {
  completedThrough: number;
  current: number | null;
  failedAt: number | null;
  cancelled: boolean;
  terminal: boolean;
};

function statusPhase(status: OrderReturnStatus): PhaseInfo {
  switch (status) {
    case "REQUESTED":
      return { completedThrough: -1, current: 0, failedAt: null, cancelled: false, terminal: false };
    case "RECEIPT_IN_PROGRESS":
      return { completedThrough: 0, current: 1, failedAt: null, cancelled: false, terminal: false };
    case "RECEIPT_COMPLETED":
      return { completedThrough: 1, current: null, failedAt: null, cancelled: false, terminal: false };
    case "PROCESSING_IN_PROGRESS":
      return { completedThrough: 1, current: 2, failedAt: null, cancelled: false, terminal: false };
    case "PROCESSING_COMPLETED":
      return { completedThrough: 2, current: null, failedAt: null, cancelled: false, terminal: false };
    case "PROCESSING_REJECTED":
      return { completedThrough: 1, current: null, failedAt: 2, cancelled: false, terminal: true };
    case "REFUND_IN_PROGRESS":
      return { completedThrough: 2, current: 3, failedAt: null, cancelled: false, terminal: false };
    case "REFUND_COMPLETED":
      return { completedThrough: 4, current: null, failedAt: null, cancelled: false, terminal: true };
    case "CANCELLED_BY_CUSTOMER":
      return { completedThrough: 0, current: null, failedAt: null, cancelled: true, terminal: true };
    default:
      return { completedThrough: -1, current: 0, failedAt: null, cancelled: false, terminal: false };
  }
}

function stepStateForIndex(index: number, phase: PhaseInfo): ReturnTimelineStepState {
  if (phase.cancelled) {
    if (index === 0) return "complete";
    return "cancelled";
  }
  if (phase.failedAt !== null) {
    if (index < phase.failedAt) return "complete";
    if (index === phase.failedAt) return "failed";
    return "upcoming";
  }
  if (index <= phase.completedThrough) return "complete";
  if (phase.current !== null && index === phase.current) return "current";
  return "upcoming";
}

/** Builds refund-tracking steps for customer return detail UI. */
export function buildReturnRefundTimeline(status: OrderReturnStatus): ReturnRefundTimeline {
  const phase = statusPhase(status);
  const steps = STEP_ORDER.map((id, index) => ({
    id,
    state: stepStateForIndex(index, phase),
  }));
  return { steps, isTerminal: phase.terminal };
}
