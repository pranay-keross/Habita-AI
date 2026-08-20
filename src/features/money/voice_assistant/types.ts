export interface VoiceIntent {
  id: string;
  transcript: string;
  targetModule: 'money' | 'medicine' | 'pantry' | 'dochub' | 'wardrobe' | 'family';
  actionSummary: string;
  timestamp: string;
  confidence: number;
}

export interface VoiceSettings {
  language: 'en' | 'hi' | 'bn' | 'ta' | 'es' | 'ar';
  recognitionMode: 'cloud' | 'offline';
  soundFeedback: boolean;
  autoSubmit: boolean;
  noiseCancellation: boolean;
  wakeWordEnabled: boolean;
  saveHistory: boolean;
}
