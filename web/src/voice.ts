// Dictée vocale avec la Web Speech API du navigateur (Chrome, Edge, Safari).
// Rien n'est envoyé à nos serveurs : la transcription est faite par le navigateur.

type Alternative = { transcript: string };
type Result = { isFinal: boolean; 0: Alternative };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<Result> };

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

type RecognitionConstructor = new () => Recognition;

function constructor(): RecognitionConstructor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function voiceSupported(): boolean {
  return Boolean(constructor());
}

export type Dictation = { stop(): void };

// onText reçoit le texte final déjà dicté et la partie en cours de reconnaissance
export function dictate(handlers: {
  onText: (finalText: string, interim: string) => void;
  onEnd: () => void;
  onError: (message: string) => void;
}): Dictation | null {
  const Ctor = constructor();
  if (!Ctor) return null;
  const recognition = new Ctor();
  recognition.lang = 'fr-FR';
  recognition.continuous = true;
  recognition.interimResults = true;
  let finalText = '';
  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) finalText += result[0].transcript;
      else interim += result[0].transcript;
    }
    handlers.onText(finalText, interim);
  };
  recognition.onerror = (event) => {
    const messages: Record<string, string> = {
      'not-allowed':
        'Le micro est bloqué. Autorisez-le dans votre navigateur, ou écrivez votre demande.',
      'no-speech': 'Je n’ai rien entendu. Réessayez ou écrivez votre demande.',
      network:
        'La dictée a besoin d’une connexion. Vous pouvez écrire votre demande.',
    };
    handlers.onError(messages[event.error] ?? 'La dictée s’est interrompue.');
  };
  recognition.onend = handlers.onEnd;
  recognition.start();
  return { stop: () => recognition.stop() };
}
