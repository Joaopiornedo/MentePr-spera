const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require("fs");

let html = fs.readFileSync("index.html", "utf8");

// Initial state WITHOUT config or items, simulating a new user
const mockStorage = {
  'cvData_v4': JSON.stringify({
    "historico":[],
    "sonhos":[],
    "items":{}
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
