import 'server-only';

import { z } from 'zod';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5.4-nano';

export const ridePlannerRideLengthSchema = z.enum(['short', 'half_day', 'full_day']);
export const ridePlannerVibeSchema = z.enum(['coffee', 'scenic', 'food', 'relaxed', 'adventure']);
export const ridePlannerMeetupTypeSchema = z.enum([
  'public_cafe',
  'scenic_stop',
  'food_stop',
  'public_landmark',
  'relaxed_meetup',
]);

export const ridePlanIdeasSchema = z.object({
  ideas: z.array(
    z.object({
      title: z.string().trim().min(1).max(100),
      summary: z.string().trim().min(1).max(300),
      ride_length: ridePlannerRideLengthSchema,
      meetup_type: ridePlannerMeetupTypeSchema,
      safety_note: z.string().trim().min(1).max(200),
      message_draft: z.string().trim().min(1).max(240),
    }),
  ).length(3),
});

export type RidePlanIdeas = z.infer<typeof ridePlanIdeasSchema>;
export type RidePlannerRideLength = z.infer<typeof ridePlannerRideLengthSchema>;
export type RidePlannerVibe = z.infer<typeof ridePlannerVibeSchema>;

type SafeProfileData = {
  display_name: string;
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

export type RidePlannerInput = {
  currentUser: SafeProfileData | null;
  targetProfile: SafeProfileData;
  currentUserPrimaryBike: SafeBikeData | null;
  targetPrimaryBike: SafeBikeData | null;
  preferences: {
    ride_length?: RidePlannerRideLength;
    vibe?: RidePlannerVibe;
  };
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

export class OpenAIRidePlannerConfigurationError extends Error {
  constructor() {
    super('AI ride planner is not configured.');
    this.name = 'OpenAIRidePlannerConfigurationError';
  }
}

export class OpenAIRidePlannerError extends Error {
  constructor(message = 'AI ride planner could not generate ride-date ideas.') {
    super(message);
    this.name = 'OpenAIRidePlannerError';
  }
}

export async function generateRidePlanIdeas(input: RidePlannerInput): Promise<RidePlanIdeas> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new OpenAIRidePlannerConfigurationError();

  const model = process.env.OPENAI_RIDE_PLANNER_MODEL || DEFAULT_MODEL;

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions: [
        'You suggest safe ride-date ideas for REVdating, a UK biker dating app.',
        'Use UK English and return exactly 3 practical, biker-friendly ideas.',
        'Use only the supplied public-safe profile, general city/country, public bike facts, and lightweight preferences. Do not invent facts.',
        'Prefer public places, daylight meetups, sensible ride lengths, and safety-first plans.',
        'Do not invent exact business names unless provided. Do not invent exact addresses, GPS coordinates, private contact details, secluded meetups, or unsafe locations.',
        'Do not encourage dangerous riding, speeding, risky routes, alcohol before riding, pressure, or manipulation.',
        'Do not mention reports, moderation, admin state, hidden fields, exact location, messages, verification documents, or private data.',
        'Each message_draft is only text the user could manually send later; never imply anything was sent, saved, scheduled, or created.',
        'Keep each summary under 300 characters, safety_note under 200 characters, and message_draft under 240 characters.',
        'Return JSON only in the requested schema with no extra fields.',
      ].join(' '),
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify({
                task: 'Generate 3 safe ride-date ideas for these matched riders.',
                current_user_public_context: input.currentUser,
                target_profile_public_context: input.targetProfile,
                current_user_primary_bike_public_context: input.currentUserPrimaryBike,
                target_primary_bike_public_context: input.targetPrimaryBike,
                preferences: input.preferences,
              }),
            },
          ],
        },
      ],
      max_output_tokens: 900,
      text: {
        format: {
          type: 'json_schema',
          name: 'ride_plan_ideas',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['ideas'],
            properties: {
              ideas: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['title', 'summary', 'ride_length', 'meetup_type', 'safety_note', 'message_draft'],
                  properties: {
                    title: {
                      type: 'string',
                      description: 'Short ride-date idea title under 100 characters.',
                    },
                    summary: {
                      type: 'string',
                      description: 'Practical public-safe plan summary under 300 characters.',
                    },
                    ride_length: {
                      type: 'string',
                      enum: ['short', 'half_day', 'full_day'],
                    },
                    meetup_type: {
                      type: 'string',
                      enum: ['public_cafe', 'scenic_stop', 'food_stop', 'public_landmark', 'relaxed_meetup'],
                    },
                    safety_note: {
                      type: 'string',
                      description: 'Safety-first note under 200 characters.',
                    },
                    message_draft: {
                      type: 'string',
                      description: 'Optional draft the user can manually send, under 240 characters.',
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
    throw new OpenAIRidePlannerError(payload?.error?.message ? 'AI ride planner request failed.' : undefined);
  }

  const outputText = extractOutputText(payload);
  if (!outputText) throw new OpenAIRidePlannerError();

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new OpenAIRidePlannerError();
  }

  const result = ridePlanIdeasSchema.safeParse(parsed);
  if (!result.success) throw new OpenAIRidePlannerError();

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
