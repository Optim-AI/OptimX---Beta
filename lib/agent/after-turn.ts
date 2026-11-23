/**
 * One cheap model call after each reply:
 *  - facts to remember (only what the OWNER stated, never the agent's ideas)
 *  - 0–2 action buttons to offer (never run; the owner confirms)
 */
import { actionGuide, cleanProposal, saveProposals, type AgentAction } from "./actions";
import { productChoices } from "./posters";
import { agentJson } from "./gemini-json";
import { MAX_MEMORIES, addMemory, type Memory } from "./memory";

export async function afterTurn(input: {
  userId: string; sessionId: string; messageId: string; ownerMessage: string; reply: string; memories: Memory[];
  /** false for scheduled runs: the owner didn't type the message, so nothing to learn from it */
  learn?: boolean;
}): Promise<{ learned: Memory[]; actions: AgentAction[] }> {
  const msg = input.ownerMessage.trim();
  const known = input.memories.slice(0, 60).map((m) => `- ${m.fact}`).join("\n") || "(nothing yet)";
  const productNames = (await productChoices(input.userId).catch(() => [])).map((p) => p.name);
  const out = await agentJson<{ facts?: unknown; actions?: unknown }>(
    `A small-business owner is chatting with their marketing assistant inside SkalX. Do two things.

1. FACTS: Does the owner's message state lasting facts worth remembering for future marketing help? Things about their business (products, prices, locations, customers, best sellers, busy seasons, budget, team, channels, what worked or failed) or standing preferences ("we never…", "I prefer…"), or an explicit "remember that…". Not questions, one-off requests, the assistant's ideas, guesses, or anything already remembered. Usually there are none.
Already remembered:
${known}

2. ACTIONS: ${actionGuide(productNames)}

Owner's message:
"""${msg.slice(0, 3000)}"""

Assistant's reply:
"""${input.reply.slice(0, 5000)}"""

Return JSON {"facts": [0-3 short complete sentences about the business, each under 200 chars], "actions": [0-2 action objects]}.`,
    { timeoutMs: 25_000, label: "agent-after-turn" }
  );

  const learned: Memory[] = [];
  if (input.learn !== false && msg.length >= 20 && input.memories.length < MAX_MEMORIES) {
    const facts = Array.isArray(out?.facts) ? out.facts.filter((f): f is string => typeof f === "string" && f.trim().length > 5).slice(0, 3) : [];
    for (const f of facts) {
      const m = await addMemory(input.userId, f, input.sessionId);
      if (m) learned.push(m);
    }
  }
  const proposals = (Array.isArray(out?.actions) ? out.actions : []).map(cleanProposal).filter(Boolean);
  const actions = proposals.length ? await saveProposals(input.userId, input.sessionId, input.messageId, proposals) : [];
  return { learned, actions };
}
