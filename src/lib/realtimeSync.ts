export interface DebouncedRefetch {
  schedule: (immediate?: boolean) => void;
  cancel: () => void;
}

/** Coalesces event bursts while preserving an immediate resume/reconnect path. */
export function createDebouncedRefetch(
  callback: () => void,
  delayMs = 120
): DebouncedRefetch {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  return {
    schedule(immediate = false) {
      cancel();
      timer = setTimeout(() => {
        timer = null;
        callback();
      }, immediate ? 0 : delayMs);
    },
    cancel,
  };
}
