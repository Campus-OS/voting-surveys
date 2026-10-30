import { ImageResponse } from "next/og";
import { ObjectId } from "mongodb";
import { getCollection } from "@/lib/mongodb";
import type { SurveyDoc, VoteDoc } from "@/lib/types";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const regularFont = readFile(
  join(process.cwd(), "public/assets/fonts/NotoSansDevanagari-Regular.ttf")
);

const boldFont = readFile(
  join(process.cwd(), "public/assets/fonts/NotoSansDevanagari-Bold.ttf")
);

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
  const [regular, bold] = await Promise.all([regularFont, boldFont]);

  try {
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
            fontFamily: '"Noto Sans Devanagari", sans-serif',
          }}
        >
          {/* Title (single child — safe) */}
          <div style={{ fontSize: 22, opacity: 0.7 }}>{survey.name}</div>

          {/* Big survey name (single child — safe) */}
          <div
            style={{
              fontSize: 52,
              fontWeight: 700,
              marginTop: 8,
              lineHeight: 1.1,
              display: "flex",        // 👈 explicit for safety
            }}
          >
            {survey.name}
          </div>

          {/* Total votes — multi-child → MUST be flex */}
          <div
            style={{
              marginTop: 24,
              fontSize: 22,
              opacity: 0.85,
              display: "flex",        // 👈 FIX
              flexDirection: "row",   // 👈 explicit row (default, but Satori wants it)
              gap: 8,
            }}
          >
            <span>कुल</span>
            <span>{total}</span>
            <span>वोट दर्ज</span>
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
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                  }}
                >
                  <div style={{ width: 240, fontSize: 26 }}>{c.name}</div>

                  <div
                    style={{
                      flex: 1,
                      height: 26,
                      background: "#1e293b",
                      borderRadius: 13,
                      overflow: "hidden",
                      display: "flex",     // 👈 extra safety
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.max(2, pct)}%`,
                        height: "100%",
                        background: palette[i % palette.length],
                        display: "flex",   // 👈 extra safety
                      }}
                    />
                  </div>

                  {/* Votes · Percent — multi-child → MUST be flex */}
                  <div
                    style={{
                      width: 160,
                      fontSize: 22,
                      display: "flex",         // 👈 FIX
                      justifyContent: "flex-end",
                      gap: 6,
                    }}
                  >
                    <span>{c.votes}</span>
                    <span>·</span>
                    <span>{pct.toFixed(1)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [
          {
            name: "Noto Sans Devanagari",
            data: regular,
            weight: 400,
            style: "normal",
          },
          {
            name: "Noto Sans Devanagari",
            data: bold,
            weight: 700,
            style: "normal",
          },
        ],
      }
    );
  } catch (err) {
    console.error("OG image failed:", err);
    return new Response("Image generation failed", { status: 500 });
  }
}