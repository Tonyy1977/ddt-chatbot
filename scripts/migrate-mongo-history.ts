// scripts/migrate-mongo-history.ts
// Migrates chat history from MongoDB to Supabase
// Usage: npx tsx scripts/migrate-mongo-history.ts

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { MongoClient } = await import('mongodb');
const { db, chats, messages } = await import('../db');
const { eq } = await import('drizzle-orm');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('Set MONGODB_URI in .env.local before running this script');
  process.exit(1);
}

async function migrate() {
  // 1. Connect to MongoDB
  console.log('Connecting to MongoDB...');
  const mongo = new MongoClient(MONGODB_URI!);
  await mongo.connect();
  const mongoDb = mongo.db(); // uses default DB from connection string

  // 2. List all collections and their counts
  const collections = await mongoDb.listCollections().toArray();
  console.log(`\nDatabase: "${mongoDb.databaseName}"`);
  console.log(`Collections found: ${collections.length}`);
  for (const col of collections) {
    const count = await mongoDb.collection(col.name).countDocuments();
    console.log(`  - ${col.name}: ${count} documents`);
  }
  console.log('');

  // 3. Find the right collection (try common names)
  const tryNames = ['messages', 'chats', 'conversations', 'chat_messages'];
  let collectionName = '';
  for (const name of tryNames) {
    const count = await mongoDb.collection(name).countDocuments();
    if (count > 0) {
      collectionName = name;
      break;
    }
  }

  if (!collectionName) {
    // Fall back to first non-system collection with documents
    for (const col of collections) {
      const count = await mongoDb.collection(col.name).countDocuments();
      if (count > 0) {
        collectionName = col.name;
        break;
      }
    }
  }

  if (!collectionName) {
    console.log('No collections with documents found.');
    await mongo.close();
    process.exit(0);
  }

  console.log(`Using collection: "${collectionName}"`);
  const collection = mongoDb.collection(collectionName);

  // Show a sample document so we can see the field names
  const sample = await collection.findOne();
  console.log(`\nSample document fields: ${Object.keys(sample || {}).join(', ')}`);
  console.log('Sample:', JSON.stringify(sample, null, 2).slice(0, 500));
  console.log('');

  const allMessages = await collection.find({}).sort({ createdAt: 1 }).toArray();
  console.log(`Found ${allMessages.length} messages in "${collectionName}"\n`);

  if (allMessages.length === 0) {
    console.log('No messages to migrate.');
    await mongo.close();
    process.exit(0);
  }

  // 3. Group messages by sessionId
  const sessionMap = new Map<string, typeof allMessages>();
  for (const msg of allMessages) {
    const sid = msg.sessionId || msg.session_id || 'unknown';
    if (!sessionMap.has(sid)) sessionMap.set(sid, []);
    sessionMap.get(sid)!.push(msg);
  }
  console.log(`Found ${sessionMap.size} unique sessions\n`);

  let chatCount = 0;
  let msgCount = 0;
  let errorCount = 0;

  // 4. Migrate each session
  for (const [sessionId, sessionMessages] of sessionMap) {
    try {
      const chatId = `mongo_${sessionId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)}`;
      const firstMsg = sessionMessages[0];
      const lastMsg = sessionMessages[sessionMessages.length - 1];

      // Create chat record
      const firstDate = firstMsg.createdAt || firstMsg.timestamp || new Date();
      const lastDate = lastMsg.createdAt || lastMsg.timestamp || new Date();

      await db.insert(chats).values({
        id: chatId,
        visitorId: sessionId,
        status: 'active',
        metadata: { migratedFrom: 'mongodb' },
        createdAt: new Date(firstDate),
        updatedAt: new Date(lastDate),
      }).onConflictDoNothing();

      chatCount++;

      // Insert messages
      for (let i = 0; i < sessionMessages.length; i++) {
        const msg = sessionMessages[i];
        const msgId = `mongo_msg_${chatId}_${String(i).padStart(4, '0')}`;

        // Map sender/role: MongoDB used 'user'/'bot', Supabase uses 'user'/'assistant'
        let role = msg.role || msg.sender || 'user';
        if (role === 'bot') role = 'assistant';

        const content = msg.content || msg.text || '';
        if (!content) continue;

        const topics = msg.topics || msg.topic ? [msg.topic] : [];
        const createdAt = msg.createdAt || msg.timestamp || new Date();

        await db.insert(messages).values({
          id: msgId,
          chatId,
          role,
          content,
          topics: Array.isArray(topics) ? topics.filter(Boolean) : [],
          metadata: { migratedFrom: 'mongodb', originalId: msg._id?.toString() },
          createdAt: new Date(createdAt),
        }).onConflictDoNothing();

        msgCount++;
      }

      process.stdout.write(`\r  Migrated ${chatCount}/${sessionMap.size} sessions, ${msgCount} messages`);
    } catch (error) {
      errorCount++;
      console.error(`\n  Error migrating session "${sessionId}": ${(error as Error).message}`);
    }
  }

  console.log(`\n\n========================================`);
  console.log(`MongoDB → Supabase Migration Complete!`);
  console.log(`  Sessions: ${chatCount}`);
  console.log(`  Messages: ${msgCount}`);
  console.log(`  Errors:   ${errorCount}`);
  console.log(`========================================\n`);

  await mongo.close();
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
