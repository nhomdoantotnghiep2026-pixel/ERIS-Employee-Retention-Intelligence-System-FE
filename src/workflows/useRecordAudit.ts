import { useEffect, useRef } from 'react';
import { recordAudit } from './audit';
export function useRecordAudit<T extends { id: string }>(records: T[], entity: string) {
  const previous = useRef(records);
  useEffect(() => {
    for (const record of records) {
      const before = previous.current.find(item => item.id === record.id);
      if (JSON.stringify(before) !== JSON.stringify(record)) recordAudit(entity, record.id, before ? `Update ${entity}` : `Create ${entity}`, before || null, record);
    }
    for (const record of previous.current) if (!records.some(item => item.id === record.id)) recordAudit(entity, record.id, `Delete ${entity}`, record, null);
    previous.current = records;
  }, [records, entity]);
}
