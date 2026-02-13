# Plyr Integration for Video Stages

## Overview

The video stage system now uses **Plyr** (https://github.com/sampotts/plyr) for YouTube video playback. Plyr is a lightweight, accessible, and customizable HTML5 media player with excellent YouTube support.

## Why Plyr?

- **Lightweight**: ~15KB gzipped, much smaller than Video.js
- **Accessibility**: Built-in WCAG compliance with ARIA labels and keyboard navigation
- **YouTube Support**: Native YouTube iframe integration with consistent UI
- **Customizable**: Easy theming and control customization
- **Mobile-Friendly**: Responsive design with touch controls
- **Modern**: Active development with regular updates

## Installation

```bash
npm install --legacy-peer-deps plyr plyr-react
```

## Architecture

### Components

1. **PlyrPlayer** (`src/components/stages/PlyrPlayer.tsx`)
   - Core Plyr wrapper component
   - Handles YouTube video playback
   - Tracks watch progress and segments
   - Calculates watch percentage
   - Manages player lifecycle

2. **VideoStage** (`src/components/stages/VideoStage.tsx`)
   - Uses PlyrPlayer for video rendering
   - Implements enforcement logic
   - Manages stage completion
   - Handles progress updates

## Features

### Progress Tracking

The player tracks:
- Current playback position
- Total video duration
- Watched segments (non-overlapping intervals)
- Watch percentage (calculated from segments)

### Enforcement Thresholds

Administrators can set a minimum watch percentage required before students can proceed:
- 0-100% threshold
- Visual progress indicator
- Disabled continue button until threshold met
- Audit logging for enforcement violations

### YouTube URL Support

Supported formats:
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`
- Direct video ID: `VIDEO_ID`

## Usage

### Basic Implementation

```tsx
import PlyrPlayer from '@/components/stages/PlyrPlayer';

<PlyrPlayer
  videoUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  onProgressUpdate={(progress) => {
    console.log('Watch percentage:', progress.watchPercentage);
    console.log('Current time:', progress.currentTime);
    console.log('Duration:', progress.duration);
  }}
  initialPosition={0}
/>
```

### Props Interface

```typescript
interface PlyrPlayerProps {
  videoUrl: string;              // YouTube URL
  onProgressUpdate: (progress: {
    currentTime: number;         // Current playback position in seconds
    duration: number;            // Total video duration in seconds
    watchedSegments: [number, number][]; // Array of [start, end] segments
    watchPercentage: number;     // Calculated watch percentage (0-100)
  }) => void;
  initialPosition?: number;      // Starting position in seconds
  className?: string;            // Additional CSS classes
}
```

## Configuration

### Plyr Options

The player is initialized with:

```javascript
{
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
    noCookie: true,           // Use youtube-nocookie.com
    rel: 0,                   // Don't show related videos
    showinfo: 0,              // Hide video info
    iv_load_policy: 3,        // Hide annotations
    modestbranding: 1         // Minimal YouTube branding
  },
  ratio: '16:9',
  fullscreen: {
    enabled: true,
    fallback: true,
    iosNative: true
  }
}
```

### Customization

You can customize the player appearance by modifying the CSS in `PlyrPlayer.tsx` or by overriding Plyr's CSS variables:

```css
:root {
  --plyr-color-main: #1e40af;
  --plyr-video-background: #000;
  --plyr-control-radius: 4px;
}
```

## Progress Tracking Algorithm

### Segment Merging

Watched segments are automatically merged to prevent overlaps:

```typescript
// Input: [[0, 10], [5, 15], [20, 30]]
// Output: [[0, 15], [20, 30]]
```

### Watch Percentage Calculation

```typescript
watchPercentage = (totalWatchedTime / videoDuration) * 100
```

Where `totalWatchedTime` is the sum of all merged segment durations.

## Testing

### Test Page

A test page is available at `/test-video` to verify the Plyr integration:

```bash
npm run dev
# Navigate to http://localhost:3000/test-video
```

### Unit Tests

Run the VideoStage component tests:

```bash
npm run test:run -- src/components/stages/__tests__/VideoStage.test.tsx
```

## Accessibility

Plyr provides built-in accessibility features:
- ARIA labels for all controls
- Keyboard navigation (Space, Arrow keys, M for mute, F for fullscreen)
- Screen reader announcements
- Focus management
- High contrast mode support

## RTL Support

The player automatically adapts to RTL layouts:

```css
[dir="rtl"] .plyr-player-wrapper :global(.plyr__controls) {
  direction: ltr;
}
```

## Performance

- Initial load: ~15KB (Plyr core)
- Memory usage: ~30MB during playback
- CPU usage: Minimal (handled by YouTube iframe)
- Progress tracking: Updates every 2 seconds

## Browser Support

Plyr supports all modern browsers:
- Chrome/Edge: Latest 2 versions
- Firefox: Latest 2 versions
- Safari: Latest 2 versions
- iOS Safari: iOS 10+
- Android Chrome: Android 5+

## Migration from Video.js

### Key Changes

1. **Import**: Changed from `VideoJSPlayer` to `PlyrPlayer`
2. **Props**: Same interface, no changes needed
3. **Styling**: Plyr uses different CSS classes
4. **Bundle Size**: Reduced from ~200KB to ~15KB

### Updated Files

- `src/components/stages/PlyrPlayer.tsx` (new)
- `src/components/stages/VideoStage.tsx` (updated import)
- `src/app/test-video/page.tsx` (updated import)
- `src/components/stages/__tests__/VideoStage.test.tsx` (updated mocks)

### Removed Files

- `src/components/stages/VideoJSPlayer.tsx`
- `src/lib/videojs-loader.ts`
- `VIDEO_JS_INTEGRATION.md`
- `VIDEOJS_ISSUE_RESOLUTION.md`
- `VIDEO_PLAYER_UPDATE.md`

### Removed Dependencies

```bash
npm uninstall video.js @videojs/http-streaming videojs-youtube @types/video.js
```

## Troubleshooting

### Video Not Loading

1. Verify YouTube URL is valid and video is publicly accessible
2. Check browser console for errors
3. Ensure Plyr CSS is loaded
4. Verify YouTube iframe API is not blocked by ad blockers

### Progress Not Tracking

1. Check that `onProgressUpdate` callback is provided
2. Verify video is playing (not paused)
3. Check browser console for tracking errors
4. Ensure progress interval is running (every 2 seconds)

### Invalid YouTube URL Error

The player validates YouTube URLs. Ensure the URL matches one of these formats:
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`

## Resources

- [Plyr Documentation](https://github.com/sampotts/plyr)
- [Plyr API Reference](https://github.com/sampotts/plyr#api)
- [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
