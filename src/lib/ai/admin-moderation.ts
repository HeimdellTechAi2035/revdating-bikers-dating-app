import 'server-only';

import { z } from 'zod';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5.4-nano';

export const adminModerationRiskLevelSchema = z.enum(['low', 'medium', 'high']);
export const adminModerationCategorySchema = z.enum([
  'harassment',
  'threat',
  'hate_or_abuse',
  'sexual_pressure',
  'scam_like',
  'money_request',
  'suspicious_link',
  'impersonation',
  'fake_profile',
  'underage_concern',
  'unsafe_meetup_pressure',
  'spam',
  'other',
]);
export const adminModerationRecommendedActionSchema = z.enum([
  'no_action',
  'review_manually',
  'warn_user',
  'restrict_account',
  'suspend_account',
  'escalate',
]);

export const adminModerationSummarySchema = z.object({
  summary: z.string().trim().min(1).max(600),
  risk_level: adminModerationRiskLevelSchema,
  categories: z.array(adminModerationCategorySchema),
  recommended_action: adminModerationRecommendedActionSchema,
  evidence_to_check: z.array(z.string().trim().min(1).max(120)).max(8),
  admin_notes: z.string().trim().min(1).max(800),
  user_facing_message_draft: z.string().trim().min(1).max(500).nullable(),
});

export type AdminModerationSummary = z.infer<typeof adminModerationSummarySchema>;

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
  is_banned: boolean | null;
};

type ReportContext = {
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
  has_reported_photo: boolean;
};

export type AdminModerationInput = {
  report: ReportContext;
  reporterProfile: SafeProfileData | null;
  reportedProfile: SafeProfileData | null;
  reportedContent: {
    type: 'photo' | 'profile_or_message';
    note: string;
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

export class OpenAIAdminModerationConfigurationError extends Error {
  constructor() {
    super('AI admin moderation assistant is not configured.');
    this.name = 'OpenAIAdminModerationConfigurationError';
  }
}

export class OpenAIAdminModerationError extends Error {
  constructor(message = 'AI admin moderation assistant could not generate a summary.') {
    super(message);
    this.name = 'OpenAIAdminModerationError';
  }
}

export async function generateAdminModerationSummary(
  input: AdminModerationInput,
): Promise<AdminModerationSummary> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new OpenAIAdminModerationConfigurationError();

  const model = process.env.OPENAI_ADMIN_MODERATION_MODEL || DEFAULT_MODEL;

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions: [
        'You assist human admins reviewing moderation reports for REVdating, a UK biker dating app.',
        'Use UK English and be concise, practical, and evidence-based.',
        'This is recommendation-only. A human admin must decide what action, if any, to take.',
        'Use only the supplied report context and public-safe profile summaries. Do not infer from missing private data.',
        'Do not claim certainty where evidence is weak, and do not recommend severe action unless the supplied evidence supports it.',
        'Do not include private data, exact locations, contact details, payment details, service secrets, verification documents, full chat history, or unrelated reports.',
        'If evidence is incomplete, recommend review_manually or escalate and list what a human should check.',
        'Only include a user_facing_message_draft when a neutral warning would be appropriate; otherwise return null.',
        'Return JSON only in the requested schema with no extra fields.',
      ].join(' '),
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify({
                task: 'Generate a recommendation-only moderation summary for this report.',
                report: input.report,
                reporter_public_profile_summary: input.reporterProfile,
                reported_user_public_profile_summary: input.reportedProfile,
                reported_content: input.reportedContent,
              }),
            },
          ],
        },
      ],
      max_output_tokens: 1000,
      text: {
        format: {
          type: 'json_schema',
          name: 'admin_moderation_summary',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: [
              'summary',
              'risk_level',
              'categories',
              'recommended_action',
              'evidence_to_check',
              'admin_notes',
              'user_facing_message_draft',
            ],
            properties: {
              summary: {
                type: 'string',
                description: 'Concise moderation summary under 600 characters.',
              },
              risk_level: {
                type: 'string',
                enum: ['low', 'medium', 'high'],
              },
              categories: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: [
                    'harassment',
                    'threat',
                    'hate_or_abuse',
                    'sexual_pressure',
                    'scam_like',
                    'money_request',
                    'suspicious_link',
                    'impersonation',
                    'fake_profile',
                    'underage_concern',
                    'unsafe_meetup_pressure',
                    'spam',
                    'other',
                  ],
                },
              },
              recommended_action: {
                type: 'string',
                enum: ['no_action', 'review_manually', 'warn_user', 'restrict_account', 'suspend_account', 'escalate'],
              },
              evidence_to_check: {
                type: 'array',
                maxItems: 8,
                items: {
                  type: 'string',
                  description: 'Short evidence item a human admin should verify.',
                },
              },
              admin_notes: {
                type: 'string',
                description: 'Concise practical notes for the admin under 800 characters.',
              },
              user_facing_message_draft: {
                type: ['string', 'null'],
                description: 'Neutral warning draft under 500 characters, or null when no warning draft is appropriate.',
              },
            },
          },
        },
      },
    }),
  });

  const payload = await response.json().catch(() => null) as ResponsesApiResponse | null;

  if (!response.ok) {
    throw new OpenAIAdminModerationError(payload?.error?.message ? 'AI admin moderation request failed.' : undefined);
  }

  const outputText = extractOutputText(payload);
  if (!outputText) throw new OpenAIAdminModerationError();

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new OpenAIAdminModerationError();
  }

  const result = adminModerationSummarySchema.safeParse(parsed);
  if (!result.success) throw new OpenAIAdminModerationError();

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
