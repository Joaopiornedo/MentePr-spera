const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require("fs");

let html = fs.readFileSync("index.html", "utf8");

// Initial state WITH config, simulating an existing user
const mockStorage = {
  'cvData_v4': JSON.stringify({
    "historico":[],
    "sonhos":[],
    "items":{
      "fixo":[{"nome":"🏠 Aluguel / Habitação","date":"","valor":"600","done":false},{"nome":"🛒 Supermercado","date":"","valor":"300","done":false}],
      "lazer":[{"nome":"🍕 Restaurantes / Delivery","date":"","valor":"150","done":false}],
      "invest":[{"nome":"💡 Fundo de Emergência","date":"","valor":"200","done":false}]
    },
    "config":{"salario":"8888","pctFixo":"50","pctInvest":"20","mode":"pct"}
  })
};

const dom = new JSDOM(html, {
  url: "http://localhost/",
  runScripts: "dangerously",
  resources: "usable",
  beforeParse(window) {
    window.localStorage.getItem = (k) => mockStorage[k] || null;
    window.localStorage.setItem = (k, v) => mockStorage[k] = v;
  }
});

setTimeout(() => {
  const window = dom.window;
  const document = window.document;

  console.log("salario initially:", document.getElementById("salario").value);
  console.log("storage initially:", window.localStorage.getItem("cvData_v4"));
}, 1000);
