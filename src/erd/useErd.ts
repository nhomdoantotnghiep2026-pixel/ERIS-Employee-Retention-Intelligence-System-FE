import { useSyncExternalStore } from 'react';
import { ERD_EVENT, readDatabase } from './database';
const subscribe = (callback: () => void) => { window.addEventListener(ERD_EVENT,callback); return () => window.removeEventListener(ERD_EVENT,callback); };
export function useErd() { return useSyncExternalStore(subscribe, readDatabase, readDatabase); }
