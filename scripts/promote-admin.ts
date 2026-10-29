import { MongoClient } from "mongodb";

const uri =
  process.env.MONGODB_URI ||
  "mongodb+srv://mjat3599_db_user:swwPK9In2cYjjc7N@cluster0.ne9jkw8.mongodb.net/?retryWrites=true&w=majority";
const dbName = process.env.MONGODB_DB || "voting";

const emailArg = process.argv[2];

if (!emailArg) {
  console.error("Usage: node --experimental-strip-types scripts/promote-admin.ts <user-email>");
  process.exit(1);
}

const targetEmail = emailArg.trim().toLowerCase();

async function promoteAdmin() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  try {
    await client.connect();
    const db = client.db(dbName);
    const usersCol = db.collection("user");

    const user = await usersCol.findOne({ email: targetEmail });
    if (!user) {
      console.error(`❌ User with email "${targetEmail}" was not found in database "${dbName}".`);
      console.log(`Please sign up at /register first, then re-run this command.`);
      process.exit(1);
    }

    const result = await usersCol.updateOne(
      { _id: user._id },
      { $set: { role: "admin", updatedAt: new Date() } }
    );

    if (result.modifiedCount > 0 || (user as { role?: string }).role === "admin") {
      console.log(`✅ Successfully promoted "${targetEmail}" to administrator (role: "admin")!`);
    } else {
      console.log(`ℹ️ User "${targetEmail}" is already an administrator.`);
    }
  } catch (err) {
    console.error("Error promoting user:", err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

promoteAdmin();
