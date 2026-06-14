import { VpsPassSpec, VpsRecordType } from './types';

export const VPS_PASSES: Record<string, VpsPassSpec> = {
  'env': {
    id: 'env',
    phase: 'environment',
    name: 'Environment Design',
    description: 'Establish the layout, light character, and atmosphere of the settings.',
    scope: 'issue',
    promptTemplateId: 'p_env_design',
    parserId: 'environment_design',
    outputRecordType: VpsRecordType.ENVIRONMENT_DESIGN,
    outputPayloadVersion: 1,
    defaultModel: 'gemini-flash',
    defaultTemperature: 0.5,
  },
  'page': {
    id: 'page',
    phase: 'page_direction',
    name: 'Page Direction',
    description: 'Direct each page\'s panels: shot, depth, relational blocking, expression, dialogue allocation, direct address.',
    scope: 'page',
    promptTemplateId: 'p_page_direction',
    parserId: 'page_direction',
    outputRecordType: VpsRecordType.PAGE_DIRECTION,
    outputPayloadVersion: 1,
    defaultModel: 'gemini-pro',
    defaultTemperature: 0.75,
  },
};

export const VPS_PASS_ORDER = ['env', 'page'];
