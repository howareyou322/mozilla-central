/* vim:set ts=2 sw=2 sts=2 et: */
/*
 * Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/
 */

// Tests that document.body autocompletes in the web console.

function test() {
  addTab("data:text/html;charset=utf-8,Web Console autocompletion bug in document.body");
  browser.addEventListener("load", function onLoad() {
    browser.removeEventListener("load", onLoad, true);
    openConsole(null, consoleOpened);
  }, true);
}

let gHUD;

function consoleOpened(aHud) {
  gHUD = aHud;
  let jsterm = gHUD.jsterm;
  let popup = jsterm.autocompletePopup;
  let completeNode = jsterm.completeNode;

  let tmp = {};
  Cu.import("resource://gre/modules/devtools/WebConsoleUtils.jsm", tmp);
  let WCU = tmp.WebConsoleUtils;
  tmp = null;

  ok(!popup.isOpen, "popup is not open");

  popup._panel.addEventListener("popupshown", function onShown() {
    popup._panel.removeEventListener("popupshown", onShown, false);

    ok(popup.isOpen, "popup is open");

    // |props| values, and the following properties:
    // __defineGetter__  __defineSetter__ __lookupGetter__ __lookupSetter__
    // constructor hasOwnProperty isPrototypeOf propertyIsEnumerable
    // toLocaleString toSource toString unwatch valueOf watch.
    let props = WCU.inspectObject(content.wrappedJSObject.document.body,
                                  function() { });
    is(popup.itemCount, 14 + props.length, "popup.itemCount is correct");

    popup._panel.addEventListener("popuphidden", autocompletePopupHidden, false);

    EventUtils.synthesizeKey("VK_ESCAPE", {});
  }, false);

  jsterm.setInputValue("document.body");
  EventUtils.synthesizeKey(".", {});
}

function autocompletePopupHidden()
{
  let jsterm = gHUD.jsterm;
  let popup = jsterm.autocompletePopup;
  let completeNode = jsterm.completeNode;
  let inputNode = jsterm.inputNode;

  popup._panel.removeEventListener("popuphidden", autocompletePopupHidden, false);

  ok(!popup.isOpen, "popup is not open");
  let inputStr = "document.b";
  jsterm.setInputValue(inputStr);
  EventUtils.synthesizeKey("o", {});
  let testStr = inputStr.replace(/./g, " ") + " ";

  waitForSuccess({
    name: "autocomplete shows document.body",
    validatorFn: function()
    {
      return completeNode.value == testStr + "dy";
    },
    successFn: testPropertyPanel,
    failureFn: finishTest,
  });
}

function testPropertyPanel()
{
  let jsterm = gHUD.jsterm;
  jsterm.clearOutput();
  jsterm.execute("document");

  waitForSuccess({
    name: "jsterm document object output",
    validatorFn: function()
    {
      return gHUD.outputNode.querySelector(".webconsole-msg-output");
    },
    successFn: function()
    {
      jsterm.once("variablesview-fetched", onVariablesViewReady);
      let node = gHUD.outputNode.querySelector(".webconsole-msg-output");
      EventUtils.synthesizeMouse(node, 2, 2, {}, gHUD.iframeWindow);
    },
    failureFn: finishTest,
  });
}

function onVariablesViewReady(aEvent, aView)
{
  findVariableViewProperties(aView, [
    { name: "__proto__.body", value: "[object HTMLBodyElement]" },
  ], { webconsole: gHUD }).then(finishTest);
}

