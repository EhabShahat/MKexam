/**
 * End-to-End Test: Complete Staged Exam Flow
 * 
 * This test validates the entire staged exam system from exam creation
 * through student completion and results calculation.
 * 
 * Requirements Validated: 3.1.1 through 3.18.8
 */

import { test, expect } from '@playwright/test';

test.describe('Complete Staged Exam Flow - End-to-End', () => {
  test.setTimeout(120000); // 2 minutes for complete flow

  let examId: string;
  let attemptId: string;
  let studentCode: string;

  test.beforeAll(async ({ request }) => {
    // Setup: Create test data
    studentCode = `TEST-${Date.now()}`;
  });

  test('1. Admin creates exam with multiple stages (video, content, questions)', async ({ page }) => {
    // Login as admin
    await page.goto('/admin/login');
    await page.fill('input[name="username"]', process.env.ADMIN_USERNAME || 'admin');
    await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD || 'admin');
    await page.click('button[type="submit"]');
    
    // Wait for dashboard
    await page.waitForURL('/admin');
    
    // Navigate to exam creation
    await page.goto('/admin/exams/new');
    
    // Fill exam details
    await page.fill('input[name="title"]', 'E2E Staged Exam Test');
    await page.fill('textarea[name="description"]', 'End-to-end test for staged exam system');
    await page.selectOption('select[name="exam_type"]', 'exam');
    await page.fill('input[name="duration_minutes"]', '30');
    
    // Add questions first (required for Questions_Stage)
    await page.click('button:has-text("Add Question")');
    await page.fill('input[name="question_text"]', 'What is 2 + 2?');
    await page.selectOption('select[name="question_type"]', 'multiple_choice');
    await page.fill('input[name="option_1"]', '3');
    await page.fill('input[name="option_2"]', '4');
    await page.fill('input[name="option_3"]', '5');
    await page.fill('input[name="correct_answer"]', '4');
    await page.fill('input[name="points"]', '10');
    
    await page.click('button:has-text("Add Question")');
    await page.fill('input[name="question_text"]', 'What is the capital of France?');
    await page.selectOption('select[name="question_type"]', 'short_answer');
    await page.fill('input[name="correct_answer"]', 'Paris');
    await page.fill('input[name="points"]', '10');
    
    // Switch to Stages tab
    await page.click('button:has-text("Stages")');
    
    // Add Video Stage
    await page.click('button:has-text("Add Stage")');
    await page.selectOption('select[name="stage_type"]', 'video');
    await page.fill('input[name="youtube_url"]', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    await page.fill('input[name="enforcement_threshold"]', '80');
    await page.fill('textarea[name="description"]', 'Introduction video');
    await page.click('button:has-text("Save Stage")');
    
    // Add Content Stage
    await page.click('button:has-text("Add Stage")');
    await page.selectOption('select[name="stage_type"]', 'content');
    
    // Add slides using React Quill
    await page.click('button:has-text("Add Slide")');
    const quillEditor1 = page.locator('.ql-editor').first();
    await quillEditor1.fill('<h2>Key Concepts</h2><p>This is important information.</p>');
    
    await page.click('button:has-text("Add Slide")');
    const quillEditor2 = page.locator('.ql-editor').last();
    await quillEditor2.fill('<h2>Summary</h2><p>Review these points carefully.</p>');
    
    await page.fill('input[name="minimum_read_time_per_slide"]', '10');
    await page.click('button:has-text("Save Stage")');
    
    // Add Questions Stage
    await page.click('button:has-text("Add Stage")');
    await page.selectOption('select[name="stage_type"]', 'questions');
    
    // Select questions for this stage
    await page.check('input[type="checkbox"][value="question-1"]');
    await page.check('input[type="checkbox"][value="question-2"]');
    await page.click('button:has-text("Save Stage")');
    
    // Save exam
    await page.click('button:has-text("Save Exam")');
    
    // Wait for success message and capture exam ID
    await page.waitForSelector('.toast:has-text("Exam created successfully")');
    const url = page.url();
    examId = url.split('/').pop() || '';
    
    expect(examId).toBeTruthy();
    
    // Publish exam
    await page.click('button:has-text("Publish")');
    await page.waitForSelector('.toast:has-text("Exam published")');
  });

  test('2. Student starts attempt', async ({ page }) => {
    // Navigate to exam entry page
    await page.goto(`/exam/${examId}`);
    
    // Enter student code
    await page.fill('input[name="student_code"]', studentCode);
    await page.click('button:has-text("Start Exam")');
    
    // Wait for attempt page
    await page.waitForURL(/\/attempt\/.+/);
    
    // Capture attempt ID
    const url = page.url();
    attemptId = url.split('/').pop() || '';
    
    expect(attemptId).toBeTruthy();
    
    // Verify stage progress indicator is visible
    await expect(page.locator('.stage-progress')).toBeVisible();
    
    // Verify we're on stage 1 (Video)
    await expect(page.locator('.stage-indicator.current')).toContainText('Video');
  });

  test('3. Student progresses through Video Stage', async ({ page }) => {
    await page.goto(`/attempt/${attemptId}`);
    
    // Wait for YouTube player to load
    await page.waitForSelector('iframe[src*="youtube.com"]', { timeout: 10000 });
    
    // Verify enforcement message is displayed
    await expect(page.locator('text=/Watched.*Need 80% to continue/')).toBeVisible();
    
    // Verify "Continue" button is disabled
    const continueButton = page.locator('button:has-text("Continue")');
    await expect(continueButton).toBeDisabled();
    
    // Simulate watching video (in real scenario, this would involve YouTube API interaction)
    // For E2E test, we'll manually update progress via API
    await page.evaluate(async (aid) => {
      const response = await fetch(`/api/attempts/${aid}/stage-progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage_id: 'stage-1-id', // This would be dynamic in real scenario
          progress_data: {
            watch_percentage: 85,
            total_watch_time: 120,
            last_position: 140,
            watched_segments: [[0, 140]]
          },
          completed: false
        })
      });
      return response.json();
    }, attemptId);
    
    // Wait for button to be enabled
    await page.waitForTimeout(2000); // Allow time for state update
    await expect(continueButton).toBeEnabled();
    
    // Click continue to next stage
    await continueButton.click();
    
    // Verify we're on stage 2 (Content)
    await expect(page.locator('.stage-indicator.current')).toContainText('Content');
  });

  test('4. Student progresses through Content Stage', async ({ page }) => {
    await page.goto(`/attempt/${attemptId}`);
    
    // Verify we're on Content Stage
    await expect(page.locator('.content-stage')).toBeVisible();
    
    // Verify slide counter
    await expect(page.locator('text=/Slide 1 of 2/')).toBeVisible();
    
    // Verify HTML content is rendered
    await expect(page.locator('h2:has-text("Key Concepts")')).toBeVisible();
    await expect(page.locator('p:has-text("This is important information")')).toBeVisible();
    
    // Verify "Next Slide" button is disabled (minimum read time not met)
    const nextSlideButton = page.locator('button:has-text("Next Slide")');
    await expect(nextSlideButton).toBeDisabled();
    
    // Verify countdown timer is displayed
    await expect(page.locator('text=/Read for.*more seconds/')).toBeVisible();
    
    // Wait for minimum read time (10 seconds)
    await page.waitForTimeout(11000);
    
    // Button should now be enabled
    await expect(nextSlideButton).toBeEnabled();
    await nextSlideButton.click();
    
    // Verify we're on slide 2
    await expect(page.locator('text=/Slide 2 of 2/')).toBeVisible();
    await expect(page.locator('h2:has-text("Summary")')).toBeVisible();
    
    // Wait for minimum read time again
    await page.waitForTimeout(11000);
    
    // Click "Continue" to next stage
    const continueButton = page.locator('button:has-text("Continue")');
    await expect(continueButton).toBeEnabled();
    await continueButton.click();
    
    // Verify we're on stage 3 (Questions)
    await expect(page.locator('.stage-indicator.current')).toContainText('Questions');
  });

  test('5. Student answers questions in Questions Stage', async ({ page }) => {
    await page.goto(`/attempt/${attemptId}`);
    
    // Verify we're on Questions Stage
    await expect(page.locator('.questions-stage')).toBeVisible();
    
    // Answer question 1 (multiple choice)
    await expect(page.locator('text=/What is 2 \\+ 2\\?/')).toBeVisible();
    await page.click('input[type="radio"][value="4"]');
    
    // Answer question 2 (short answer)
    await expect(page.locator('text=/What is the capital of France\\?/')).toBeVisible();
    await page.fill('input[type="text"][name="answer-question-2"]', 'Paris');
    
    // Verify auto-save is working (wait for save indicator)
    await page.waitForTimeout(31000); // Wait for auto-save interval (30 seconds)
    await expect(page.locator('.save-status:has-text("Saved")')).toBeVisible();
    
    // Verify all questions are answered
    const continueButton = page.locator('button:has-text("Continue")');
    await expect(continueButton).toBeEnabled();
    await continueButton.click();
    
    // Verify we've completed all stages
    await expect(page.locator('.stage-indicator.completed')).toHaveCount(3);
  });

  test('6. Student submits exam', async ({ page }) => {
    await page.goto(`/attempt/${attemptId}`);
    
    // Verify submit button is visible and enabled
    const submitButton = page.locator('button:has-text("Submit Exam")');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();
    
    // Click submit
    await submitButton.click();
    
    // Confirm submission in dialog
    await page.click('button:has-text("Confirm")');
    
    // Wait for submission success
    await page.waitForSelector('.toast:has-text("Exam submitted successfully")');
    
    // Verify redirect to completion page
    await page.waitForURL(/\/attempt\/.+\/complete/);
    
    // Verify completion message
    await expect(page.locator('text=/Exam submitted successfully/')).toBeVisible();
  });

  test('7. Admin views results and verifies calculation', async ({ page }) => {
    // Login as admin
    await page.goto('/admin/login');
    await page.fill('input[name="username"]', process.env.ADMIN_USERNAME || 'admin');
    await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD || 'admin');
    await page.click('button[type="submit"]');
    
    // Navigate to results
    await page.goto(`/admin/results?exam_id=${examId}`);
    
    // Find the student's attempt
    await page.fill('input[name="search"]', studentCode);
    await page.waitForTimeout(1000);
    
    // Verify attempt is listed
    await expect(page.locator(`tr:has-text("${studentCode}")`)).toBeVisible();
    
    // Click to view details
    await page.click(`tr:has-text("${studentCode}")`);
    
    // Verify results are calculated correctly
    await expect(page.locator('.result-summary')).toBeVisible();
    
    // Verify total questions (2 questions)
    await expect(page.locator('text=/Total Questions: 2/')).toBeVisible();
    
    // Verify correct answers (both should be correct)
    await expect(page.locator('text=/Correct: 2/')).toBeVisible();
    
    // Verify score percentage (100%)
    await expect(page.locator('text=/Score: 100%/')).toBeVisible();
    
    // Verify points (20 out of 20)
    await expect(page.locator('text=/Points: 20 \\/ 20/')).toBeVisible();
    
    // Verify final score percentage (100%)
    await expect(page.locator('text=/Final Score: 100%/')).toBeVisible();
  });

  test('8. Admin views stage analytics', async ({ page }) => {
    // Navigate to stage analytics
    await page.goto(`/admin/results/analysis/${examId}/stages`);
    
    // Verify stage completion rates
    await expect(page.locator('.stage-analytics')).toBeVisible();
    
    // Verify Video Stage analytics
    await expect(page.locator('text=/Video Stage.*Completion Rate: 100%/')).toBeVisible();
    await expect(page.locator('text=/Average Watch Percentage: 85%/')).toBeVisible();
    
    // Verify Content Stage analytics
    await expect(page.locator('text=/Content Stage.*Completion Rate: 100%/')).toBeVisible();
    await expect(page.locator('text=/Average Time per Slide/')).toBeVisible();
    
    // Verify Questions Stage analytics
    await expect(page.locator('text=/Questions Stage.*Completion Rate: 100%/')).toBeVisible();
    await expect(page.locator('text=/Average Score: 100%/')).toBeVisible();
  });

  test('9. Verify backward compatibility - non-staged exam still works', async ({ page }) => {
    // Create a traditional non-staged exam
    await page.goto('/admin/exams/new');
    
    await page.fill('input[name="title"]', 'E2E Non-Staged Exam Test');
    await page.selectOption('select[name="exam_type"]', 'exam');
    await page.fill('input[name="duration_minutes"]', '15');
    
    // Add question without stages
    await page.click('button:has-text("Add Question")');
    await page.fill('input[name="question_text"]', 'Test question');
    await page.selectOption('select[name="question_type"]', 'true_false');
    await page.fill('input[name="correct_answer"]', 'true');
    await page.fill('input[name="points"]', '5');
    
    // Save without adding stages
    await page.click('button:has-text("Save Exam")');
    await page.waitForSelector('.toast:has-text("Exam created successfully")');
    
    const url = page.url();
    const nonStagedExamId = url.split('/').pop() || '';
    
    // Publish exam
    await page.click('button:has-text("Publish")');
    
    // Take exam as student
    await page.goto(`/exam/${nonStagedExamId}`);
    await page.fill('input[name="student_code"]', `NOSTAGE-${Date.now()}`);
    await page.click('button:has-text("Start Exam")');
    
    // Verify traditional exam flow (no stages)
    await page.waitForURL(/\/attempt\/.+/);
    
    // Verify NO stage progress indicator
    await expect(page.locator('.stage-progress')).not.toBeVisible();
    
    // Verify question is displayed directly
    await expect(page.locator('text=/Test question/')).toBeVisible();
    
    // Answer and submit
    await page.click('input[type="radio"][value="true"]');
    await page.click('button:has-text("Submit Exam")');
    await page.click('button:has-text("Confirm")');
    
    // Verify submission success
    await page.waitForSelector('.toast:has-text("Exam submitted successfully")');
  });

  test('10. Verify timer continuity across stages', async ({ page }) => {
    // Create new attempt
    await page.goto(`/exam/${examId}`);
    await page.fill('input[name="student_code"]', `TIMER-${Date.now()}`);
    await page.click('button:has-text("Start Exam")');
    
    await page.waitForURL(/\/attempt\/.+/);
    
    // Capture initial timer value
    const timerElement = page.locator('.timer');
    await expect(timerElement).toBeVisible();
    
    const initialTime = await timerElement.textContent();
    const initialMinutes = parseInt(initialTime?.split(':')[0] || '0');
    
    // Wait a few seconds
    await page.waitForTimeout(5000);
    
    // Progress to next stage
    await page.evaluate(async (aid) => {
      await fetch(`/api/attempts/${aid}/stage-progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage_id: 'stage-1-id',
          progress_data: { watch_percentage: 100, total_watch_time: 180 },
          completed: true
        })
      });
    }, attemptId);
    
    await page.click('button:has-text("Continue")');
    
    // Verify timer continues (should be less than initial)
    const newTime = await timerElement.textContent();
    const newMinutes = parseInt(newTime?.split(':')[0] || '0');
    
    expect(newMinutes).toBeLessThanOrEqual(initialMinutes);
    
    // Verify timer is still counting down
    await page.waitForTimeout(2000);
    const laterTime = await timerElement.textContent();
    expect(laterTime).not.toBe(newTime);
  });
});
