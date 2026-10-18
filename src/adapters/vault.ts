import * as SecureStore from 'expo-secure-store';

import type { SafetyPlan } from '../core/types';

// The safety plan and trusted person live in the OS keychain / keystore.
const KEY = 'everyday.safetyPlan';

export async function loadPlan(): Promise<SafetyPlan | null> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as SafetyPlan) : null;
  } catch {
    return null;
  }
}

export async function savePlan(plan: SafetyPlan): Promise<void> {
  await SecureStore.setItemAsync(KEY, JSON.stringify(plan));
}

export async function forgetPlan(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
