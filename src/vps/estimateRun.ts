import { Show } from '../types/show';
import { Issue } from '../types/production';

export interface RunEstimate {
  pages: number; envCalls: number; pageCalls: number;
  imageCalls: number; letterCalls: number;
  model: string; note: string;
}

export function estimateIssueDirection(issue: Issue): RunEstimate {
  const pages = issue.acts.flatMap(a => a.scenes)
    .flatMap(s => s.pageBeats).length;
  return { pages, envCalls: 1, pageCalls: pages,
    imageCalls: 0, letterCalls: 0, model: 'gemini-pro',
    note: `${pages + 1} Pro calls to direct this issue.` };
}

export function estimateIssueImages(
  issue: Issue, letter: boolean
): RunEstimate {
  const pages = issue.acts.flatMap(a => a.scenes)
    .flatMap(s => s.pageBeats).length;
  return { pages, envCalls: 0, pageCalls: 0,
    imageCalls: pages, letterCalls: letter ? pages : 0,
    model: 'image', note:
      `${pages}${letter ? ` + ${pages} lettering` : ''} image calls.` };
}

export function estimateShow(
  show: Show, letter: boolean
): RunEstimate {
  const issues = show.issues ?? [];
  return issues.reduce<RunEstimate>((acc, iss) => {
    const d = estimateIssueDirection(iss);
    const im = estimateIssueImages(iss, letter);
    return { pages: acc.pages + d.pages, envCalls: acc.envCalls + d.envCalls,
      pageCalls: acc.pageCalls + d.pageCalls,
      imageCalls: acc.imageCalls + im.imageCalls,
      letterCalls: acc.letterCalls + im.letterCalls,
      model: 'mixed', note: '' };
  }, { pages: 0, envCalls: 0, pageCalls: 0, imageCalls: 0,
    letterCalls: 0, model: 'mixed', note: '' });
}
