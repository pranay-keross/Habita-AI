import { useCallback, useEffect, useRef, useState } from 'react';
import useAuth from '../../../../hooks/useAuth';
import { CookMealResponse, DailyMeal, DailyMealPlan } from '../types';
import {
  getDailyMealRemote,
  getDailyMealsRemote,
  markMealCookedRemote,
  pantryErrorMessage,
  refreshDailyMealsRemote,
} from '../api';

interface Options {
  /** Called after cooking deducts stock so the pantry list can reload. */
  onStockChanged?: () => Promise<void> | void;
}

/**
 * Loads and caches "Today's Healthy Meals" for the household. The plan itself is
 * cached server-side per day, so this hook fetches once per mount rather than on
 * every render of the Smart Pantry screen.
 */
export function useDailyMeals({ onStockChanged }: Options = {}) {
  const { getAccessToken, pending, signedIn } = useAuth();

  const [plan, setPlan] = useState<DailyMealPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cookingMealId, setCookingMealId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dietaryPreference, setDietaryPreference] = useState<string>('all');

  // Guards against duplicate in-flight requests (double taps, re-renders).
  const inFlight = useRef(false);

  /**
   * Single fetch path for the plan, so the three entry points can't drift apart:
   * - `initial` shows the full-screen loading state and clears the plan on failure.
   * - `pull`    re-fetches the cached plan behind a refresh spinner, keeping the
   *             meals already on screen if it fails. Costs no refresh quota.
   * - `regenerate` asks the backend for a new plan, consuming one `refreshesLeft`.
   */
  const fetchPlan = useCallback(
    async (preference: string | undefined, mode: 'initial' | 'pull' | 'regenerate') => {
      if (inFlight.current) {
        return;
      }
      inFlight.current = true;
      if (mode === 'initial') {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      try {
        const token = await getAccessToken();
        if (!token) {
          setError('Please sign in to see meal suggestions from your pantry.');
          if (mode === 'initial') {
            setPlan(null);
          }
          return;
        }
        const resolvedPreference = preference !== undefined ? preference : dietaryPreference;
        const result =
          mode === 'regenerate'
            ? await refreshDailyMealsRemote(token, resolvedPreference)
            : await getDailyMealsRemote(token, resolvedPreference);
        setPlan(result);
      } catch (err) {
        setError(pantryErrorMessage(err));
        if (mode === 'initial') {
          setPlan(null);
        }
      } finally {
        inFlight.current = false;
        if (mode === 'initial') {
          setLoading(false);
        } else {
          setRefreshing(false);
        }
      }
    },
    [getAccessToken, dietaryPreference],
  );

  const load = useCallback(
    (preference?: string) => fetchPlan(preference, 'initial'),
    [fetchPlan],
  );

  const refresh = useCallback(
    (preference?: string) => fetchPlan(preference, 'regenerate'),
    [fetchPlan],
  );

  /**
   * Pull-to-refresh / auto-refresh entry point. Regenerating burns one of the
   * household's daily refreshes, so it is only worth it when the plan is actually
   * out of date and quota remains; otherwise this re-reads the cached plan, which
   * is free and still picks up a plan that was generated after the first fetch.
   */
  const refreshPlan = useCallback(async () => {
    const outdated = !plan || plan.stale || plan.pantryEmpty;
    await fetchPlan(undefined, outdated && (plan?.refreshesLeft ?? 0) > 0 ? 'regenerate' : 'pull');
  }, [fetchPlan, plan]);

  const changeDietaryPreference = useCallback(
    async (preference: string) => {
      setDietaryPreference(preference);
      await refresh(preference);
    },
    [refresh],
  );

  /**
   * Re-fetches one meal so the recipe screen shows ingredient availability against
   * the very latest stock. Returns null on failure; the caller keeps the cached meal.
   */
  const loadMealDetail = useCallback(
    async (mealId: string): Promise<DailyMeal | null> => {
      try {
        const token = await getAccessToken();
        if (!token) {
          return null;
        }
        const fresh = await getDailyMealRemote(mealId, token);
        setPlan((prev) =>
          prev
            ? {
                ...prev,
                recommendations: prev.recommendations.map((m) => (m.id === fresh.id ? fresh : m)),
              }
            : prev,
        );
        return fresh;
      } catch (err) {
        console.warn('Failed to refresh meal detail:', err);
        return null;
      }
    },
    [getAccessToken],
  );

  /**
   * Marks a meal cooked. The backend deducts stock; on success the pantry list is
   * reloaded and the plan re-fetched so remaining suggestions reflect new stock.
   */
  const markCooked = useCallback(
    async (meal: DailyMeal): Promise<CookMealResponse | null> => {
      if (cookingMealId) {
        return null;
      }
      setCookingMealId(meal.id);
      setError(null);

      try {
        const token = await getAccessToken();
        if (!token) {
          setError('Please sign in to update your pantry.');
          return null;
        }
        const result = await markMealCookedRemote(meal.id, token);
        await onStockChanged?.();
        await load();
        return result;
      } catch (err) {
        setError(pantryErrorMessage(err));
        return null;
      } finally {
        setCookingMealId(null);
      }
    },
    [getAccessToken, cookingMealId, onStockChanged, load],
  );

  useEffect(() => {
    if (!pending && signedIn) {
      load();
    }
  }, [pending, signedIn, load]);

  return {
    plan,
    meals: plan?.recommendations ?? [],
    loading,
    refreshing,
    cookingMealId,
    error,
    stale: plan?.stale ?? false,
    pantryEmpty: plan?.pantryEmpty ?? false,
    refreshesLeft: plan?.refreshesLeft ?? 0,
    nutritionDisclaimer: plan?.nutritionDisclaimer ?? '',
    dietaryPreference,
    setDietaryPreference: changeDietaryPreference,
    reload: load,
    refresh,
    refreshPlan,
    loadMealDetail,
    markCooked,
  };
}
