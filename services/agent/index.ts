import type { AnyAgentTool } from "@/lib/agent/types";
import { calendarTools } from "@/services/agent/calendarTools";
import { mindMapTools } from "@/services/agent/mindMapTools";
import { overviewTools } from "@/services/agent/overviewTools";
import { taskTools } from "@/services/agent/taskTools";

export const agentTools: AnyAgentTool[] = [
  ...overviewTools,
  ...taskTools,
  ...calendarTools,
  ...mindMapTools,
];
