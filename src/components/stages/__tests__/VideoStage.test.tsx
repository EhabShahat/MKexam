import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '@testing-library/jest-dom';
import VideoStage from '../VideoStage';
import type { VideoStageProgress } from '@/lib/types';

// Mock Plyr
vi.mock('plyr', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      currentTime: 0,
      duration: 100,
      on: vi.fn(),
      destroy: vi.fn(),
      play: vi.fn(),
      pause: vi.fn()
    }))
  };
});

describe('VideoStage Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultStage = {
    id: 'stage-1',
    configuration: {
      video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      enforcement_threshold: 80,
      description: 'Watch this video'
    }
  };

  const defaultProgress: VideoStageProgress = {
    watch_percentage: 0,
    total_watch_time: 0,
    last_position: 0,
    watched_segments: []
  };

  it('renders video stage with description', () => {
    const onProgressUpdate = vi.fn();
    const onComplete = vi.fn();

    render(
      <VideoStage
        stage={defaultStage}
        progress={defaultProgress}
        onProgressUpdate={onProgressUpdate}
        onComplete={onComplete}
        disabled={false}
      />
    );

    expect(screen.getByText('Watch this video')).toBeInTheDocument();
  });

  it('displays enforcement information when threshold is set', () => {
    const onProgressUpdate = vi.fn();
    const onComplete = vi.fn();

    render(
      <VideoStage
        stage={defaultStage}
        progress={defaultProgress}
        onProgressUpdate={onProgressUpdate}
        onComplete={onComplete}
        disabled={false}
      />
    );

    // Enforcement UI should not be displayed
    expect(screen.queryByText(/Watch Progress:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Required:/)).not.toBeInTheDocument();
  });

  it('does not show requirement met badge', () => {
    const onProgressUpdate = vi.fn();
    const onComplete = vi.fn();

    const progressWithThresholdMet: VideoStageProgress = {
      watch_percentage: 90,
      total_watch_time: 90,
      last_position: 90,
      watched_segments: [[0, 90]]
    };

    render(
      <VideoStage
        stage={defaultStage}
        progress={progressWithThresholdMet}
        onProgressUpdate={onProgressUpdate}
        onComplete={onComplete}
        disabled={false}
      />
    );

    // Requirement badge should not be displayed
    expect(screen.queryByText('✓ Requirement Met')).not.toBeInTheDocument();
  });
});
