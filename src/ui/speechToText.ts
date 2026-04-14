import { getAiText } from './aiLocale';

export type SpeechRecognitionState = 'idle' | 'listening' | 'processing' | 'error' | 'unsupported';

type SpeechToTextOptions = {
  lang: string;
  onResult: (text: string) => void;
  onError: (message: string) => void;
  onStateChange: (state: SpeechRecognitionState) => void;
};

export type SpeechToTextController = {
  isSupported: boolean;
  getState: () => SpeechRecognitionState;
  setLang: (lang: string) => void;
  start: () => void;
  stop: () => void;
  destroy: () => void;
};

type BrowserSpeechRecognitionEvent = Event & {
  results: ArrayLike<{
    isFinal: boolean;
    length: number;
    item: (index: number) => { transcript: string };
    [index: number]: { transcript: string };
  }>;
};

type BrowserSpeechRecognitionErrorEvent = Event & {
  error?: string;
};

type BrowserSpeechRecognition = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: ((event: Event) => void) | null;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: BrowserSpeechRecognitionErrorEvent) => void) | null;
  onend: ((event: Event) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export function isSpeechToTextSupported(): boolean {
  return Boolean(getSpeechRecognitionConstructor());
}

export function createSpeechToTextController(options: SpeechToTextOptions): SpeechToTextController {
  const Recognition = getSpeechRecognitionConstructor();
  if (!Recognition) {
    options.onStateChange('unsupported');
    return {
      isSupported: false,
      getState: () => 'unsupported',
      setLang: () => undefined,
      start: () => undefined,
      stop: () => undefined,
      destroy: () => undefined,
    };
  }

  const recognition = new Recognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.lang = options.lang;

  let state: SpeechRecognitionState = 'idle';
  let finalTranscript = '';
  let destroyed = false;

  const setState = (next: SpeechRecognitionState) => {
    state = next;
    options.onStateChange(next);
  };

  recognition.onstart = () => {
    finalTranscript = '';
    setState('listening');
  };

  recognition.onresult = (event) => {
    let transcript = '';
    for (let i = event.results.length - 1; i >= 0; i -= 1) {
      const result = event.results[i];
      const chunk = result[0]?.transcript || result.item(0)?.transcript || '';
      transcript = chunk || transcript;
      if (result.isFinal && chunk.trim()) {
        finalTranscript = chunk.trim();
        setState('processing');
        break;
      }
    }
    if (!finalTranscript && transcript.trim()) {
      finalTranscript = transcript.trim();
    }
  };

  recognition.onerror = (event) => {
    const message = mapSpeechError(event.error);
    setState('error');
    options.onError(message);
  };

  recognition.onend = () => {
    if (destroyed) return;
    const transcript = finalTranscript.trim();
    finalTranscript = '';
    if (transcript) {
      options.onResult(transcript);
    }
    setState('idle');
  };

  return {
    isSupported: true,
    getState: () => state,
    setLang: (lang: string) => {
      recognition.lang = lang;
    },
    start: () => {
      if (destroyed || state === 'listening') return;
      finalTranscript = '';
      try {
        recognition.start();
      } catch {
        // Ignore duplicate-start errors from browsers with strict gesture handling.
      }
    },
    stop: () => {
      if (destroyed || state !== 'listening') return;
      try {
        setState('processing');
        recognition.stop();
      } catch {
        // Ignore stop errors when the recognition has already ended.
      }
    },
    destroy: () => {
      destroyed = true;
      finalTranscript = '';
      recognition.onstart = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        // Ignore abort errors on already-closed recognizers.
      }
      state = 'idle';
    },
  };
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

function mapSpeechError(code: string | undefined): string {
  const text = getAiText().speech;
  switch (code) {
    case 'audio-capture':
      return text.audioCapture;
    case 'not-allowed':
    case 'service-not-allowed':
      return text.notAllowed;
    case 'no-speech':
      return text.noSpeech;
    case 'network':
      return text.network;
    case 'aborted':
      return text.aborted;
    default:
      return text.fallback;
  }
}
