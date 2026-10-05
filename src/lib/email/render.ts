import { escapeHtml } from "../html";

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export type PersonalizationValues = Record<string, string | number | boolean | null | undefined>;

export function flattenPersonalization(
  values: PersonalizationValues,
  customFields?: Record<string, unknown>,
) {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue;
    out[key] = String(value);
  }
  if (customFields) {
    for (const [key, value] of Object.entries(customFields)) {
      if (value === null || value === undefined) continue;
      out[key] = String(value);
    }
  }
  return out;
}

export function renderTemplate(
  template: string,
  vars: Record<string, string>,
  fallbacks: Record<string, string> = {},
  options: { html?: boolean } = {},
) {
  return template.replace(TOKEN_RE, (_, key: string) => {
    const raw = vars[key] ?? fallbacks[key] ?? "";
    return options.html ? escapeHtml(raw) : raw;
  });
}

export function extractVariables(template: string) {
  const found = new Set<string>();
  for (const match of template.matchAll(TOKEN_RE)) {
    found.add(match[1]);
  }
  return [...found];
}

export function renderEmail(input: {
  subject: string;
  preheader?: string | null;
  html: string;
  text: string;
  vars: Record<string, string>;
  fallbacks?: Record<string, string>;
}) {
  const fallbacks = input.fallbacks ?? {};
  return {
    subject: renderTemplate(input.subject, input.vars, fallbacks, { html: false }),
    preheader: input.preheader
      ? renderTemplate(input.preheader, input.vars, fallbacks, { html: false })
      : "",
    html: renderTemplate(input.html, input.vars, fallbacks, { html: true }),
    text: renderTemplate(input.text, input.vars, fallbacks, { html: false }),
  };
}

export function appendUnsubscribeAndIdentity(input: {
  html: string;
  text: string;
  unsubscribeUrl: string;
  companyName: string;
  physicalAddress: string;
}) {
  const footerHtml = `
    <hr style="border:none;border-top:1px solid #e5e5e5;margin:32px 0 16px" />
    <p style="font-size:12px;color:#666;line-height:1.5">
      ${escapeHtml(input.companyName)}<br />
      ${escapeHtml(input.physicalAddress)}<br />
      <a href="${escapeHtml(input.unsubscribeUrl)}">Unsubscribe</a>
    </p>
  `;
  const footerText = `\n\n--\n${input.companyName}\n${input.physicalAddress}\nUnsubscribe: ${input.unsubscribeUrl}\n`;
  return {
    html: `${input.html}${footerHtml}`,
    text: `${input.text}${footerText}`,
  };
}
