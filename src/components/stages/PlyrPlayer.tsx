'use client';

import React, { useEffect, useRef, useState } from 'react';
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';

interface PlyrPlayerProps {
  videoUrl: string;
  onProgressUpdate: (progress: {
    currentTime: number;
    duration: number;
    watchedSegments: [number, number][];
    watchPercentage: number;
  }) => void;
  initialPosition?: number;
  className?: string;
}

// Extract YouTube video ID from URL
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  
  return null;
}

export default function PlyrPlayer({
  videoUrl,
  onProgressUpdate,
  initialPosition = 0,
  className = ''
}: PlyrPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<Plyr | null>(null);
  
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const videoId = extractYouTubeId(videoUrl);

  // Initialize Plyr player
  useEffect(() => {
    if (!containerRef.current || !videoId) {
      setError('Invalid YouTube URL');
      return;
    }

    let mounted = true;

    try {
      // Create Plyr instance
      const player = new Plyr(containerRef.current, {
        controls: [
          'play-large',
          'play',
          'progress',
          'current-time',
          'duration',
          'mute',
          'volume',
          'settings',
          'fullscreen'
        ],
        youtube: {
          noCookie: true,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          modestbranding: 1
        },
        ratio: '16:9',
        fullscreen: {
          enabled: true,
          fallback: true,
          iosNative: true
        }
      });

      playerRef.current = player;

      // Handle player ready
      player.on('ready', () => {
        if (!mounted) return;
        console.log('Plyr player ready');
        setIsReady(true);
      });

      // Handle errors
      player.on('error', (event: any) => {
        console.error('Plyr error:', event);
        setError('Video playback error');
      });

    } catch (err) {
      console.error('Error initializing Plyr:', err);
      setError('Failed to initialize video player');
    }

    // Cleanup
    return () => {
      mounted = false;
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoId]);

  if (error) {
    return (
      <div className="text-red-500 p-4 bg-red-50 border border-red-200 rounded-lg">
        {error}
      </div>
    );
  }

  if (!videoId) {
    return (
      <div className="text-red-500 p-4 bg-red-50 border border-red-200 rounded-lg">
        Invalid YouTube URL. Please provide a valid YouTube video link.
      </div>
    );
  }

  return (
    <div className={`plyr-player-wrapper ${className}`}>
      <div
        ref={containerRef}
        data-plyr-provider="youtube"
        data-plyr-embed-id={videoId}
      />

      <style jsx>{`
        .plyr-player-wrapper {
          width: 100%;
          border-radius: 0.5rem;
          overflow: hidden;
          background: #000;
        }

        .plyr-player-wrapper :global(.plyr) {
          border-radius: 0.5rem;
        }

        /* RTL Support */
        [dir="rtl"] .plyr-player-wrapper :global(.plyr__controls) {
          direction: ltr;
        }
      `}</style>
    </div>
  );
}
