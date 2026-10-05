import { Card, CardContent } from "@/components/ui/card";
import { Inbox } from "lucide-react";

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center py-14 text-center">
        <div className="mb-3 rounded-full bg-muted p-3 text-primary">
          <Inbox className="size-5" />
        </div>
        <h2 className="text-base font-medium">{title}</h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}
