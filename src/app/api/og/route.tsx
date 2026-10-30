import { ImageResponse } from "next/og";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import type { SurveyDoc, VoteDoc } from "@/lib/types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("surveyId");

  if (!id || !/^[0-9a-fA-F]{24}$/.test(id)) {
    return new Response("अमान्य सर्वे आईडी", { status: 400 });
  }

  const surveysCol = await getCollection<SurveyDoc>("surveys");
  const votesCol = await getCollection<VoteDoc>("votes");

  const survey = await surveysCol.findOne({ _id: new ObjectId(id) });
  if (!survey) return new Response("सर्वे नहीं मिला", { status: 404 });

  // सार्वजनिक परिणाम (dummy: true बहिष्कृत)
  const tally = await votesCol
    .aggregate<{ _id: string; count: number }>([
      { $match: { surveyId: id, dummy: { $ne: true } } },
      { $group: { _id: "$candidateId", count: { $sum: 1 } } },
    ])
    .toArray();

  const counts: Record<string, number> = Object.fromEntries(
    tally.map((t) => [t._id, t.count])
  );
  const total = tally.reduce((s, t) => s + t.count, 0);

  const top = [...(survey.candidates ?? [])]
    .map((c) => ({ ...c, votes: counts[c.id] ?? 0 }))
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 4);

  const palette = ["#2563eb", "#dc2626", "#16a34a", "#f59e0b"];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: 60,
          background: "#0f172a",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 22, opacity: 0.7 }}>डिजिटल उड़ान वोटिंग</div>
        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            marginTop: 8,
            lineHeight: 1.1,
          }}
        >
          {survey.name}
        </div>
        <div style={{ marginTop: 24, fontSize: 22, opacity: 0.85 }}>
          कुल {total} वोट दर्ज
        </div>

        <div
          style={{
            marginTop: 32,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {top.map((c, i) => {
            const pct = total ? (c.votes / total) * 100 : 0;
            return (
              <div
                key={c.id}
                style={{ display: "flex", alignItems: "center", gap: 16 }}
              >
                <div style={{ width: 240, fontSize: 26 }}>{c.name}</div>
                <div
                  style={{
                    flex: 1,
                    height: 26,
                    background: "#1e293b",
                    borderRadius: 13,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(2, pct)}%`,
                      height: "100%",
                      background: palette[i % palette.length],
                    }}
                  />
                </div>
                <div
                  style={{
                    width: 160,
                    fontSize: 22,
                    textAlign: "right",
                  }}
                >
                  {c.votes} · {pct.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}