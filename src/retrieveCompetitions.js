const puppeteer = require('puppeteer');
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
    let [capacityElement] = await page.$x(
      '//*[@id="resumo"]/table/tbody/tr/td/table/tbody/tr[8]/td'
    );
    let [solicitationsElement] = await page.$x(
      '//*[@id="resumo"]/table/tbody/tr/td/table/tbody/tr[9]/td'
    );

    const [observationElement] = await page.$x(
      '//*[@id="resumo"]/table/tbody/tr/td/table/tbody/tr[4]/th'
    );

    const observation = await page.evaluate(e => e.innerText, observationElement);

    if(observation == "Observações:") {
      [capacityElement] = await page.$x(
        '//*[@id="resumo"]/table/tbody/tr/td/table/tbody/tr[9]/td'
      );

      [solicitationsElement] = await page.$x(
        '//*[@id="resumo"]/table/tbody/tr/td/table/tbody/tr[10]/td'
      );
    }

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

    const studentsPerAvailableSpots =
      Number(solicitationsNumber) / Number(capacityNumber);

    competitions += `${rawSubjectTitle} - ${solicitationsNumber}/${capacityNumber} - Concorrência: ${studentsPerAvailableSpots.toFixed(
      2
    )}`;
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

module.exports = {
  retrieveCompetitions,
};
