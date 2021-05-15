require('dotenv').config();

const { initializeWhatsappClient } = require('./whatsappHandler');
const { retrieveCompetitions } = require('./retrieveCompetitions');

const isWhatsAppMode = process.argv.find(arg => arg === '--mode=whatsapp');

if (isWhatsAppMode) {
  initializeWhatsappClient();
} else {
  (async () => {
    console.info('retrieving competitions...\n');
    const competitions = await retrieveCompetitions();
    console.log(competitions);
  })();
}
