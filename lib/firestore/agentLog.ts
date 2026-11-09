import { FieldValue } from "firebase-admin/firestore";
import { agentLogCol } from "./collections";

export type AgentLogEntry = {
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  summary: string;
  source: "chat" | "confirm";
};

export async function addAgentLogEntry(userId: string, entry: AgentLogEntry): Promise<void> {
  await agentLogCol(userId).add({ ...entry, createdAt: FieldValue.serverTimestamp() });
}
