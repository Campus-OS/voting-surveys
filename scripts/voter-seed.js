import { MongoClient,ObjectId } from "mongodb";
import * as dotenv from "dotenv";
import * as path from "path";
import crypto from "crypto";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
const MONGO_URI  = process.env.MONGODB_URI;
const DB_NAME    = process.env.MONGODB_DB   || 'voting';
const SURVEY_ID  = '6ae3841629806f348dfc9c69';
const HIRALAL_ID = '5a0b4d58-076d-4c4b-86d8-b689d8051f66';

// ---- rate-limit config -----------------------------------------------------
const WINDOW_MS   = 10_000;   // 10 s rolling window
const MAX_PER_WIN = 10;       // max 10 inserts in that window

// ---- helpers ---------------------------------------------------------------
const sha256  = (s) => crypto.createHash('sha256').update(s).digest('hex');
const randInt = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const sleep   = (ms) => new Promise(r => setTimeout(r, ms));

function makePhone() {
  let r = '';
  for (let i = 0; i < 6; i++) r += randInt(0, 9);
  return '1123' + r;
}

function pointInPolygon(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (((yi > lat) !== (yj > lat)) &&
        (lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

function randomPointInPolygon(polygon) {
  const ring = polygon.coordinates[0];
  const lngs = ring.map(p => p[0]), lats = ring.map(p => p[1]);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  for (let t = 0; t < 5000; t++) {
    const lng = minLng + Math.random() * (maxLng - minLng);
    const lat = minLat + Math.random() * (maxLat - minLat);
    if (pointInPolygon(lng, lat, ring)) return { lat, lng };
  }
  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
}

const randomIp = () =>
  `${randInt(1,223)}.${randInt(0,255)}.${randInt(0,255)}.${randInt(1,254)}`;

// ---- sliding-window limiter -----------------------------------------------
class SlidingWindowLimiter {
  constructor(maxPerWindow, windowMs) {
    this.max  = maxPerWindow;
    this.win  = windowMs;
    this.hits = [];
  }
  _prune(now) {
    while (this.hits.length && now - this.hits[0] >= this.win) this.hits.shift();
  }
  async acquire() {
    while (true) {
      const now = Date.now();
      this._prune(now);
      if (this.hits.length < this.max) { this.hits.push(now); return; }
      const waitMs = this.win - (now - this.hits[0]) + 5;
      await sleep(Math.max(waitMs, 10));
    }
  }
}

// ---- main -----------------------------------------------------------------
async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);

  const surveys = db.collection('surveys');
  const votes   = db.collection('votes');

  await votes.dropIndex('ipHash_text_surveyId_text').catch(() => {});

  const survey = await surveys.findOne({ _id: new ObjectId(SURVEY_ID) });
  if (!survey) throw new Error('Survey not found');
  const polygon = survey.polygon;

  const CAND = {
    hiralal:   HIRALAL_ID,
    mishraram: survey.candidates.find(c => c.name.includes('मिश्राराम')).id,
    hanuman:   survey.candidates.find(c => c.name.includes('हनुमान')).id,
    shravan:   survey.candidates.find(c => c.name.includes('श्रवण')).id,
  };
  console.log('Resolved candidate IDs:', CAND);

  // ---- FINAL PLAN ---------------------------------------------------------
  //  Hiralal   : 170   (winner, +70 over Mishraram ✅)
  //  Mishraram : 100   (2nd)
  //  Hanuman   :  50   (3rd)
  //  Shravan   :  40   (4th)
  //  Sum       = 360 ✅
  const plan = [
    { id: CAND.hiralal,   name: 'Hiralal',   count: 170 },
    { id: CAND.mishraram, name: 'Mishraram', count: 100 },
    { id: CAND.hanuman,   name: 'Hanuman',   count:  50 },
    { id: CAND.shravan,   name: 'Shravan',   count:  40 },
  ];
  const TOTAL = plan.reduce((s, p) => s + p.count, 0);
  console.log('Plan:', plan.map(p => `${p.name}=${p.count}`).join(', '), '| total =', TOTAL);
  if (TOTAL !== 360) throw new Error('Plan total must be 360');
  if (plan[0].count - plan[1].count !== 70) throw new Error('Hiralal must be +70 over Mishraram');

  const del = await votes.deleteMany({ surveyId: SURVEY_ID, dummy: true });
  console.log('Deleted previous dummies:', del.deletedCount);

  // Shuffled flat candidate queue
  const queue = [];
  for (const p of plan) for (let i = 0; i < p.count; i++) queue.push(p.id);
  for (let i = queue.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }

  const usedPhones = new Set();
  const uniquePhone = () => {
    for (let i = 0; i < 200; i++) {
      const p = makePhone();
      if (!usedPhones.has(p)) { usedPhones.add(p); return p; }
    }
    throw new Error('Phone pool exhausted');
  };

  const buildDoc = (candidateId) => {
    const phone    = uniquePhone();
    const loc      = randomPointInPolygon(polygon);
    const deviceId = crypto.randomUUID();
    const ip       = randomIp();
    return {
      surveyId:   SURVEY_ID,
      candidateId,
      phone,
      phoneHash:  sha256(phone),
      location:   loc,
      deviceId,
      deviceHash: sha256(deviceId),
      ip,
      ipHash:     sha256(ip),
      createdAt:  new Date(),
      dummy:      true,
    };
  };

  // ---- insert with strict rolling-window rate limit -----------------------
  const limiter = new SlidingWindowLimiter(MAX_PER_WIN, WINDOW_MS);
  const tStart  = Date.now();
  let inserted  = 0;

  for (const candidateId of queue) {
    await limiter.acquire();           // never >10 inserts per rolling 10s
    await votes.insertOne(buildDoc(candidateId));
    inserted++;

    if (inserted % 10 === 0) {
      const secs = ((Date.now() - tStart) / 1000).toFixed(1);
      console.log(`Inserted ${inserted}/${TOTAL} | elapsed ${secs}s`);
    }
  }

  const totalSecs = ((Date.now() - tStart) / 1000).toFixed(1);
  console.log(`---\nDone. Inserted ${inserted} in ${totalSecs}s`);

  const tally = await votes.aggregate([
    { $match: { surveyId: SURVEY_ID, dummy: true } },
    { $group: { _id: '$candidateId', count: { $sum: 1 } } },
  ]).toArray();

  const nameOf = Object.fromEntries(Object.entries(CAND).map(([k, v]) => [v, k]));
  const rows = tally
    .map(t => ({ candidate: nameOf[t._id] || t._id, count: t.count }))
    .sort((a, b) => b.count - a.count);

  console.log('\nFinal tally (dummy only):');
  console.table(rows);

  await client.close();
}

main().catch(err => { console.error(err); process.exit(1); });