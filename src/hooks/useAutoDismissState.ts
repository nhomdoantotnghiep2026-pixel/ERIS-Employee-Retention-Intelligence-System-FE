import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * State for short-lived page feedback. The timer is replaced whenever the
 * message changes and is cleaned up when the owning component unmounts.
 */
export function useAutoDismissState(delayMs = 4000): [string, Dispatch<SetStateAction<string>>] {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (!value) return;
    const timeoutId = window.setTimeout(() => setValue(''), delayMs);
    return () => window.clearTimeout(timeoutId);
  }, [delayMs, value]);

  return [value, setValue];
}

/** Keeps success/information and error feedback mutually exclusive. */
export function useAutoDismissFeedback(errorDelayMs = 7000, messageDelayMs = 4000) {
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
