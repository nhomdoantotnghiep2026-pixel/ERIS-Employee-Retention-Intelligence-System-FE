import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * State for short-lived page feedback. The timer is replaced whenever the
 * message changes and is cleaned up when the owning component unmounts.
 */
export function useAutoDismissState(delayMs = 5500): [string, Dispatch<SetStateAction<string>>] {
  const [state, setState] = useState({ value: '', revision: 0 });
  const setValue = useCallback<Dispatch<SetStateAction<string>>>((next) => {
    setState(current => ({ value: typeof next === 'function' ? next(current.value) : next, revision: current.revision + 1 }));
  }, []);

  useEffect(() => {
    if (!state.value) return;
    const timeoutId = window.setTimeout(() => setValue(''), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [delayMs, state, setValue]);

  return [state.value, setValue];
}

/** Keeps success/information and error feedback mutually exclusive. */
export function useAutoDismissFeedback(errorDelayMs = 5500, messageDelayMs = 5500) {
  const [error, setErrorValue] = useAutoDismissState(errorDelayMs);
  const [message, setMessageValue] = useAutoDismissState(messageDelayMs);
  const setError = useCallback((value: string) => {
    setErrorValue(value);
    if (value) setMessageValue('');
  }, [setErrorValue, setMessageValue]);
  const setMessage = useCallback((value: string) => {
    setMessageValue(value);
    if (value) setErrorValue('');
  }, [setErrorValue, setMessageValue]);

  return { error, message, setError, setMessage };
}
