'use client';

import React, { useState } from 'react';
import PlyrPlayer from '@/components/stages/PlyrPlayer';

export default function TestVideoPage() {
  const [progress, setProgress] = useState({
    currentTime: 0,
    duration: 0,
    watchPercentage: 0
  });

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Plyr Player Test</h1>
      
      <div className="mb-6">
        <PlyrPlayer
          videoUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
          onProgressUpdate={(prog) => {
            setProgress({
              currentTime: prog.currentTime,
              duration: prog.duration,
              watchPercentage: prog.watchPercentage
            });
          }}
          initialPosition={0}
        />
      </div>

      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="font-semibold mb-2">Progress Info:</h2>
        <p>Current Time: {progress.currentTime.toFixed(2)}s</p>
        <p>Duration: {progress.duration.toFixed(2)}s</p>
        <p>Watch Percentage: {progress.watchPercentage.toFixed(1)}%</p>
      </div>
    </div>
  );
}
