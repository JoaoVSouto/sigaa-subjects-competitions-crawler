require('dotenv').config();
const puppeteer = require('puppeteer');
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const PromiseBB = require('bluebird');

async function retrieveCompetitions() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('https://sigaa.ufrn.br/sigaa/verTelaLogin.do');

  const usernameInput = await page.$('#username');
  await usernameInput.type(process.env.SIGAA_USERNAME);

  const passwordInput = await page.$('#password');
  await passwordInput.type(process.env.SIGAA_PASSWORD);

  const loginButton = await page.$('button[value="Submit"]');
  await loginButton.click();

  await page.waitForNavigation();

  const [seeRegistrationOrientations] = await page.$x(
    '//*[@id="main-menu"]/li[1]/ul/li[16]/ul/li[12]/a'
  );
  await page.evaluate(link => link.click(), seeRegistrationOrientations);
  await seeRegistrationOrientations.dispose();

  await page.waitForSelector('#modalModulos');

  const modalTriggerers = await page.$$('[title="Ver Detalhes dessa turma"]');
  const documentBody = await page.$('body');

  let competitions = '';

  await PromiseBB.each(modalTriggerers, async (modalTriggerer, index) => {
    await modalTriggerer.click();
    await page.waitForSelector('#resumo');

    const [subjectElement] = await page.$x(
      '//*[@id="resumo"]/table/tbody/tr/td/table/tbody/tr[3]/td'
    );
    const [capacityElement] = await page.$x(
      '//*[@id="resumo"]/table/tbody/tr/td/table/tbody/tr[8]/td'
    );
    const [solicitationsElement] = await page.$x(
      '//*[@id="resumo"]/table/tbody/tr/td/table/tbody/tr[9]/td'
    );

    const subjectTitle = await page.evaluate(e => e.innerText, subjectElement);
    const capacity = await page.evaluate(e => e.innerText, capacityElement);
    const solicitations = await page.evaluate(
      e => e.innerText,
      solicitationsElement
    );

    const [, rawSubjectTitle] = subjectTitle.split(' - ');

    const [capacityNumber] = capacity.match(/\d+\b/);

    const [solicitationsOnRegistration] = solicitations.split('\n');
    const [solicitationsNumber] = solicitationsOnRegistration.match(/\d+\b/);

    competitions += `${rawSubjectTitle} - ${solicitationsNumber}/${capacityNumber}`;
    if (index !== modalTriggerers.length - 1) {
      competitions += '\n---------\n';
    }

    await subjectElement.dispose();
    await capacityElement.dispose();
    await solicitationsElement.dispose();

    await documentBody.press('Escape');
    await page.waitForTimeout(1000);
  });

  await documentBody.dispose();

  await browser.close();

  return competitions;
}

const client = new Client();

client.on('qr', qr => {
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('Client is ready!');
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
