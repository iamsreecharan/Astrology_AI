import { lazy, Suspense, useEffect, useRef } from 'react';
import './PersonalizationPrompt.css';

const AiYogiAvatar = lazy(() => import('./AiYogiAvatar'));

function YogiSilhouette() {
  return (
    <div className="personalization-prompt-loading" aria-hidden="true">
      <svg viewBox="0 0 260 260" focusable="false">
        <circle cx="130" cy="87" r="58" fill="none" stroke="#d6b37b" strokeOpacity=".6" strokeWidth=".8" />
        <path d="M103 127Q81 138 79 174L49 188H211L181 174Q179 138 157 127Z" fill="#cc702f" />
        <path d="M94 153Q78 171 20 182M166 153Q182 171 240 182" fill="none" stroke="#c18a64" strokeWidth="15" strokeLinecap="round" />
        <ellipse cx="17" cy="185" rx="12" ry="8" fill="#c18a64" />
        <ellipse cx="243" cy="185" rx="12" ry="8" fill="#c18a64" />
        <ellipse cx="130" cy="79" rx="32" ry="41" fill="#c18a64" />
        <path d="M99 66Q99 37 130 38Q161 37 161 66Q145 49 130 49Q115 49 99 66M100 95Q103 132 130 151Q157 132 160 95Q149 106 141 105Q130 110 119 105Q108 106 100 95" fill="#e9e1cb" />
        <ellipse cx="130" cy="38" rx="17" ry="12" fill="#e9e1cb" />
        <path d="M111 78Q117 74 123 78M139 78Q145 74 151 78" fill="none" stroke="#423226" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

type PersonalizationPromptProps = {
  onPersonalize: () => void;
  onSkip: () => void;
};

export default function PersonalizationPrompt({ onPersonalize, onSkip }: PersonalizationPromptProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const personalizeRef = useRef<HTMLButtonElement>(null);

  function leavePrompt(personalize: boolean) {
    dialogRef.current?.close();
    if (personalize) onPersonalize();
    else onSkip();
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    const ownsScrollLock = previousOverflow !== 'hidden';
    if (ownsScrollLock) document.body.style.overflow = 'hidden';
    if (!dialog.open) dialog.showModal();
    personalizeRef.current?.focus({ preventScroll: true });
    return () => {
      if (dialog.open) dialog.close();
      if (ownsScrollLock && document.body.style.overflow === 'hidden') {
        document.body.style.overflow = previousOverflow;
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="personalization-prompt"
      aria-labelledby="personalization-prompt-title"
      aria-describedby="personalization-prompt-description"
      onCancel={(event) => {
        event.preventDefault();
        leavePrompt(false);
      }}
    >
      <div className="personalization-prompt-layout">
        <button type="button" className="personalization-prompt-close" aria-label="Skip personalization" onClick={() => leavePrompt(false)}>
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
        </button>
        <div className="personalization-prompt-portrait">
          <Suspense fallback={<YogiSilhouette />}><AiYogiAvatar state="idle" pose="holding-card" /></Suspense>
        </div>
        <section className="personalization-prompt-card">
          <p className="personalization-prompt-eyebrow"><span aria-hidden="true">✧</span> A little introduction from AI Yogi</p>
          <h2 id="personalization-prompt-title">Your stars, your story.</h2>
          <p id="personalization-prompt-description">Share your birth date, time and place to explore your own Vedic chart.</p>
          <button ref={personalizeRef} type="button" className="personalization-prompt-primary" autoFocus onClick={() => leavePrompt(true)}>
            Personalize my astrology
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M3 10h13m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" className="personalization-prompt-skip" onClick={() => leavePrompt(false)}>Skip for now</button>
          <p className="personalization-prompt-note">You can explore without adding details.</p>
        </section>
      </div>
    </dialog>
  );
}
