import 'server-only';

import { z } from 'zod';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5.4-nano';

export const profileHelperSuggestionsSchema = z.object({
  short_bio: z.string().trim().min(1).max(500),
  fun_biker_bio: z.string().trim().min(1).max(500),
  serious_dating_bio: z.string().trim().min(1).max(500),
  profile_headline: z.string().trim().min(1).max(120),
});

export type ProfileHelperSuggestions = z.infer<typeof profileHelperSuggestionsSchema>;

type SafeProfileData = {
  display_name: string;
  bio: string | null;
  city: string | null;
  country: string | null;
  dating_intent: string | null;
  riding_style: string | null;
  years_riding: number | null;
  attends_rallies: boolean | null;
  smoker: boolean | null;
  drinker: boolean | null;
  has_passenger_helmet: boolean | null;
  mood: string | null;
  club_type: string | null;
  children_status: string | null;
};

type SafeBikeData = {
  bike_brand: string | null;
  bike_model: string | null;
  bike_year: number | null;
  bike_type: string | null;
};

export type ProfileHelperInput = {
  profile: SafeProfileData;
  primaryBike: SafeBikeData | null;
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

export class OpenAIConfigurationError extends Error {
  constructor() {
    super('AI helper is not configured.');
    this.name = 'OpenAIConfigurationError';
  }
}

export class OpenAIProfileHelperError extends Error {
  constructor(message = 'AI helper could not generate suggestions.') {
    super(message);
    this.name = 'OpenAIProfileHelperError';
  }
}

export async function generateProfileHelperSuggestions(
  input: ProfileHelperInput,
): Promise<ProfileHelperSuggestions> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new OpenAIConfigurationError();

  const model = process.env.OPENAI_PROFILE_HELPER_MODEL || DEFAULT_MODEL;

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions: [
        'You write safe, friendly dating profile copy for REVdating, a biker dating app.',
        'Use only the provided user profile and primary bike facts. Do not invent facts.',
        'Do not mention a detail if it was not provided.',
        'Do not include contact details, handles, phone numbers, emails, or external links.',
        'Do not include explicit sexual content, harassment, hate, manipulation, or unsafe riding claims.',
        'Keep every bio option at 500 characters or fewer. Keep the headline short and copy-only.',
        'Return JSON only in the requested schema.',
      ].join(' '),
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify({
                task: 'Generate profile text options from this user-owned profile data.',
                profile: input.profile,
                primary_bike: input.primaryBike,
              }),
            },
          ],
        },
      ],
      max_output_tokens: 900,
      text: {
        format: {
          type: 'json_schema',
          name: 'profile_helper_suggestions',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['short_bio', 'fun_biker_bio', 'serious_dating_bio', 'profile_headline'],
            properties: {
              short_bio: {
                type: 'string',
                description: 'A concise dating bio, 500 characters or fewer.',
              },
              fun_biker_bio: {
                type: 'string',
                description: 'A playful biker-style dating bio, 500 characters or fewer.',
              },
              serious_dating_bio: {
                type: 'string',
                description: 'A sincere dating-focused bio, 500 characters or fewer.',
              },
              profile_headline: {
                type: 'string',
                description: 'A short profile headline. Copy-only; it is not saved automatically.',
              },
            },
          },
        },
      },
    }),
  });

  const payload = await response.json().catch(() => null) as ResponsesApiResponse | null;

  if (!response.ok) {
    throw new OpenAIProfileHelperError(payload?.error?.message ? 'AI helper request failed.' : undefined);
  }

  const outputText = extractOutputText(payload);
  if (!outputText) {
    throw new OpenAIProfileHelperError();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new OpenAIProfileHelperError();
  }

  const result = profileHelperSuggestionsSchema.safeParse(parsed);
  if (!result.success) {
    throw new OpenAIProfileHelperError();
  }

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
