import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI || "mongodb+srv://mjat3599_db_user:swwPK9In2cYjjc7N@cluster0.ne9jkw8.mongodb.net/?retryWrites=true&w=majority";
const dbName = process.env.MONGODB_DB || "voting";

async function setupIndexes() {
  console.log(`[setup-indexes] Connecting to MongoDB: ${dbName}...`);
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 8000,
  });

  try {
    await client.connect();
    const db = client.db(dbName);
    console.log(`[setup-indexes] Connected successfully. Initializing indexes...`);

    // Ensure collections exist
    const collections = (await db.listCollections().toArray()).map((c) => c.name);
    const requiredCollections = ["surveys", "votes", "user", "session", "account"];
    for (const col of requiredCollections) {
      if (!collections.includes(col)) {
        await db.createCollection(col);
        console.log(`[setup-indexes] Created collection: ${col}`);
      }
    }

    // 1. votes: { surveyId: 1, phoneHash: 1 } unique
    await db.collection("votes").createIndex(
      { surveyId: 1, phoneHash: 1 },
      { unique: true, name: "uniq_survey_phone" }
    );
    console.log("✓ Created unique index on votes: { surveyId: 1, phoneHash: 1 }");

    // 2. votes: { surveyId: 1, ipHash: 1 } unique
    await db.collection("votes").createIndex(
      { surveyId: 1, ipHash: 1 },
      { unique: true, name: "uniq_survey_ip" }
    );
    console.log("✓ Created unique index on votes: { surveyId: 1, ipHash: 1 }");

    // 2b. votes: { surveyId: 1, deviceHash: 1 } unique (Enforce one vote per physical device)
    await db.collection("votes").createIndex(
      { surveyId: 1, deviceHash: 1 },
      { unique: true, name: "uniq_survey_device" }
    );
    console.log("✓ Created unique index on votes: { surveyId: 1, deviceHash: 1 } (One vote per device)");

    // 3. votes: { surveyId: 1, candidateId: 1 }
    await db.collection("votes").createIndex(
      { surveyId: 1, candidateId: 1 },
      { name: "idx_survey_candidate" }
    );
    console.log("✓ Created index on votes: { surveyId: 1, candidateId: 1 }");

    // 4. surveys: { isActive: 1, createdAt: -1 }
    await db.collection("surveys").createIndex(
      { isActive: 1, createdAt: -1 },
      { name: "idx_surveys_active_created" }
    );
    console.log("✓ Created index on surveys: { isActive: 1, createdAt: -1 }");

    // 5. users (Better Auth user collection: "user")
    await db.collection("user").createIndex(
      { email: 1 },
      { unique: true, name: "uniq_user_email" }
    );
    console.log("✓ Created unique index on user: { email: 1 }");

    // 6. sessions: { token: 1 } unique (Better Auth session collection: "session")
    await db.collection("session").createIndex(
      { token: 1 },
      { unique: true, name: "uniq_session_token" }
    );
    console.log("✓ Created unique index on session: { token: 1 }");

    // 7. sessions: { expiresAt: 1 } with expireAfterSeconds: 0 (TTL index)
    await db.collection("session").createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, name: "ttl_session_expires" }
    );
    console.log("✓ Created TTL index on session: { expiresAt: 1 }");

    console.log("\n[setup-indexes] All database indexes created successfully!");
  } catch (error) {
    console.error("[setup-indexes] Error configuring indexes:", error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

setupIndexes();
