'use client';

import React, { useEffect } from 'react';
import type { VideoStageConfig, VideoStageProgress } from '@/lib/types';
import PlyrPlayer from './PlyrPlayer';

interface VideoStageProps {
  stage: { id: string; configuration: VideoStageConfig };
  progress: VideoStageProgress;
  onProgressUpdate: (progress: VideoStageProgress) => void;
  onComplete: () => void;
  disabled: boolean;
  logActivity?: (activity: string, details?: any) => void;
}

const VideoStage: React.FC<VideoStageProps> = ({
  stage,
  progress,
  onProgressUpdate,
  onComplete,
  disabled,
  logActivity
}) => {
  // Auto-complete when video stage is loaded (no enforcement)
  useEffect(() => {
    onComplete();
  }, [onComplete]);

  return (
    <div className="video-stage" role="region" aria-label="Video stage">
      {stage.configuration.description && (
        <div className="mb-4">
          <p className="text-gray-700">{stage.configuration.description}</p>
        </div>
      )}

      <div className="video-container mb-6" role="group" aria-label="Video player">
        <PlyrPlayer
          videoUrl={stage.configuration.video_url}
          initialPosition={0}
          onProgressUpdate={() => {
            // No-op: progress tracking disabled
          }}
          className="w-full"
        />
      </div>

      <style jsx>{`
        .video-stage {
          width: 100%;
        }

        .video-container {
          max-width: 100%;
          overflow: hidden;
        }

        /* RTL Support */
        [dir="rtl"] .video-stage {
          direction: rtl;
        }

        @media (max-width: 480px) {
          .video-stage {
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
};

export default VideoStage;
