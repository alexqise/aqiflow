export const focusElapsed = (f: { startedAt: number; pausedAt: number | null; elapsedBefore: number }) =>
  f.elapsedBefore + ((f.pausedAt ?? Date.now()) - f.startedAt);

export const fmtClock = (ms: number) => {
  const total = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};
