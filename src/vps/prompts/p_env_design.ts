export const p_env_design = {
  id: 'p_env_design',
  slots: ['SETTINGS_LIST', 'REGISTER_GUIDANCE'],
  render: (i: Record<string, string>) => `You are designing environments/settings for a comic issue.
${i.REGISTER_GUIDANCE ? i.REGISTER_GUIDANCE + '\n\n' : ''}For each distinct setting listed below, provide:
1. settingName: matches the name exactly
2. settingAnchorId: (optional) resolved anchor id if matches an existing one
3. source: 'reused' or 'generated'
4. visualDescription: image-ready visual description of the layout, materials, light, and lived-in details
5. mood: emotional atmosphere of the place
6. interiorExterior: 'interior' or 'exterior' or 'mixed'

Distinct settings to design:
${i.SETTINGS_LIST}

Return JSON only:
\`\`\`json
{
  "environments": [
    {
      "settingName": "...",
      "source": "generated",
      "visualDescription": "...",
      "mood": "...",
      "interiorExterior": "interior"
    }
  ]
}
\`\`\``
};
