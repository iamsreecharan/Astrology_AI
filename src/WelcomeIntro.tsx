import { useEffect, useRef } from 'react';
import './WelcomeIntro.css';

type WelcomeIntroProps = {
  onEnter: () => void;
};

export default function WelcomeIntro({ onEnter }: WelcomeIntroProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const enterRef = useRef<HTMLButtonElement>(null);

  function enterAstral() {
    dialogRef.current?.close();
    onEnter();
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousOverflow = document.body.style.overflow;
    const ownsScrollLock = previousOverflow !== 'hidden';
    if (ownsScrollLock) document.body.style.overflow = 'hidden';
    if (!dialog.open) dialog.showModal();
    enterRef.current?.focus({ preventScroll: true });

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
      className="welcome-intro"
      aria-labelledby="welcome-intro-title"
      aria-describedby="welcome-intro-description"
      onCancel={(event) => {
        event.preventDefault();
        enterAstral();
      }}
    >
      <div className="welcome-intro-layout">
        <div className="welcome-intro-topline">
          <div className="welcome-intro-brand" aria-label="Astral">
            <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M16 2.5 19.5 12.5 29.5 16 19.5 19.5 16 29.5 12.5 19.5 2.5 16 12.5 12.5 16 2.5Z" stroke="currentColor" strokeWidth="1.25" />
              <circle cx="16" cy="16" r="4" stroke="currentColor" strokeWidth="1.1" />
            </svg>
            <span>Astral<span className="welcome-intro-brand-period">.</span></span>
          </div>
          <button type="button" className="welcome-intro-skip" onClick={enterAstral}>
            Skip intro
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M5 15 15 5M5 5h10v10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <section className="welcome-intro-copy">
          <p className="welcome-intro-eyebrow">
            <span aria-hidden="true">✧</span>
            A universe of possibilities
          </p>
          <h1 id="welcome-intro-title" className="welcome-intro-title">
            Welcome to a world moved by the <em>cosmos.</em>
          </h1>
          <p id="welcome-intro-description" className="welcome-intro-description">
            Ancient wisdom meets a universe in motion. Find a little perspective in the stars.
          </p>
          <button ref={enterRef} type="button" className="welcome-intro-enter" autoFocus onClick={enterAstral}>
            Enter Astral
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 12h15M13 5l7 7-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </section>

        <div className="welcome-intro-bottom">
          <span className="welcome-intro-tagline"><span aria-hidden="true" />Written in the stars. Explored by you.</span>
          <span className="welcome-intro-copyright">© {new Date().getFullYear()} Sree Charan Reddy Kailasam</span>
        </div>
      </div>
    </dialog>
  );
}
