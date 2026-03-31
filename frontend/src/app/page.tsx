'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function Landing() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const [videoReady, setVideoReady] = useState(false);
  const [contentReady, setContentReady] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, loading, router]);

  return (
    <div className="landing-root">
      <video
        className={`landing-video-bg${videoReady ? ' is-ready' : ''}`}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        onCanPlay={() => {
          setVideoReady(true);
          setTimeout(() => setContentReady(true), 800);
        }}
      >
        <source
          src="https://ookotoxfaxedzscrgthj.supabase.co/storage/v1/object/public/landing-page/Timeline%201.mp4"
          type="video/mp4"
        />
      </video>
      <div className="landing-video-tint" aria-hidden="true" />

      {contentReady && (
        <>
          <nav className="landing-nav">
            <span className="landing-brand">SpeakWell</span>
            <button className="landing-pill landing-pill--orange landing-pill--sm" onClick={() => router.push('/login')}>
              Log in / Register
            </button>
          </nav>

          <main className="landing-hero">
            <h1 className="landing-headline animate-fade-rise">
              Your Next Presentation
              <br />
              Could Be Your <em className="landing-headline-accent">Best One Yet</em>
            </h1>

            <div className="landing-cta-row animate-fade-rise-delay">
              <a
                className="landing-pill landing-pill--orange"
                href="https://github.com/alexchen1337/SpeakWell"
                target="_blank"
                rel="noopener noreferrer"
              >
                View Demo
              </a>
              <button className="landing-pill" onClick={() => router.push('/login')}>
                Get Started
              </button>
            </div>
          </main>
        </>
      )}
    </div>
  );
}
