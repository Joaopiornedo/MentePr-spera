const fs = require('fs');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const html = fs.readFileSync('./index.html', 'utf8');

const dom = new JSDOM(html, {
  url: "http://localhost/",
  runScripts: "dangerously"
});

const window = dom.window;
const document = window.document;

// Mock user's previously saved items
const testData = {
  config: { mode: 'val', pctFixo: '60', pctInvest: '30', salario: '5000' },
  items: [ { id: 1, type: 'fixo', desc: 'Rent', val: '1500', due: '5' } ],
  dreams: []
};
window.localStorage.setItem('cvData', JSON.stringify(testData));
window.localStorage.setItem('cvLang', 'en');

// We simulate window.onload
window.onload();

const resultingData = JSON.parse(window.localStorage.getItem('cvData'));
if (resultingData.config.salario !== '5000') {
    console.error("Test failed: localStorage was overwritten on load. Expected 5000, got", resultingData.config.salario);
    process.exit(1);
} else {
    console.log("Test passed: localStorage correctly retained user data.");
}
