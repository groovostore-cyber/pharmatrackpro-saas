require('dotenv').config();
const connectDB = require('../config/db');
const mongoose = require('mongoose');
const User = require('../models/User');
const Shop = require('../models/Shop');

async function run() {
  await connectDB();

  let removedUsers = 0;
  let removedShops = 0;

  try {
    // Find non-superadmin users
    const users = await User.find({ role: { $ne: 'superadmin' } }).select('_id shopId username');

    for (const u of users) {
      const shopId = u.shopId || null;
      if (!shopId) {
        await User.deleteOne({ _id: u._id });
        removedUsers++;
        console.log(`Deleted user ${u._id} (no shop)`);
        continue;
      }

      const shopExists = await Shop.exists({ _id: shopId });
      if (!shopExists) {
        await User.deleteOne({ _id: u._id });
        removedUsers++;
        console.log(`Deleted user ${u._id} (referenced missing shop ${shopId})`);
      }
    }

    // Remove shops that do not have subscription fields configured
    const orphanShops = await Shop.find({
      $or: [
        { subscriptionStatus: { $exists: false } },
        { subscriptionType: { $exists: false } },
      ],
    }).select('_id shopName');

    for (const s of orphanShops) {
      await Shop.deleteOne({ _id: s._id });
      removedShops++;
      console.log(`Deleted shop ${s._id} (${s.shopName || 'no-name'}) missing subscription fields`);
    }

    // Additionally, delete shops that are orphaned (no users reference them)
    const allShops = await Shop.find().select('_id');
    for (const s of allShops) {
      const userCount = await User.countDocuments({ shopId: s._id });
      if (userCount === 0) {
        // Only delete if shop also missing subscription fields to be safe
        const shopDoc = await Shop.findById(s._id).select('subscriptionStatus subscriptionType');
        if (!shopDoc || !shopDoc.subscriptionStatus || !shopDoc.subscriptionType) {
          await Shop.deleteOne({ _id: s._id });
          removedShops++;
          console.log(`Deleted orphan shop ${s._id} (no users and missing subscription)`);
        }
      }
    }

    console.log('Cleanup complete');
    console.log(`Users removed: ${removedUsers}`);
    console.log(`Shops removed: ${removedShops}`);
  } catch (err) {
    console.error('Cleanup failed', err);
  } finally {
    try {
      await mongoose.connection.close();
    } catch (e) {}
    process.exit(0);
  }
}

run();
