import { environment_design } from './environment_design';
import { page_direction } from './page_direction';

export interface VpsParserSpec {
  id: string;
  parse: (raw: string) => { ok: true; payload: any } | { ok: false; error: string };
}

const parserRegistry: Record<string, VpsParserSpec> = {
  environment_design,
  page_direction
};

export function getVpsParser(id: string): VpsParserSpec | undefined {
  return parserRegistry[id];
}
