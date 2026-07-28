import Anthropic from '@anthropic-ai/sdk';
import { GenerateLessonPlan } from '@application/lesson-plan';
import { ClaudeLessonPlanProvider } from '@infrastructure/providers/ai';
import { env } from '@shared/env';

export function makeGenerateLessonPlan(): GenerateLessonPlan {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const aiLessonPlanProvider = new ClaudeLessonPlanProvider(
    client,
    env.ANTHROPIC_MODEL
  );
  return new GenerateLessonPlan(aiLessonPlanProvider);
}
