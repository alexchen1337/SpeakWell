'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useAuth } from '@/contexts/AuthContext';

const WAVEFORM = [
  12, 28, 45, 62, 78, 90, 72, 55, 38, 58, 80, 95, 82, 65, 48, 32, 52, 72, 88, 78,
  58, 38, 48, 68, 85, 95, 75, 52, 35, 58, 78, 88, 68, 48, 30, 48, 68, 82, 72, 58,
  42, 62, 78, 88, 72, 52, 36, 58, 72, 88, 78, 62, 45, 30, 52, 68, 82, 72, 55, 40,
];

const CRITERIA = [
  { label: 'Content', score: 88 },
  { label: 'Delivery', score: 74 },
  { label: 'Clarity', score: 91 },
];

const PLAYED_BARS = 26;

export default function Landing() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, loading, router]);

  return (
    <div className="landing-root">
      {/* Animated background */}
      <div className="landing-bg" aria-hidden="true">
        <div className="landing-bg-grid" />
        <div className="landing-bg-orb landing-bg-orb-1" />
        <div className="landing-bg-orb landing-bg-orb-2" />
        <div className="landing-bg-orb landing-bg-orb-3" />
      </div>

      {/* Nav */}
      <motion.nav
        className="landing-nav"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      >
        <span className="landing-brand">SpeakWell</span>
        <motion.button
          className="landing-login-btn"
          onClick={() => router.push('/login')}
          whileHover={{ scale: 1.04, boxShadow: '0 4px 20px rgba(255, 130, 0, 0.3)' }}
          whileTap={{ scale: 0.97 }}
        >
          Log in
        </motion.button>
      </motion.nav>

      {/* Hero */}
      <main className="landing-hero">
        {/* Left zone */}
        <div className="landing-hero-left">
          <motion.div
            className="landing-eyebrow"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          >
            Powered by AI
          </motion.div>

          <motion.h1
            className="landing-headline"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.65, ease: [0.4, 0, 0.2, 1] }}
          >
            Grade every
            <br />
            <span className="landing-headline-accent">word.</span>
          </motion.h1>

          <motion.p
            className="landing-subtext"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38, duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          >
            Upload your presentation audio. Get instant AI feedback on content,
            delivery, and clarity — with detailed rubric scoring.
          </motion.p>

          <motion.div
            className="landing-cta-row"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
          >
            <motion.button
              className="landing-cta-primary"
              onClick={() => router.push('/login')}
              whileHover={{ scale: 1.04, boxShadow: '0 8px 32px rgba(255, 130, 0, 0.35)' }}
              whileTap={{ scale: 0.97 }}
            >
              Start for free
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </motion.button>
          </motion.div>
        </div>

        {/* Right zone — product mockup */}
        <motion.div
          className="landing-hero-right"
          initial={{ opacity: 0, x: 40, y: 8 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          transition={{ delay: 0.3, duration: 0.85, ease: [0.4, 0, 0.2, 1] }}
        >
          <div className="landing-mockup">
            {/* Window chrome */}
            <div className="lm-chrome">
              <div className="lm-dots">
                <span className="lm-dot lm-dot-r" />
                <span className="lm-dot lm-dot-y" />
                <span className="lm-dot lm-dot-g" />
              </div>
              <span className="lm-filename">Q4 Sales Pitch.mp3</span>
              <span className="lm-score-badge">87 / 100</span>
            </div>

            {/* Waveform */}
            <div className="lm-waveform">
              {WAVEFORM.map((h, i) => (
                <div
                  key={i}
                  className={`lm-waveform-bar${i < PLAYED_BARS ? ' played' : ''}`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>

            {/* Transport controls */}
            <div className="lm-transport">
              <div className="lm-play-btn">
                <svg fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div className="lm-timeline">
                <span className="lm-time">2:34</span>
                <div className="lm-track">
                  <div className="lm-track-fill" />
                  <div className="lm-track-handle" />
                </div>
                <span className="lm-time">5:47</span>
              </div>
            </div>

            <div className="lm-divider" />

            {/* Rubric scores */}
            <div className="lm-scores">
              <div className="lm-scores-header">
                <span>Rubric Scores</span>
                <span className="lm-overall">
                  Overall: <strong>87</strong>
                </span>
              </div>
              {CRITERIA.map((c) => (
                <div key={c.label} className="lm-criterion">
                  <span className="lm-criterion-label">{c.label}</span>
                  <div className="lm-criterion-track">
                    <div
                      className="lm-criterion-fill"
                      style={{ width: `${c.score}%` }}
                    />
                  </div>
                  <span className="lm-criterion-score">{c.score}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
