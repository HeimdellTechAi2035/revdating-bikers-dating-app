import 'server-only';

import { z } from 'zod';

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_MODEL = 'gpt-5.4-nano';

export const messageSafetyRiskLevelSchema = z.enum(['low', 'medium', 'high']);

export const messageSafetyCategorySchema = z.enum([
  'harassment',
  'threat',
  'hate_or_abuse',
  'sexual_pressure',
  'money_request',
  'suspicious_link',
  'scam_like',
  'manipulation',
  'personal_contact_pressure',
  'unsafe_meetup_pressure',
  'self_harm_or_crisis',
  'other',
]);

export const messageSafetyResultSchema = z.object({
  safe_to_send: z.boolean(),
  risk_level: messageSafetyRiskLevelSchema,
  categories: z.array(messageSafetyCategorySchema),
  warning: z.string().trim().min(1).max(500).nullable(),
  suggested_rewrite: z.string().trim().min(1).max(2000).nullable(),
}).superRefine((result, ctx) => {
  if (result.safe_to_send && result.risk_level !== 'low') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'safe_to_send must only be true for low risk messages',
      path: ['safe_to_send'],
    });
  }

  if (result.risk_level === 'low') {
    if (result.categories.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'low risk messages must not include risk categories',
        path: ['categories'],
      });
    }
    if (result.warning !== null || result.suggested_rewrite !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'low risk messages must not include warnings or rewrites',
      });
    }
  }

  if (!result.safe_to_send && result.risk_level !== 'low' && !result.warning) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'medium and high risk messages require a warning',
      path: ['warning'],
    });
  }
});

export type MessageSafetyResult = z.infer<typeof messageSafetyResultSchema>;

export const LOW_RISK_MESSAGE_SAFETY_RESULT: MessageSafetyResult = {
  safe_to_send: true,
  risk_level: 'low',
  categories: [],
  warning: null,
  suggested_rewrite: null,
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

export class OpenAIMessageSafetyConfigurationError extends Error {
  constructor() {
    super('AI message safety is not configured.');
    this.name = 'OpenAIMessageSafetyConfigurationError';
  }
}

export class OpenAIMessageSafetyError extends Error {
  constructor(message = 'AI message safety could not assess this message.') {
    super(message);
    this.name = 'OpenAIMessageSafetyError';
  }
}

export async function assessMessageSafety(message: string): Promise<MessageSafetyResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new OpenAIMessageSafetyConfigurationError();

  const model = process.env.OPENAI_SAFETY_MODEL || DEFAULT_MODEL;

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      instructions: [
        'You are a pre-send safety reviewer for REVdating, a biker dating app.',
        'Assess only the single message provided. Do not assume chat history, user identity, intent, location, reports, or private profile data.',
        'Flag harassment, threats, hate or abuse, sexual coercion or pressure, money requests, suspicious links, scam-like behaviour, manipulation, pressure to move to personal contact, unsafe meetup pressure, self-harm or crisis content, and other risky dating-app behaviour.',
        'Use low risk for normal friendly, flirty, logistical, or biker-related chat that does not pressure, threaten, exploit, or manipulate anyone.',
        'Use medium risk when the sender should pause, edit, or soften the message but it is not an immediate severe risk.',
        'Use high risk for threats, coercive sexual pressure, hate/abuse, explicit scams, severe manipulation, crisis/self-harm, or clearly unsafe meetup pressure.',
        'Return JSON only in the requested schema. Do not include raw analysis, scores, policy names, or extra fields.',
      ].join(' '),
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify({
                task: 'Assess whether this dating-app chat message is safe to send.',
                message,
              }),
            },
          ],
        },
      ],
      max_output_tokens: 700,
      text: {
        format: {
          type: 'json_schema',
          name: 'message_safety_result',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['safe_to_send', 'risk_level', 'categories', 'warning', 'suggested_rewrite'],
            properties: {
              safe_to_send: {
                type: 'boolean',
                description: 'True only when the message is low risk and can be sent without an interstitial warning.',
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
                    'money_request',
                    'suspicious_link',
                    'scam_like',
                    'manipulation',
                    'personal_contact_pressure',
                    'unsafe_meetup_pressure',
                    'self_harm_or_crisis',
                    'other',
                  ],
                },
              },
              warning: {
                type: ['string', 'null'],
                description: 'A concise user-facing warning for medium/high risk, or null for low risk.',
              },
              suggested_rewrite: {
                type: ['string', 'null'],
                description: 'A safer rewrite that preserves benign intent when possible, or null.',
              },
            },
          },
        },
      },
    }),
  });

  const payload = await response.json().catch(() => null) as ResponsesApiResponse | null;

  if (!response.ok) {
    throw new OpenAIMessageSafetyError(payload?.error?.message ? 'AI message safety request failed.' : undefined);
  }

  const outputText = extractOutputText(payload);
  if (!outputText) throw new OpenAIMessageSafetyError();

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new OpenAIMessageSafetyError();
  }

  const result = messageSafetyResultSchema.safeParse(parsed);
  if (!result.success) throw new OpenAIMessageSafetyError();

  return result.data;
}

function extractOutputText(payload: ResponsesApiResponse | null): string | null {
  if (!payload) return null;
  if (payload.output_text) return payload.output_text;

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.refusal) return null;
      if (content.type === 'output_text' && content.text) return content.text;
    }
  }

  return null;
}
