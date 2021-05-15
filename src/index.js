require('dotenv').config();
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const { retrieveCompetitions } = require('./retrieveCompetitions');

const client = new Client();

client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.info('Client is ready!');
});

let lastRequestTimestamp = null;
const ONE_MINUTE_IN_MS = 1000 * 60;

client.on('message_create', async msg => {
  const isFromDesiredGroup = msg.id.remote === process.env.WHATSAPP_GROUP_ID;
  const isInvalidCommand =
    msg.body.toLowerCase() !== 'como tá a concorrência velho?';

  if (!isFromDesiredGroup || isInvalidCommand) {
    return;
  }

  const isTooEarlyForAnotherRequest = lastRequestTimestamp
    ? Date.now() <= lastRequestTimestamp + ONE_MINUTE_IN_MS
    : false;

  if (isTooEarlyForAnotherRequest) {
    msg.reply('tu acabou de pedir e tu já quer dnv macho? tenha calma...');
    return;
  }

  msg.reply('calma ae man... tô pegando aqui pra tu om...');

  lastRequestTimestamp = Date.now();
  console.info('retrieving competitions...');
  const competitions = await retrieveCompetitions();
  console.info('finished retrieval!');

  msg.reply(competitions);
});

client.initialize();
