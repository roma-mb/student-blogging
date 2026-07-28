import Anthropic from '@anthropic-ai/sdk';
import {
  AiLessonPlanProvider,
  GenerateLessonPlanInput
} from '@application/providers/ai-lesson-plan-provider';
import { LessonPlanSectionsDto } from '@application/lesson-plan/dto/lesson-plan.dto';
import { AppError } from '@shared/errors/builder';
import { LessonPlanError } from '@shared/errors/lesson-plan/lesson-plan-error';

const LESSON_PLAN_JSON_SCHEMA = {
  type: 'object',
  properties: {
    objectives: { type: 'array', items: { type: 'string' } },
    content: { type: 'string' },
    methodology: { type: 'string' },
    schedule: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          duration: { type: 'string' },
          description: { type: 'string' }
        },
        required: ['duration', 'description'],
        additionalProperties: false
      }
    },
    assessment: { type: 'string' },
    resources: { type: 'array', items: { type: 'string' } }
  },
  required: [
    'objectives',
    'content',
    'methodology',
    'schedule',
    'assessment',
    'resources'
  ],
  additionalProperties: false
} as const;

type ClaudeLessonPlanResponse = {
  readonly objectives: readonly string[];
  readonly content: string;
  readonly methodology: string;
  readonly schedule: readonly {
    readonly duration: string;
    readonly description: string;
  }[];
  readonly assessment: string;
  readonly resources: readonly string[];
};

export class ClaudeLessonPlanProvider implements AiLessonPlanProvider {
  constructor(
    private readonly client: Anthropic,
    private readonly model: string
  ) {}

  async generate(
    input: GenerateLessonPlanInput
  ): Promise<LessonPlanSectionsDto> {
    try {
      return await this.requestLessonPlan(input);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw LessonPlanError.aiProviderUnavailable();
    }
  }

  private async requestLessonPlan(
    input: GenerateLessonPlanInput
  ): Promise<LessonPlanSectionsDto> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 8000,
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: LESSON_PLAN_JSON_SCHEMA }
      },
      system: [
        'Você é um especialista em pedagogia responsável por elaborar planos de aula.',
        'Responda apenas com o objeto JSON solicitado, sem texto adicional e sem tags XML internas ou de sistema.'
      ].join(' '),
      messages: [{ role: 'user', content: this.buildPrompt(input) }]
    });

    if (response.stop_reason === 'refusal') {
      throw LessonPlanError.aiProviderUnavailable();
    }

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );

    if (!textBlock) {
      throw LessonPlanError.aiProviderUnavailable();
    }

    return this.parseResponse(textBlock.text);
  }

  private buildPrompt(input: GenerateLessonPlanInput): string {
    return [
      'Gere um plano de aula estruturado com as chaves:',
      'objectives, content, methodology, schedule, assessment, resources.',
      `Disciplina: ${input.subject}`,
      `Ano/série (grade): ${input.grade}`,
      `Tema: ${input.theme}`
    ].join('\n');
  }

  private parseResponse(rawResponse: string): LessonPlanSectionsDto {
    let parsed: ClaudeLessonPlanResponse;

    try {
      parsed = JSON.parse(rawResponse) as ClaudeLessonPlanResponse;
    } catch {
      throw LessonPlanError.aiProviderUnavailable();
    }

    if (!this.isValidResponse(parsed)) {
      throw LessonPlanError.aiProviderUnavailable();
    }

    return {
      objectives: [...parsed.objectives],
      content: parsed.content,
      methodology: parsed.methodology,
      schedule: parsed.schedule.map(step => ({
        duration: step.duration,
        description: step.description
      })),
      assessment: parsed.assessment,
      resources: [...parsed.resources]
    };
  }

  private isValidResponse(value: ClaudeLessonPlanResponse): boolean {
    return [
      Array.isArray(value.objectives),
      value.objectives.length > 0,
      typeof value.content === 'string',
      value.content.trim().length > 0,
      typeof value.methodology === 'string',
      value.methodology.trim().length > 0,
      Array.isArray(value.schedule),
      value.schedule.length > 0,
      typeof value.assessment === 'string',
      value.assessment.trim().length > 0,
      Array.isArray(value.resources),
      value.resources.length > 0
    ].every(Boolean);
  }
}
