const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require("fs");

const html = fs.readFileSync("index.html", "utf8");

const mockStorage = {
  'cvData_v4': JSON.stringify({
    "historico":[],
    "sonhos":[],
    "items":{
      "fixo":[],
      "lazer":[],
      "invest":[]
    },
    "config":{"salario":"5000","pctFixo":"50","pctInvest":"20","mode":"pct"}
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

  console.log("salario value is:", document.getElementById("salario").value);
  console.log("cvData_v4 in storage is:", window.localStorage.getItem("cvData_v4"));
}, 1000);
