const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require("fs");

let html = fs.readFileSync("index.html", "utf8");

html = html.replace('function loadLang() {', 'function loadLang() { console.log("loadLang called");');
html = html.replace('function applyTranslations() {', 'function applyTranslations() { console.log("applyTranslations called");');
html = html.replace('function calcularTudo() {', 'function calcularTudo() { console.log("calcularTudo called");');
html = html.replace('function saveItems() {', 'function saveItems() { console.log("saveItems called, current input salario:", document.getElementById("salario").value);');

const mockStorage = {
  'cvData_v4': JSON.stringify({
    "historico":[],
    "sonhos":[],
    "items":{
      "fixo":[{"nome":"Aluguel","date":"","valor":"600","done":false}],
      "lazer":[],
      "invest":[]
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
    window.console.log = (...args) => console.log("WINDOW:", ...args);
  }
});

setTimeout(() => {
  console.log("storage finally:", dom.window.localStorage.getItem("cvData_v4"));
}, 1000);
