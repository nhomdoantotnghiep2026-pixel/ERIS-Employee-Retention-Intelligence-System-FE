export interface AuditEntry { id: string; user_id: string; user_name: string; entity_type: string; entity_id: string; action: string; old_value: unknown; new_value: unknown; created_at: string }
export const AUDIT_EVENT = 'eris-workflow-audit';
export function readAudit(): AuditEntry[] {
  const db = readDatabase();
  return [...db.audit_logs].reverse().map(row => ({ ...row,user_name:String(db.users.find(user => user.id === row.user_id)?.email || 'Unknown account') })) as unknown as AuditEntry[];
}
export function recordAudit(entity_type: string, entity_id: string, action: string, old_value: unknown = null, new_value: unknown = null) {
  let user = { email: 'system', name: 'System' };
  try { user = JSON.parse(sessionStorage.getItem('eris-user') || 'null') || user; } catch { /* Demo session unavailable. */ }
  const actor = actorRow(user.email);
  if (!actor) return;
  const safe = (value:unknown) => JSON.parse(JSON.stringify(value ?? null,(key,item) => key === 'password' ? undefined:item));
  const entry = makeRow('audit_logs',{ user_id:actor.id,entity_type,entity_id,action,old_value:safe(old_value),new_value:safe(new_value) });
  transactDatabase(db => { db.audit_logs.push(entry); });
  window.dispatchEvent(new Event(AUDIT_EVENT));
}
import { actorRow, makeRow, readDatabase, transactDatabase } from '../erd/database';
