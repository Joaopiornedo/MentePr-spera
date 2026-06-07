const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require("fs");

let html = fs.readFileSync("index.html", "utf8");

const dom = new JSDOM(html, {
  url: "http://localhost/",
  runScripts: "dangerously",
  resources: "usable"
});

setTimeout(() => {
  const window = dom.window;
  const document = window.document;

  // Set the value directly
  document.getElementById("salario").value = "7777";
  window.calcularTudo();

  console.log("storage after:", window.localStorage.getItem("cvData_v4"));
}, 1000);
