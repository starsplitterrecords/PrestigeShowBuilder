import { p_env_design } from './p_env_design';
import { p_page_direction } from './p_page_direction';

export interface VpsPromptSpec {
  id: string;
  slots: string[];
  render: (inputs: Record<string, string>) => string;
}

const promptRegistry: Record<string, VpsPromptSpec> = {
  p_env_design,
  p_page_direction
};

export function getVpsPrompt(id: string): VpsPromptSpec | undefined {
  return promptRegistry[id];
}
