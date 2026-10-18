import { useCallback, useEffect, useRef, useState } from 'react';

import { forgetEverything, forgetVideo, loadData, saveData } from '../adapters/storage';
import { forgetPlan, loadPlan, savePlan } from '../adapters/vault';
import { emptyData, type EverydayData, type SafetyPlan } from '../core/types';

// All app data, kept on the phone. Saves are debounced so a burst of changes is one write.
export function useEveryday() {
  const [data, setData] = useState<EverydayData>(() => loadData());
  const [plan, setPlanState] = useState<SafetyPlan | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadPlan().then(setPlanState);
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      saveData(data).catch(() => undefined);
    }, 300);
  }, [data]);

  const update = useCallback((fn: (d: EverydayData) => EverydayData) => setData(fn), []);

  const setPlan = useCallback(async (p: SafetyPlan) => {
    await savePlan(p);
    setPlanState(p);
  }, []);

  // "Let go of everything" really deletes everything.
  const forgetAll = useCallback(async () => {
    data.calls.forEach((c) => c.videoUri && forgetVideo(c.videoUri));
    forgetEverything();
    await forgetPlan().catch(() => undefined);
    setPlanState(null);
    setData(emptyData());
  }, [data.calls]);

  return { data, update, plan, setPlan, forgetAll };
}
