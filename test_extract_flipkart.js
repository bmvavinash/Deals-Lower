const { scrapePage } = require('./pageScheduler');

async function run() {
  const url = 'https://dl.flipkart.com/dl/trust-usa-model-523-inspire-personal-digital-electronic-body-weight-machine-human-180kg-capacity-weighing-scale/p/itmb3a6f89a0d2f9?pid=WSLG8M2YNRWUFRCK&lid=LSTWSLG8M2YNRWUFRCKZVKSOX&marketplace=FLIPKART&_refId=&_appId=WA';
  try {
    const data = await scrapePage(url);
    console.log(JSON.stringify(data, null, 2));
  } catch(e) {
    console.error(e);
  }
}
run();
