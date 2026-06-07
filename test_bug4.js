const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require("fs");

let html = fs.readFileSync("index.html", "utf8");
html = html.replace('function loadItems() {', 'function loadItems() { console.log("loadItems called");');
html = html.replace('function defaultItems() {', 'function defaultItems() { console.log("defaultItems called");');
html = html.replace('function renderDreams() {', 'function renderDreams() { console.log("renderDreams called");');
html = html.replace('function calcularTudo() {', 'function calcularTudo() { console.log("calcularTudo called");');
html = html.replace('function addItem(cat, nome=\'\', data=\'\', valor=\'\', done=false) {', 'function addItem(cat, nome=\'\', data=\'\', valor=\'\', done=false) { console.log("addItem called", {cat, nome});');
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
    window.console.log = (...args) => console.log("WINDOW:", ...args);
  }
});

setTimeout(() => {
  console.log("final storage:", dom.window.localStorage.getItem("cvData_v4"));
}, 1000);
