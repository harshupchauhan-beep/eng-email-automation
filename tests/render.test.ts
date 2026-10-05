import { describe, expect, it } from "vitest";
import { flattenPersonalization, renderEmail, renderTemplate } from "../src/lib/email/render";

describe("template rendering", () => {
  it("escapes HTML variables and uses fallbacks", () => {
    const html = renderTemplate(
      "<p>Hello {{firstName}}</p>",
      { firstName: "<script>alert(1)</script>" },
      {},
      { html: true },
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("does not break when a variable is missing", () => {
    const result = renderEmail({
      subject: "Hi {{firstName}}",
      html: "<p>{{missing}}</p>",
      text: "Hello {{firstName}}",
      vars: {},
      fallbacks: { firstName: "there" },
    });
    expect(result.subject).toBe("Hi there");
    expect(result.html).toBe("<p></p>");
  });

  it("flattens custom fields", () => {
    const vars = flattenPersonalization({ firstName: "Ada" }, { plan: "pro" });
    expect(vars.firstName).toBe("Ada");
    expect(vars.plan).toBe("pro");
  });
});
