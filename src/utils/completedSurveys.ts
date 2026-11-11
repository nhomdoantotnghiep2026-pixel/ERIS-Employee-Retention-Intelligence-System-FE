const key = (account: string) => `eris-completed-surveys:${account.trim().toLowerCase()}`;

/** Store identifiers only. Completion and survey details must be verified by the API. */
export function completedSurveyIds(account: string): number[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key(account)) || '[]');
    return Array.isArray(value) ? [...new Set(value.filter((id): id is number => Number.isSafeInteger(id) && id > 0))] : [];
  } catch { return []; }
}
export function rememberCompletedSurvey(account: string, id: number): void {
  if (!account || !Number.isSafeInteger(id) || id < 1) return;
  try { localStorage.setItem(key(account), JSON.stringify([...new Set([...completedSurveyIds(account), id])])); } catch { /* A submitted response remains saved on the server. */ }
}
