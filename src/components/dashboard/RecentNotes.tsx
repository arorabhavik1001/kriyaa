import { FileText } from "lucide-react";

interface Note {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
}

const recentNotes: Note[] = [
  { id: "1", title: "Strategic Planning 2025", preview: "Key initiatives for next year including expansion into APAC markets...", updatedAt: "2 hours ago" },
  { id: "2", title: "Product Roadmap Q1", preview: "Feature prioritization based on customer feedback and market analysis...", updatedAt: "Yesterday" },
  { id: "3", title: "Team Restructure Ideas", preview: "Considerations for engineering team growth and new leadership roles...", updatedAt: "2 days ago" },
];

export function RecentNotes() {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h3 className="font-semibold text-foreground">Recent Notes</h3>
        <span className="text-xs text-muted-foreground">{recentNotes.length} notes</span>
      </div>
      <div className="divide-y divide-border">
        {recentNotes.map((note) => (
          <div
            key={note.id}
            className="group cursor-pointer px-6 py-4 transition-all duration-200 hover:bg-accent/50"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-lg bg-secondary p-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground group-hover:text-primary transition-colors">
                  {note.title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                  {note.preview}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{note.updatedAt}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
