import 'server-only';

import { z } from 'zod';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5.4-nano';

const icebreakerLabelSchema = z.enum(['Friendly', 'Biker-specific', 'Playful']);

export const icebreakerSuggestionsSchema = z.object({
  openers: z.array(
    z.object({
      label: icebreakerLabelSchema,
      message: z.string().trim().min(1).max(240),
    }),
  ).length(3).superRefine((openers, ctx) => {
    const expected = ['Friendly', 'Biker-specific', 'Playful'] as const;
    for (const label of expected) {
      if (openers.filter((opener) => opener.label === label).length !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Expected exactly one ${label} opener`,
        });
      }
    }
  }),
});

export type IcebreakerSuggestions = z.infer<typeof icebreakerSuggestionsSchema>;

type SafeProfileData = {
  display_name: string;
  bio: string | null;
  city: string | null;
  country: string | null;
  dating_intent: string | null;
  riding_style: string | null;
  years_riding: number | null;
  mood: string | null;
  club_type: string | null;
};

type SafeBikeData = {
  bike_brand: string | null;
  bike_model: string | null;
  bike_year: number | null;
  bike_type: string | null;
};

export type IcebreakerInput = {
  currentUser: SafeProfileData | null;
  targetProfile: SafeProfileData;
  targetPrimaryBike: SafeBikeData | null;
};

type ResponsesApiResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

export class OpenAIIcebreakerConfigurationError extends Error {
  constructor() {
    super('AI icebreaker helper is not configured.');
    this.name = 'OpenAIIcebreakerConfigurationError';
  }
}

export class OpenAIIcebreakerError extends Error {
  constructor(message = 'AI icebreaker helper could not generate suggestions.') {
    super(message);
    this.name = 'OpenAIIcebreakerError';
  }
}

export async function generateIcebreakers(input: IcebreakerInput): Promise<IcebreakerSuggestions> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new OpenAIIcebreakerConfigurationError();

  const model = process.env.OPENAI_ICEBREAKER_MODEL || DEFAULT_MODEL;

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions: [
        'You write safe opening messages for REVdating, a UK biker dating app.',
        'Use UK English and keep each opener short, natural, and under 240 characters.',
        'Use only the provided public-safe profile and bike facts. Do not invent facts.',
        'Do not mention a detail if it was not provided.',
        'Do not include contact details, handles, phone numbers, emails, or external links.',
        'Do not be creepy, sexual, pushy, manipulative, overfamiliar, or pressure anyone to meet.',
        'Do not mention private data, reports, moderation, admin state, hidden fields, exact location, or messages.',
        'Return JSON only in the requested schema with exactly one Friendly, one Biker-specific, and one Playful opener.',
      ].join(' '),
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify({
                task: 'Generate 3 opening message suggestions for this matched rider.',
                current_user_public_context: input.currentUser,
                target_profile_public_context: input.targetProfile,
                target_primary_bike_public_context: input.targetPrimaryBike,
              }),
            },
          ],
        },
      ],
      max_output_tokens: 600,
      text: {
        format: {
          type: 'json_schema',
          name: 'icebreaker_suggestions',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['openers'],
            properties: {
              openers: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['label', 'message'],
                  properties: {
                    label: {
                      type: 'string',
                      enum: ['Friendly', 'Biker-specific', 'Playful'],
                    },
                    message: {
                      type: 'string',
                      description: 'A short, natural opener under 240 characters.',
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
  });

  const payload = await response.json().catch(() => null) as ResponsesApiResponse | null;

  if (!response.ok) {
    throw new OpenAIIcebreakerError(payload?.error?.message ? 'AI icebreaker request failed.' : undefined);
  }

  const outputText = extractOutputText(payload);
  if (!outputText) throw new OpenAIIcebreakerError();

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new OpenAIIcebreakerError();
  }

  const result = icebreakerSuggestionsSchema.safeParse(parsed);
  if (!result.success) throw new OpenAIIcebreakerError();

  return result.data;
}

function extractOutputText(payload: ResponsesApiResponse | null): string | null {
  if (!payload) return null;
  if (payload.output_text) return payload.output_text;

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.refusal) return null;
      if (content.type === 'output_text' && content.text) return content.text;
      if (content.text) return content.text;
    }
  }

  return null;
}
