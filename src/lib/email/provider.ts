import { getEnv } from "../env";
import { SesAdapter } from "./adapters/ses";
import { SendGridAdapter } from "./adapters/sendgrid";
import { MailgunAdapter } from "./adapters/mailgun";
import { PostmarkAdapter } from "./adapters/postmark";
import { FakeEmailProvider, fakeProvider } from "./adapters/fake";
import type { EmailProviderAdapter } from "./types";

let cached: EmailProviderAdapter | null = null;

export function getEmailProvider(): EmailProviderAdapter {
  if (cached) return cached;
  const name = getEnv().EMAIL_PROVIDER;
  switch (name) {
    case "ses":
      cached = new SesAdapter();
      break;
    case "sendgrid":
      cached = new SendGridAdapter();
      break;
    case "mailgun":
      cached = new MailgunAdapter();
      break;
    case "postmark":
      cached = new PostmarkAdapter();
      break;
    default:
      cached = fakeProvider;
  }
  return cached;
}

export function setEmailProviderForTests(adapter: EmailProviderAdapter | null) {
  cached = adapter;
}

export { FakeEmailProvider, fakeProvider };
