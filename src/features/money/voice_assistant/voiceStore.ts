import { getItem, setItem, removeItem } from '../../../utils/storage';
import type { VoiceIntent, VoiceSettings } from './types';

const STORAGE_KEY = 'habita.voice_history';
const SETTINGS_KEY = 'habita.voice_settings';

const INITIAL_HISTORY: VoiceIntent[] = [
  {
    id: 'v_1',
    transcript: 'Add ₹650 for lunch split equally with Rahul and Priya',
    targetModule: 'money',
    actionSummary: 'Created ₹650 expense in Office Lunch Crew',
    timestamp: 'Today, 1:15 PM',
    confidence: 0.98,
  },
  {
    id: 'v_2',
    transcript: 'Check when my passport expires',
    targetModule: 'dochub',
    actionSummary: 'Retrieved Indian Passport (Expires 2030-04-11)',
    timestamp: 'Yesterday, 6:40 PM',
    confidence: 0.95,
  },
  {
    id: 'v_3',
    transcript: 'Remind me to take Metformin 500mg tonight at 9 PM',
    targetModule: 'medicine',
    actionSummary: 'Scheduled Night Medicine Reminder',
    timestamp: '12 Aug, 8:00 AM',
    confidence: 0.99,
  },
];

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  language: 'en',
  recognitionMode: 'cloud',
  soundFeedback: true,
  autoSubmit: false,
  noiseCancellation: true,
  wakeWordEnabled: true,
  saveHistory: true,
};

export async function loadVoiceHistory(): Promise<VoiceIntent[]> {
  const data = await getItem<VoiceIntent[]>(STORAGE_KEY, INITIAL_HISTORY);
  if (!data || data.length === 0) {
    await saveVoiceHistory(INITIAL_HISTORY);
    return INITIAL_HISTORY;
  }
  return data;
}

export async function saveVoiceHistory(history: VoiceIntent[]): Promise<void> {
  await setItem(STORAGE_KEY, history);
}

export async function clearVoiceHistory(): Promise<void> {
  await removeItem(STORAGE_KEY);
}

export async function loadVoiceSettings(): Promise<VoiceSettings> {
  return await getItem<VoiceSettings>(SETTINGS_KEY, DEFAULT_VOICE_SETTINGS);
}

export async function saveVoiceSettings(settings: VoiceSettings): Promise<void> {
  await setItem(SETTINGS_KEY, settings);
}
