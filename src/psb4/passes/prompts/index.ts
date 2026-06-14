export type PromptTemplate = {
  id: string;
  description: string;
  slots: string[];
  render: (inputs: Record<string, string>) => string;
};

const templates: Record<string, PromptTemplate> = {};

export function registerPromptTemplate(template: PromptTemplate) {
  templates[template.id] = template;
}

export function getPromptTemplate(id: string): PromptTemplate | null {
  return templates[id] ?? null;
}
