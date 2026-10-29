import { MongoClient, type Db, type Collection } from "mongodb";
import { env } from "./env";
import { logger } from "./logger";

const uri = env.MONGODB_URI;

const options = {
  maxPoolSize: 50,
  minPoolSize: 5,
  maxIdleTimeMS: 30000,
  connectTimeoutMS: 10000,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  var _mongoClient: MongoClient | undefined;
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClient || !global._mongoClientPromise) {
    global._mongoClient = new MongoClient(uri, options);
    global._mongoClientPromise = global._mongoClient.connect().then((c) => {
      logger.info("MongoDB client connected (dev singleton)");
      return c;
    }).catch((err) => {
      logger.error("MongoDB connection error (dev singleton)", err);
      throw err;
    });
  }
  client = global._mongoClient;
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect().then((c) => {
    logger.info("MongoDB client connected (prod)");
    return c;
  }).catch((err) => {
    logger.error("MongoDB connection error (prod)", err);
    throw err;
  });
}

export const mongoClient = client;
export const mongoDb = client.db(env.MONGODB_DB);

export async function getDatabase(dbName?: string): Promise<Db> {
  const c = await clientPromise;
  return c.db(dbName || env.MONGODB_DB);
}

export async function getCollection<T extends import("mongodb").Document>(
  name: string,
  dbName?: string
): Promise<Collection<T>> {
  const db = await getDatabase(dbName);
  return db.collection<T>(name);
}

export default clientPromise;
