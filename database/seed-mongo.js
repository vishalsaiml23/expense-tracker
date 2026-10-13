import 'dotenv/config';
import mongoose from 'mongoose';
import { Category } from '../server/src/models/Category.js';
import { defaultCategories } from '../server/src/db.js';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smart_expense_tracker';

async function seed() {
  try {
    console.log(`Connecting to MongoDB at ${uri}...`);
    await mongoose.connect(uri);

    console.log('Seeding default categories...');
    for (const cat of defaultCategories) {
      await Category.findOneAndUpdate(
        { name: cat.name, type: cat.type },
        { $set: cat },
        { upsert: true, returnDocument: 'after' }
      );
    }

    const total = await Category.countDocuments();
    console.log(`Successfully verified and seeded ${total} categories into MongoDB.`);
  } catch (error) {
    console.error('Error seeding MongoDB:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
