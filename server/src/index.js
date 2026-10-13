require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { app } = require('./app');
const { connectDB } = require('./config/db');

async function startServer() {
  const port = Number(process.env.PORT || 5001);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error('PORT must be an integer between 0 and 65535.');
  }
  await connectDB();
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '0.0.0.0');
    const onError = error => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      console.log(`TechShare API listening on port ${server.address().port}`);
      resolve(server);
    };
    server.once('error', onError);
    server.once('listening', onListening);
  });
}

if (require.main === module) {
  startServer().catch(async error => {
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${process.env.PORT || 5001} is already in use. Stop the other server or change PORT and the client API URL.`);
    } else {
      console.error('Backend startup failed; check PORT and target database configuration.');
    }
    await mongoose.disconnect();
    process.exitCode = 1;
  });
}

module.exports = app;
module.exports.app = app;
module.exports.startServer = startServer;
