import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    type: {
      type: String,
      required: true,
      enum: ['income', 'expense'],
    },
    color: {
      type: String,
      default: '#9B8AFB',
    },
    icon: {
      type: String,
      default: 'circle',
    },
    isDefault: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

categorySchema.index({ name: 1, type: 1 }, { unique: true });

export const Category = mongoose.model('Category', categorySchema);

