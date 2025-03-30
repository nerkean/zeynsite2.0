const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
    userId: String,
    amount: Number,
    depositDate: Date,
    interestRate: Number,
    isWithdrawn: Boolean,
  });
  
const Deposit = mongoose.model('Deposit', depositSchema);

 module.exports = Deposit;
