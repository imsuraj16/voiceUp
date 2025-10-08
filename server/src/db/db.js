const mongoose = require('mongoose');
const config = require('../config/config')


const connectDb = async()=>{

    try {
        await mongoose.connect(config.MONGO_URI);
        console.log("Connected to db");
    } catch (error) {
        console.log("Error while connecting to db", error);
        
    }
}

module.exports = connectDb;