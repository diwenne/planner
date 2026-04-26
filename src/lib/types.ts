export interface Block {
  id: string;
  type: "text" | "todo" | "h1" | "h2" | "h3" | "number" | "quote" | "divider" | "code";
  content: string;
  checked?: boolean;
}

export type PlannerData = Record<string, Block[]>;
