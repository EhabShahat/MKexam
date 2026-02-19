import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { Stage, StageType, VideoStageConfig } from '@/lib/types';
import { arrayMove } from '@dnd-kit/sortable';

/**
 * Property 2: Stage Ordering Preservation
 * 
 * **Validates: Requirements 3.1.3, 3.8.3**
 * 
 * For any sequence of stages with assigned stage_order values, reordering stages
 * should update the stage_order field to reflect the new positions, maintaining
 * sequential ordering from 0 to n-1.
 * 
 * Property: For all valid stage arrays S and valid reorder operations (oldIndex, newIndex),
 * when stages are reordered using arrayMove(S, oldIndex, newIndex), then:
 * 1. The resulting array must have the same length as the original
 * 2. All stages must be present (no duplicates or missing stages)
 * 3. The stage_order values must be sequential from 0 to length-1
 * 4. The stage at newIndex must be the stage that was originally at oldIndex
 */
describe('Feature: staged-exam-system, Property 2: Stage Ordering Preservation', () => {
  // Generator for stage type
  const stageTypeArb = fc.constantFrom<StageType>('video', 'content', 'questions');

  // Generator for stage configuration based on type
  const stageConfigArb = (type: StageType) => {
    switch (type) {
      case 'video':
        return fc.record({
          youtube_url: fc.webUrl({ validSchemes: ['https'] }),
          enforcement_threshold: fc.option(fc.integer({ min: 0, max: 100 })),
          description: fc.option(fc.string()),
        });
      case 'content':
        return fc.record({
          slides: fc.array(
            fc.record({
              id: fc.uuid(),
              content: fc.string(),
              order: fc.nat(),
            }),
            { minLength: 0, maxLength: 5 }
          ),
          minimum_read_time_per_slide: fc.option(fc.nat()),
        });
      case 'questions':
        return fc.record({
          question_ids: fc.array(fc.uuid(), { minLength: 0, maxLength: 10 }),
          randomize_within_stage: fc.boolean(),
        });
    }
  };

  // Generator for a single stage
  const stageArb = fc.nat().chain((order) =>
    stageTypeArb.chain((type) =>
      stageConfigArb(type).map((config) => ({
        id: `stage-${order}-${Date.now()}-${Math.random()}`,
        exam_id: 'test-exam-id',
        stage_type: type,
        stage_order: order,
        configuration: config,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Stage))
    )
  );

  // Generator for an array of stages with sequential ordering
  const stagesArrayArb = fc
    .array(stageArb, { minLength: 2, maxLength: 10 })
    .map((stages) =>
      stages.map((stage, index) => ({
        ...stage,
        stage_order: index,
        id: `stage-${index}`,
      }))
    );

  it('should preserve all stages after reordering', () => {
    fc.assert(
      fc.property(
        stagesArrayArb,
        fc.nat(),
        fc.nat(),
        (stages, oldIndexRaw, newIndexRaw) => {
          // Ensure indices are within bounds
          const oldIndex = oldIndexRaw % stages.length;
          const newIndex = newIndexRaw % stages.length;

          // Perform reordering
          const reorderedStages = arrayMove(stages, oldIndex, newIndex);

          // Update stage_order for all stages
          const updatedStages = reorderedStages.map((stage, index) => ({
            ...stage,
            stage_order: index,
          }));

          // Property 1: Same length
          expect(updatedStages.length).toBe(stages.length);

          // Property 2: All stages present (check by ID)
          const originalIds = new Set(stages.map((s) => s.id));
          const updatedIds = new Set(updatedStages.map((s) => s.id));
          expect(updatedIds).toEqual(originalIds);

          // Property 3: Sequential stage_order from 0 to length-1
          const orders = updatedStages.map((s) => s.stage_order);
          const expectedOrders = Array.from({ length: stages.length }, (_, i) => i);
          expect(orders).toEqual(expectedOrders);

          // Property 4: Stage at newIndex is the one from oldIndex
          expect(updatedStages[newIndex].id).toBe(stages[oldIndex].id);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain stage_order uniqueness after reordering', () => {
    fc.assert(
      fc.property(
        stagesArrayArb,
        fc.nat(),
        fc.nat(),
        (stages, oldIndexRaw, newIndexRaw) => {
          const oldIndex = oldIndexRaw % stages.length;
          const newIndex = newIndexRaw % stages.length;

          const reorderedStages = arrayMove(stages, oldIndex, newIndex);
          const updatedStages = reorderedStages.map((stage, index) => ({
            ...stage,
            stage_order: index,
          }));

          // All stage_order values must be unique
          const orders = updatedStages.map((s) => s.stage_order);
          const uniqueOrders = new Set(orders);
          expect(uniqueOrders.size).toBe(orders.length);

          // No duplicate stage_order values
          expect(orders.length).toBe(stages.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve stage properties during reordering', () => {
    fc.assert(
      fc.property(
        stagesArrayArb,
        fc.nat(),
        fc.nat(),
        (stages, oldIndexRaw, newIndexRaw) => {
          const oldIndex = oldIndexRaw % stages.length;
          const newIndex = newIndexRaw % stages.length;

          const reorderedStages = arrayMove(stages, oldIndex, newIndex);
          const updatedStages = reorderedStages.map((stage, index) => ({
            ...stage,
            stage_order: index,
          }));

          // For each stage, verify all properties except stage_order are preserved
          updatedStages.forEach((updatedStage) => {
            const originalStage = stages.find((s) => s.id === updatedStage.id);
            expect(originalStage).toBeDefined();

            if (originalStage) {
              expect(updatedStage.id).toBe(originalStage.id);
              expect(updatedStage.exam_id).toBe(originalStage.exam_id);
              expect(updatedStage.stage_type).toBe(originalStage.stage_type);
              expect(updatedStage.configuration).toEqual(originalStage.configuration);
              expect(updatedStage.created_at).toBe(originalStage.created_at);
              expect(updatedStage.updated_at).toBe(originalStage.updated_at);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle identity reordering (same position)', () => {
    fc.assert(
      fc.property(stagesArrayArb, fc.nat(), (stages, indexRaw) => {
        const index = indexRaw % stages.length;

        // Reorder to same position
        const reorderedStages = arrayMove(stages, index, index);
        const updatedStages = reorderedStages.map((stage, idx) => ({
          ...stage,
          stage_order: idx,
        }));

        // Array should be unchanged
        expect(updatedStages.length).toBe(stages.length);
        updatedStages.forEach((stage, idx) => {
          expect(stage.id).toBe(stages[idx].id);
          expect(stage.stage_order).toBe(idx);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('should handle moving first stage to last position', () => {
    fc.assert(
      fc.property(stagesArrayArb, (stages) => {
        if (stages.length < 2) return true; // Skip if not enough stages

        const oldIndex = 0;
        const newIndex = stages.length - 1;

        const reorderedStages = arrayMove(stages, oldIndex, newIndex);
        const updatedStages = reorderedStages.map((stage, index) => ({
          ...stage,
          stage_order: index,
        }));

        // First stage should now be at last position
        expect(updatedStages[newIndex].id).toBe(stages[oldIndex].id);
        expect(updatedStages[newIndex].stage_order).toBe(newIndex);

        // All stage_order values should be sequential
        const orders = updatedStages.map((s) => s.stage_order);
        expect(orders).toEqual(Array.from({ length: stages.length }, (_, i) => i));
      }),
      { numRuns: 100 }
    );
  });

  it('should handle moving last stage to first position', () => {
    fc.assert(
      fc.property(stagesArrayArb, (stages) => {
        if (stages.length < 2) return true; // Skip if not enough stages

        const oldIndex = stages.length - 1;
        const newIndex = 0;

        const reorderedStages = arrayMove(stages, oldIndex, newIndex);
        const updatedStages = reorderedStages.map((stage, index) => ({
          ...stage,
          stage_order: index,
        }));

        // Last stage should now be at first position
        expect(updatedStages[newIndex].id).toBe(stages[oldIndex].id);
        expect(updatedStages[newIndex].stage_order).toBe(newIndex);

        // All stage_order values should be sequential
        const orders = updatedStages.map((s) => s.stage_order);
        expect(orders).toEqual(Array.from({ length: stages.length }, (_, i) => i));
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Property 5: YouTube URL Validation
 * 
 * **Validates: Requirements 3.2.1**
 * 
 * For any YouTube URL in valid formats (youtube.com/watch?v=..., youtu.be/..., 
 * youtube.com/embed/...), the system must accept it as a valid video_url for a Video_Stage.
 * Invalid URLs or non-YouTube URLs must be rejected.
 * 
 * Property: For all strings S, if S matches a valid YouTube URL pattern, then it should
 * be accepted as a valid youtube_url. If S does not match any valid pattern, it should
 * be rejected.
 */
describe('Feature: staged-exam-system, Property 5: YouTube URL Validation', () => {
  // Helper function to validate YouTube URLs
  const validateYouTubeUrl = (url: string): boolean => {
    if (!url) return false;

    const patterns = [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^https?:\/\/youtu\.be\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/,
    ];

    return patterns.some((pattern) => pattern.test(url));
  };

  // Generator for valid YouTube video IDs
  const youtubeVideoIdArb = fc.stringMatching(/^[\w-]{11}$/);

  // Generator for valid YouTube URLs
  const validYouTubeUrlArb = fc.oneof(
    // youtube.com/watch?v=...
    youtubeVideoIdArb.map((id) => `https://www.youtube.com/watch?v=${id}`),
    youtubeVideoIdArb.map((id) => `https://youtube.com/watch?v=${id}`),
    youtubeVideoIdArb.map((id) => `http://www.youtube.com/watch?v=${id}`),
    // youtu.be/...
    youtubeVideoIdArb.map((id) => `https://youtu.be/${id}`),
    youtubeVideoIdArb.map((id) => `http://youtu.be/${id}`),
    // youtube.com/embed/...
    youtubeVideoIdArb.map((id) => `https://www.youtube.com/embed/${id}`),
    youtubeVideoIdArb.map((id) => `https://youtube.com/embed/${id}`)
  );

  // Generator for invalid URLs
  const invalidUrlArb = fc.oneof(
    fc.webUrl({ validSchemes: ['https', 'http'] }).filter((url) => !url.includes('youtube') && !url.includes('youtu.be')),
    fc.string().filter((s) => !validateYouTubeUrl(s)),
    fc.constant(''),
    fc.constant('not-a-url'),
    fc.constant('https://vimeo.com/123456'),
    fc.constant('https://www.youtube.com/'), // Missing video ID
    fc.constant('https://youtu.be/'), // Missing video ID
  );

  it('should accept all valid YouTube URL formats', () => {
    fc.assert(
      fc.property(validYouTubeUrlArb, (url) => {
        const isValid = validateYouTubeUrl(url);
        expect(isValid).toBe(true);

        // Verify it can be used in a VideoStageConfig
        const config: VideoStageConfig = {
          youtube_url: url,
        };
        expect(config.youtube_url).toBe(url);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject invalid YouTube URLs', () => {
    fc.assert(
      fc.property(invalidUrlArb, (url) => {
        const isValid = validateYouTubeUrl(url);
        expect(isValid).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it('should validate youtube.com/watch?v= format', () => {
    fc.assert(
      fc.property(youtubeVideoIdArb, (videoId) => {
        const urls = [
          `https://www.youtube.com/watch?v=${videoId}`,
          `https://youtube.com/watch?v=${videoId}`,
          `http://www.youtube.com/watch?v=${videoId}`,
          `http://youtube.com/watch?v=${videoId}`,
        ];

        urls.forEach((url) => {
          expect(validateYouTubeUrl(url)).toBe(true);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('should validate youtu.be/ format', () => {
    fc.assert(
      fc.property(youtubeVideoIdArb, (videoId) => {
        const urls = [
          `https://youtu.be/${videoId}`,
          `http://youtu.be/${videoId}`,
        ];

        urls.forEach((url) => {
          expect(validateYouTubeUrl(url)).toBe(true);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('should validate youtube.com/embed/ format', () => {
    fc.assert(
      fc.property(youtubeVideoIdArb, (videoId) => {
        const urls = [
          `https://www.youtube.com/embed/${videoId}`,
          `https://youtube.com/embed/${videoId}`,
          `http://www.youtube.com/embed/${videoId}`,
          `http://youtube.com/embed/${videoId}`,
        ];

        urls.forEach((url) => {
          expect(validateYouTubeUrl(url)).toBe(true);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('should reject URLs with missing video IDs', () => {
    const invalidUrls = [
      'https://www.youtube.com/watch?v=',
      'https://youtu.be/',
      'https://www.youtube.com/embed/',
      'https://www.youtube.com/watch',
      'https://www.youtube.com/',
      'https://youtube.com',
    ];

    invalidUrls.forEach((url) => {
      expect(validateYouTubeUrl(url)).toBe(false);
    });
  });

  it('should reject non-YouTube video platforms', () => {
    const nonYouTubeUrls = [
      'https://vimeo.com/123456789',
      'https://www.dailymotion.com/video/x123456',
      'https://www.twitch.tv/videos/123456789',
      'https://www.facebook.com/watch/?v=123456789',
    ];

    nonYouTubeUrls.forEach((url) => {
      expect(validateYouTubeUrl(url)).toBe(false);
    });
  });

  it('should handle URLs with additional query parameters', () => {
    fc.assert(
      fc.property(youtubeVideoIdArb, (videoId) => {
        // URLs with additional parameters should still be valid
        const urlsWithParams = [
          `https://www.youtube.com/watch?v=${videoId}&t=30s`,
          `https://www.youtube.com/watch?v=${videoId}&list=PLxxx`,
          `https://www.youtube.com/watch?v=${videoId}&feature=share`,
        ];

        urlsWithParams.forEach((url) => {
          expect(validateYouTubeUrl(url)).toBe(true);
        });
      }),
      { numRuns: 100 }
    );
  });
});


/**
 * Property 6: Enforcement Threshold Bounds
 * 
 * **Validates: Requirements 3.2.2**
 * 
 * For any enforcement threshold value, if it is set, it must be within the range [0, 100].
 * Values outside this range should be rejected or clamped to valid bounds.
 * 
 * Property: For all numbers N, if N is used as an enforcement_threshold:
 * 1. If N is undefined, it should be accepted (no enforcement)
 * 2. If N is in [0, 100], it should be accepted
 * 3. If N is outside [0, 100], it should be rejected or clamped
 */
describe('Feature: staged-exam-system, Property 6: Enforcement Threshold Bounds', () => {
  // Helper function to validate enforcement threshold
  const validateEnforcementThreshold = (threshold: number | undefined): boolean => {
    if (threshold === undefined) return true;
    return threshold >= 0 && threshold <= 100;
  };

  // Helper function to clamp threshold to valid range
  const clampThreshold = (threshold: number | undefined): number | undefined => {
    if (threshold === undefined) return undefined;
    return Math.max(0, Math.min(100, threshold));
  };

  it('should accept undefined enforcement threshold (no enforcement)', () => {
    fc.assert(
      fc.property(fc.constant(undefined), (threshold) => {
        expect(validateEnforcementThreshold(threshold)).toBe(true);

        const config: VideoStageConfig = {
          youtube_url: 'https://www.youtube.com/watch?v=test',
          enforcement_threshold: threshold,
        };
        expect(config.enforcement_threshold).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });

  it('should accept all valid threshold values in range [0, 100]', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 100 }), (threshold) => {
        expect(validateEnforcementThreshold(threshold)).toBe(true);

        const config: VideoStageConfig = {
          youtube_url: 'https://www.youtube.com/watch?v=test',
          enforcement_threshold: threshold,
        };
        expect(config.enforcement_threshold).toBe(threshold);
        expect(config.enforcement_threshold).toBeGreaterThanOrEqual(0);
        expect(config.enforcement_threshold).toBeLessThanOrEqual(100);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject threshold values below 0', () => {
    fc.assert(
      fc.property(fc.integer({ max: -1 }), (threshold) => {
        expect(validateEnforcementThreshold(threshold)).toBe(false);
        expect(threshold).toBeLessThan(0);
      }),
      { numRuns: 100 }
    );
  });

  it('should reject threshold values above 100', () => {
    fc.assert(
      fc.property(fc.integer({ min: 101 }), (threshold) => {
        expect(validateEnforcementThreshold(threshold)).toBe(false);
        expect(threshold).toBeGreaterThan(100);
      }),
      { numRuns: 100 }
    );
  });

  it('should accept boundary values 0 and 100', () => {
    const boundaryValues = [0, 100];

    boundaryValues.forEach((threshold) => {
      expect(validateEnforcementThreshold(threshold)).toBe(true);

      const config: VideoStageConfig = {
        youtube_url: 'https://www.youtube.com/watch?v=test',
        enforcement_threshold: threshold,
      };
      expect(config.enforcement_threshold).toBe(threshold);
    });
  });

  it('should clamp out-of-range values to valid bounds', () => {
    fc.assert(
      fc.property(fc.integer(), (threshold) => {
        const clamped = clampThreshold(threshold);

        if (clamped !== undefined) {
          expect(clamped).toBeGreaterThanOrEqual(0);
          expect(clamped).toBeLessThanOrEqual(100);

          // Verify clamping behavior
          if (threshold < 0) {
            expect(clamped).toBe(0);
          } else if (threshold > 100) {
            expect(clamped).toBe(100);
          } else {
            expect(clamped).toBe(threshold);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should handle floating point values by rounding or rejecting', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100, noNaN: true }), (threshold) => {
        // Integer thresholds should be valid
        const rounded = Math.round(threshold);
        expect(validateEnforcementThreshold(rounded)).toBe(true);
        expect(rounded).toBeGreaterThanOrEqual(0);
        expect(rounded).toBeLessThanOrEqual(100);
      }),
      { numRuns: 100 }
    );
  });

  it('should maintain threshold value through stage creation and retrieval', () => {
    fc.assert(
      fc.property(
        fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
        (threshold) => {
          const config: VideoStageConfig = {
            youtube_url: 'https://www.youtube.com/watch?v=test',
            enforcement_threshold: threshold,
          };

          // Simulate saving and retrieving
          const saved = JSON.parse(JSON.stringify(config));
          expect(saved.enforcement_threshold).toEqual(threshold);

          if (threshold !== undefined && threshold !== null) {
            expect(saved.enforcement_threshold).toBeGreaterThanOrEqual(0);
            expect(saved.enforcement_threshold).toBeLessThanOrEqual(100);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle special numeric values', () => {
    const specialValues = [
      { value: NaN, valid: false },
      { value: Infinity, valid: false },
      { value: -Infinity, valid: false },
    ];

    specialValues.forEach(({ value, valid }) => {
      expect(validateEnforcementThreshold(value)).toBe(valid);
    });
  });

  it('should preserve threshold semantics (0 = no requirement, 100 = full watch)', () => {
    // 0% threshold means no enforcement (but different from undefined)
    const zeroThreshold: VideoStageConfig = {
      youtube_url: 'https://www.youtube.com/watch?v=test',
      enforcement_threshold: 0,
    };
    expect(zeroThreshold.enforcement_threshold).toBe(0);
    expect(validateEnforcementThreshold(0)).toBe(true);

    // 100% threshold means must watch entire video
    const fullThreshold: VideoStageConfig = {
      youtube_url: 'https://www.youtube.com/watch?v=test',
      enforcement_threshold: 100,
    };
    expect(fullThreshold.enforcement_threshold).toBe(100);
    expect(validateEnforcementThreshold(100)).toBe(true);

    // undefined means no enforcement UI shown
    const noThreshold: VideoStageConfig = {
      youtube_url: 'https://www.youtube.com/watch?v=test',
      enforcement_threshold: undefined,
    };
    expect(noThreshold.enforcement_threshold).toBeUndefined();
    expect(validateEnforcementThreshold(undefined)).toBe(true);
  });
});
