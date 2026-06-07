const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require("fs");

let html = fs.readFileSync("index.html", "utf8");

html = html.replace('saveItems();', 'saveItems(); console.log("addItem saved items. current input salario:", document.getElementById("salario").value);');

// The bug is that `applyTranslations` calls `calcularTudo` which calls `saveItems`.
// BUT it's also called by `loadLang`, which happens BEFORE `loadItems`. Wait, no:
// `window.onload = () => { loadTheme(); loadLang(); ... loadItems(); ... applyTranslations(); }`
// But wait! `applyTranslations` modifies placeholders:
// `document.querySelectorAll('.item-name').forEach(el => el.placeholder = L.itemDescPh);`
// wait, `loadLang()` also calls `applyTranslations()`.
// `applyTranslations` calls `calcularTudo()`.
// `calcularTudo` calls `saveItems()`.
// So inside `window.onload`, we first call `loadLang()` which calls `applyTranslations()` which calls `calcularTudo()` which calls `saveItems()`.
// BUT `loadItems` hasn't been called yet!!! So the DOM is empty. And the input value for `salario` hasn't been set by `dInit.config` yet!!!
// In fact, the HTML has `value="2000"` for `salario`. So `saveItems()` saves an empty list of items, and the default `salario` of `2000`, wiping out the config.

console.log("Bug identified. Let's verify by checking the sequence in window.onload");
