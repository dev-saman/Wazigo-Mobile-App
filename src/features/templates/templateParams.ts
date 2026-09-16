import { MessageLimits, type MessageTemplate } from '@/api/types';

/**
 * Template variables, worked out defensively.
 *
 * `variable_counts` is the server's own answer and is trusted first; when it is
 * missing the placeholders in the text are counted instead, so a template still
 * renders a usable form rather than sending unfilled `{{1}}` to a customer.
 */

export type TemplateSection = 'header' | 'body';

const PLACEHOLDER = /\{\{\s*([\w.-]+)\s*\}\}/g;

/** Placeholder names in order of first appearance: `1`, `2`, or `name`. */
export function placeholdersIn(text?: string | null): string[] {
  if (!text) return [];
  const found: string[] = [];
  for (const match of text.matchAll(PLACEHOLDER)) {
    const token = match[1];
    if (!found.includes(token)) found.push(token);
  }
  return found;
}

const textFor = (template: MessageTemplate, section: TemplateSection) =>
  section === 'header' ? template.header_text : template.body_text;

/** How many parameters this section needs, capped at the documented maximum. */
export function parameterCount(template: MessageTemplate, section: TemplateSection): number {
  const declared = template.variable_counts?.[section];
  const count =
    typeof declared === 'number' && Number.isFinite(declared) && declared >= 0
      ? declared
      : placeholdersIn(textFor(template, section)).length;
  return Math.min(count, MessageLimits.templateParamsMax);
}

/** Labels for the inputs: the server's tokens when it sent them, else a number. */
export function parameterLabels(template: MessageTemplate, section: TemplateSection): string[] {
  const count = parameterCount(template, section);
  const tokens = template.variable_tokens?.[section];
  const placeholders = placeholdersIn(textFor(template, section));

  return Array.from({ length: count }, (_, index) => {
    const token = Array.isArray(tokens) ? tokens[index] : undefined;
    const fallback = placeholders[index];
    const name = (typeof token === 'string' && token.trim()) || fallback;
    return name && !/^\d+$/.test(name) ? name : `Variable ${index + 1}`;
  });
}

export const templateHasParameters = (template: MessageTemplate) =>
  parameterCount(template, 'header') + parameterCount(template, 'body') > 0;

/** Substitutes filled values so the user sees what the customer will receive. */
export function renderTemplateText(
  text: string | null | undefined,
  values: string[],
  labels: string[],
): string {
  if (!text) return '';
  let index = 0;
  return text.replace(PLACEHOLDER, (match, token: string) => {
    const byName = labels.findIndex((label) => label === token);
    const position = byName >= 0 ? byName : /^\d+$/.test(token) ? Number(token) - 1 : index;
    index += 1;
    const value = values[position];
    return value?.trim() ? value : match;
  });
}

export type TemplateParamError = { section: TemplateSection; index: number; message: string };

/**
 * WhatsApp rejects a template with an empty or over-long variable, so it is
 * checked here rather than sent and bounced.
 */
export function validateParameters(values: string[], section: TemplateSection): TemplateParamError[] {
  const errors: TemplateParamError[] = [];

  values.forEach((value, index) => {
    const trimmed = value.trim();
    if (!trimmed) {
      errors.push({ section, index, message: 'This value is required.' });
    } else if (trimmed.length > MessageLimits.templateParamLengthMax) {
      errors.push({
        section,
        index,
        message: `Keep this under ${MessageLimits.templateParamLengthMax} characters.`,
      });
    }
  });

  return errors;
}

/** Trimmed values in the order CHAT-08 expects. */
export const toParams = (values: string[]): string[] =>
  values.slice(0, MessageLimits.templateParamsMax).map((value) => value.trim());
