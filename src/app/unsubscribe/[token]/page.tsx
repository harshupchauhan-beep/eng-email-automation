import { processUnsubscribeToken } from "@/lib/email/process-unsubscribe";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (token === "test") {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Unsubscribe</CardTitle>
          </CardHeader>
          <CardContent>This was a test message. No list change was required.</CardContent>
        </Card>
      </div>
    );
  }
  const result = await processUnsubscribeToken(token);
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>{result.ok ? "You are unsubscribed" : "Unsubscribe link invalid"}</CardTitle>
        </CardHeader>
        <CardContent>
          {result.ok
            ? "You will no longer receive marketing email from this organization."
            : result.error}
        </CardContent>
      </Card>
    </div>
  );
}
