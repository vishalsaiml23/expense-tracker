import mongoose from 'mongoose';
import { Category } from './models/Category.js';

export const defaultCategories = [
  { name: 'Food', type: 'expense', color: '#F2A178', icon: 'utensils' },
  { name: 'Travel', type: 'expense', color: '#6C9CE6', icon: 'plane' },
  { name: 'Shopping', type: 'expense', color: '#C28AE8', icon: 'shopping-bag' },
  { name: 'Education', type: 'expense', color: '#74B7A3', icon: 'book-open' },
  { name: 'Bills', type: 'expense', color: '#E6B85C', icon: 'receipt' },
  { name: 'Healthcare', type: 'expense', color: '#E77F8A', icon: 'heart-pulse' },
  { name: 'Entertainment', type: 'expense', color: '#8D88E8', icon: 'clapperboard' },
  { name: 'Other', type: 'expense', color: '#8C9AA8', icon: 'circle' },
  { name: 'Salary', type: 'income', color: '#55AA88', icon: 'briefcase' },
  { name: 'Freelancing', type: 'income', color: '#6C9CE6', icon: 'laptop' },
  { name: 'Business', type: 'income', color: '#C28AE8', icon: 'building' },
  { name: 'Investment', type: 'income', color: '#E6B85C', icon: 'trending-up' },
  { name: 'Other', type: 'income', color: '#8C9AA8', icon: 'circle' },
];

export async function connectMongo(uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/smart_expense_tracker') {
  try {
    await mongoose.connect(uri);
    console.log(`Connected to MongoDB: ${mongoose.connection.name}`);

    // Seed default categories if collection is empty
    const count = await Category.countDocuments();
    if (count === 0) {
      await Category.insertMany(defaultCategories);
      console.log('Seeded default expense & income categories into MongoDB.');
    }
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    throw error;
  }
}

export default connectMongo;

