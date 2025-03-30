const mongoose = require('mongoose');

const reputationSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    reputation: { type: Number, default: 0, min: -100, max: 100 }, 
});

module.exports = mongoose.model('Reputation', reputationSchema);