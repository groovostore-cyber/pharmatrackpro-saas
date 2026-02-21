const { MongoClient } = require('mongodb');
require('dotenv').config();

async function run() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not set');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const collections = ['customers', 'credits', 'settings', 'sales', 'medicines'];

    for (const name of collections) {
      const coll = db.collection(name);
      try {
        const indexes = await coll.indexes();
        for (const idx of indexes) {
          const keys = idx.key || {};
          if (Object.keys(keys).length === 1 && keys.phone === 1) {
            console.log(`Dropping single-field phone index on ${name}:`, idx.name);
            await coll.dropIndex(idx.name);
          }
        }
      } catch (err) {
        if (err.codeName === 'NamespaceNotFound') continue;
        console.error(`Error checking indexes for ${name}:`, err.message);
      }
    }

    console.log('Index cleanup script completed.');
  } finally {
    await client.close();
  }
}

run().catch((err) => {
  console.error('Script error:', err);
  process.exit(1);
});
