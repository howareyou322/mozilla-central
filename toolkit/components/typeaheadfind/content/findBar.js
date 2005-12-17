# -*- Mode: HTML -*-
# ***** BEGIN LICENSE BLOCK *****
# Version: MPL 1.1/GPL 2.0/LGPL 2.1
#
# The contents of this file are subject to the Mozilla Public License Version
# 1.1 (the "License"); you may not use this file except in compliance with
# the License. You may obtain a copy of the License at
# http://www.mozilla.org/MPL/
#
# Software distributed under the License is distributed on an "AS IS" basis,
# WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
# for the specific language governing rights and limitations under the
# License.
#
# The Original Code is mozilla.org viewsource frontend.
# 
# The Initial Developer of the Original Code is
# Netscape Communications Corporation.
# Portions created by the Initial Developer are Copyright (C) 2003
# the Initial Developer.  All Rights Reserved.
# 
# Contributor(s):
#     Blake Ross <blake@cs.stanford.edu> (Original Author)
#     Masayuki Nakano <masayuki@d-toybox.com>
#     Ben Basson <contact@cusser.net>
#     Jason Barnabe <jason_barnabe@fastmail.fm>
#
# Alternatively, the contents of this file may be used under the terms of
# either the GNU General Public License Version 2 or later (the "GPL"), or
# the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
# in which case the provisions of the GPL or the LGPL are applicable instead
# of those above. If you wish to allow use of your version of this file only
# under the terms of either the GPL or the LGPL, and not to allow others to
# use your version of this file under the terms of the MPL, indicate your
# decision by deleting the provisions above and replace them with the notice
# and other provisions required by the LGPL or the GPL. If you do not delete
# the provisions above, a recipient may use your version of this file under
# the terms of any one of the MPL, the GPL or the LGPL.
#
#***** END LICENSE BLOCK ***** -->

const FIND_NORMAL = 0;
const FIND_TYPEAHEAD = 1;
const FIND_LINKS = 2;

const CHAR_CODE_SPACE = " ".charCodeAt(0);
const CHAR_CODE_SLASH = "/".charCodeAt(0);
const CHAR_CODE_APOSTROPHE = "'".charCodeAt(0);

/*
 * WARNING:
 * Don't define global variables and functions in this file. Because this file
 * is included by some files. So, the global name space is not safety.
 *
 * But we need global functions for the Timer Event Handlers or for the Event
 * Listener Handlers. In this case, we MUST define global functions with
 * "findBar_" prefix.
 */

var gFindBar = {
  mFindMode: FIND_NORMAL,
  mFoundLink: null,
  mCurrentWindow: null,
  mTmpOutline: null,
  mTmpOutlineOffset: "0",
  mDrawOutline: false,
  mQuickFindTimeout: null,
  mQuickFindTimeoutLength: 0,
  mHighlightTimeout: null,
  mUseTypeAheadFind: false,
  mWrappedToTopStr: "",
  mWrappedToBottomStr: "",
  mNotFoundStr: "",
  mFlashFindBar: 0,
  mFlashFindBarCount: 6,
  mFlashFindBarTimeout: null,
  mLastHighlightString: "",
  mTypeAheadLinksOnly: false,
  mIsIMEComposing: false,
  mTextToSubURIService: null,

  // DOMRange used during highlighting
  mSearchRange: null,
  mStartPt: null,
  mEndPt: null,

  mTypeAheadFind: {
    useTAFPref: "accessibility.typeaheadfind",
    searchLinksPref: "accessibility.typeaheadfind.linksonly",

    observe: function(aSubject, aTopic, aPrefName)
    {
      if (aTopic != "nsPref:changed" ||
          (aPrefName != this.useTAFPref && aPrefName != this.searchLinksPref))
        return;

      var prefService =
        Components.classes["@mozilla.org/preferences-service;1"]
                  .getService(Components.interfaces.nsIPrefBranch);

      gFindBar.mUseTypeAheadFind =
        prefService.getBoolPref("accessibility.typeaheadfind");
      gFindBar.mTypeAheadLinksOnly =
        prefService.getBoolPref("accessibility.typeaheadfind.linksonly");
    }
  },

  initFindBar: function ()
  {
    getBrowser().addEventListener("keypress",
                                  findBar_OnBrowserKeyPress, false);
    getBrowser().addEventListener("mouseup",
                                  findBar_OnBrowserMouseUp, false);

    var prefService =
      Components.classes["@mozilla.org/preferences-service;1"]
                .getService(Components.interfaces.nsIPrefBranch);

    var pbi = prefService.QueryInterface(Components.interfaces.nsIPrefBranch2);

    this.mQuickFindTimeoutLength =
      prefService.getIntPref("accessibility.typeaheadfind.timeout");
    this.mFlashFindBar =
      prefService.getIntPref("accessibility.typeaheadfind.flashBar");

    pbi.addObserver(this.mTypeAheadFind.useTAFPref,
                    this.mTypeAheadFind, false);
    pbi.addObserver(this.mTypeAheadFind.searchLinksPref,
                    this.mTypeAheadFind, false);
    this.mUseTypeAheadFind =
      prefService.getBoolPref("accessibility.typeaheadfind");
    this.mTypeAheadLinksOnly =
      prefService.getBoolPref("accessibility.typeaheadfind.linksonly");

    var fastFind = getBrowser().fastFind;
    fastFind.focusLinks = true;

    var findField = document.getElementById("find-field");
    findField.addEventListener("dragdrop", findBar_OnDrop, true);

    this.mTextToSubURIService =
      Components.classes["@mozilla.org/intl/texttosuburi;1"]
                .getService(Components.interfaces.nsITextToSubURI);
  },

  mFindbarObserver: {
    onDrop: function (aEvent, aXferData, aDragSession)
    {
        var findField = document.getElementById("find-field");
        findField.value = aXferData.data;
        gFindBar.find(aXferData.data);
    },
    getSupportedFlavours: function ()
    {
      var flavourSet = new FlavourSet();
      flavourSet.appendFlavour("text/unicode");
      return flavourSet;
    }
  },

  uninitFindBar: function ()
  {
    var prefService =
      Components.classes["@mozilla.org/preferences-service;1"]
                .getService(Components.interfaces.nsIPrefBranch);

    var pbi = prefService.QueryInterface(Components.interfaces.nsIPrefBranch2);
    pbi.removeObserver(this.mTypeAheadFind.useTAFPref,
                       this.mTypeAheadFind);
    pbi.removeObserver(this.mTypeAheadFind.searchLinksPref,
                       this.mTypeAheadFind);

    getBrowser().removeEventListener("keypress",
                                     findBar_OnBrowserKeyPress, false);
    getBrowser().removeEventListener("mouseup",
                                     findBar_OnBrowserMouseUp, false);
  },

  toggleHighlight: function (aHighlight)
  {
    var word = document.getElementById("find-field").value;
    if (aHighlight) {
      this.highlightDoc('yellow', 'black', word);
    } else {
      this.highlightDoc(null, null, null);
      this.mLastHighlightString = null;
    }
  },

  highlightDoc: function (highBackColor, highTextColor, word, win)
  {
    if (!win)
      win = window._content; 

    for (var i = 0; win.frames && i < win.frames.length; i++) {
      this.highlightDoc(highBackColor, highTextColor, word, win.frames[i]);
    }

    var doc = win.document;
    if (!document)
      return;

    if (!("body" in doc))
      return;

    var body = doc.body;

    var count = body.childNodes.length;
    this.mSearchRange = doc.createRange();
    this.mStartPt = doc.createRange();
    this.mEndPt = doc.createRange();

    this.mSearchRange.setStart(body, 0);
    this.mSearchRange.setEnd(body, count);

    this.mStartPt.setStart(body, 0);
    this.mStartPt.setEnd(body, 0);
    this.mEndPt.setStart(body, count);
    this.mEndPt.setEnd(body, count);

    if (!highBackColor) {
      // Remove highlighting.  We use the find API again rather than
      // searching for our span elements by id so that we gain access to the
      // anonymous content that nsIFind searches.

      if (!this.mLastHighlightString)
        return;

      var retRange = null;
      var finder = Components.classes["@mozilla.org/embedcomp/rangefind;1"]
                             .createInstance()
                             .QueryInterface(Components.interfaces.nsIFind);

      while ((retRange = finder.Find(this.mLastHighlightString,
                                     this.mSearchRange, this.mStartPt,
                                     this.mEndPt))) {
        var startContainer = retRange.startContainer;
        var elem = null;
        try {
          elem = startContainer.parentNode;
        }
        catch (e) { }

        if (elem && elem.getAttribute("id") == "__firefox-findbar-search-id") {
          var child = null;
          var docfrag = doc.createDocumentFragment();
          var next = elem.nextSibling;
          var parent = elem.parentNode;

          while ((child = elem.firstChild)) {
            docfrag.appendChild(child);
          }

          this.mStartPt = doc.createRange();
          this.mStartPt.setStartAfter(elem);

          parent.removeChild(elem);
          parent.insertBefore(docfrag, next);
          parent.normalize();
        }
        else {
          // Somehow we didn't highlight this instance; just skip it.
          this.mStartPt = doc.createRange();
          this.mStartPt.setStart(retRange.endContainer, retRange.endOffset);
        }

        this.mStartPt.collapse(true);
      }
      return;
    }

    var baseNode = doc.createElement("span");
    baseNode.setAttribute("style", "background-color: " + highBackColor + "; " +
                                   "color: " + highTextColor + "; " +
                                   "display: inline; font-size: inherit;" +
                                   " padding: 0;");
    baseNode.setAttribute("id", "__firefox-findbar-search-id");

    this.highlightText(word, baseNode);
  },

  highlightText: function (word, baseNode)
  {
    var retRange = null;
    var finder = Components.classes["@mozilla.org/embedcomp/rangefind;1"]
                           .createInstance()
                           .QueryInterface(Components.interfaces.nsIFind);

    finder.caseSensitive =
      document.getElementById("find-case-sensitive").checked;

    var textFound = false;
    while((retRange = finder.Find(word, this.mSearchRange,
                                  this.mStartPt, this.mEndPt))) {
      // Highlight
      var nodeSurround = baseNode.cloneNode(true);
      var node = this.highlight(retRange, nodeSurround);
      this.mStartPt = node.ownerDocument.createRange();
      this.mStartPt.setStart(node, node.childNodes.length);
      this.mStartPt.setEnd(node, node.childNodes.length);

      textFound = true;
    }

    // We have to update the status because we might still have the status
    // of another tab (bug 313653)
    this.updateStatus(textFound ? Components.interfaces.nsITypeAheadFind.FIND_FOUND : 
                      Components.interfaces.nsITypeAheadFind.FIND_NOTFOUND, false);

    this.mLastHighlightString = word;
  },

  highlight: function (range, node)
  {
    var startContainer = range.startContainer;
    var startOffset = range.startOffset;
    var endOffset = range.endOffset;
    var docfrag = range.extractContents();
    var before = startContainer.splitText(startOffset);
    var parent = before.parentNode;
    node.appendChild(docfrag);
    parent.insertBefore(node, before);
    return node;
  },

  getSelectionControllerForFindToolbar: function (ds)
  {
    try {
      var display =
        ds.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
          .getInterface(Components.interfaces.nsISelectionDisplay);
    }
    catch (e) { return null; }
    return display.QueryInterface(Components.interfaces.nsISelectionController);
  },

  toggleCaseSensitivity: function (aCaseSensitive)
  {
    var fastFind = getBrowser().fastFind;
    fastFind.caseSensitive = aCaseSensitive;
    
    if (this.mFindMode != FIND_NORMAL)
      this.setFindCloseTimeout();
  },

  changeSelectionColor: function (aAttention)
  {
    try {
      var ds = getBrowser().docShell;
    } catch(e) {
      // If we throw here, the browser we were in is already destroyed.
      // See bug 273200.
      return;
    }
    var dsEnum = ds.getDocShellEnumerator(
                      Components.interfaces.nsIDocShellTreeItem.typeContent,
                      Components.interfaces.nsIDocShell.ENUMERATE_FORWARDS);
    while (dsEnum.hasMoreElements()) {
      ds = dsEnum.getNext().QueryInterface(Components.interfaces.nsIDocShell);
      var controller = this.getSelectionControllerForFindToolbar(ds);
      if (!controller)
        continue;
      const selCon = Components.interfaces.nsISelectionController;
      controller.setDisplaySelection(aAttention ?
                                       selCon.SELECTION_ATTENTION :
                                       selCon.SELECTION_ON);
    }
  },

  openFindBar: function ()
  {
    if (!this.mNotFoundStr || !this.mWrappedToTopStr ||
        !this.mWrappedToBottomStr) {
      var bundle = document.getElementById("bundle_findBar");
      this.mNotFoundStr = bundle.getString("NotFound");
      this.mWrappedToTopStr = bundle.getString("WrappedToTop");
      this.mWrappedToBottomStr = bundle.getString("WrappedToBottom");
    }

    var findToolbar = document.getElementById("FindToolbar");
    if (findToolbar.hidden) {
      findToolbar.hidden = false;

      var statusIcon = document.getElementById("find-status-icon");
      var statusText = document.getElementById("find-status");
      var findField = document.getElementById("find-field");
      findField.removeAttribute("status");
      statusIcon.removeAttribute("status");
      statusText.value = "";

      return true;
    }
    return false;
  },

  focusFindBar: function ()
  {
    var findField = document.getElementById("find-field");
    findField.focus();    
  },

  selectFindBar: function ()
  {
    var findField = document.getElementById("find-field");
    findField.select();    
  },

  closeFindBar: function ()
  {
    // ensure the dom is ready...
    setTimeout(findBar_DelayedCloseFindBar, 0);
  },

  fireKeypressEvent: function (target, evt)
  {
    if (!target)
      return;
    var event = document.createEvent("KeyEvents");
    event.initKeyEvent(evt.type, evt.canBubble, evt.cancelable,
                       evt.view, evt.ctrlKey, evt.altKey, evt.shiftKey,
                       evt.metaKey, evt.keyCode, evt.charCode);
    target.dispatchEvent(event);
  },

  updateStatusBar: function ()
  {
    var xulBrowserWindow = window.XULBrowserWindow;
    if (!xulBrowserWindow)
      return false;

    if (!this.mFoundLink || !this.mFoundLink.href ||
        this.mFoundLink.href == "") {
      xulBrowserWindow.setOverLink("");
      return true;
    }

    var docCharset = "";
    var ownerDoc = this.mFoundLink.ownerDocument;
    if (ownerDoc)
      docCharset = ownerDoc.characterSet;

    var url =
      this.mTextToSubURIService.unEscapeURIForUI(docCharset,
                                                 this.mFoundLink.href);
    xulBrowserWindow.setOverLink(url);

    return true;
  },

  setFoundLink: function (foundLink)
  {
    if (this.mFoundLink == foundLink)
      return;

    if (this.mFoundLink && this.mDrawOutline) {
      // restore original outline
      this.mFoundLink.style.outline = this.mTmpOutline;
      this.mFoundLink.style.outlineOffset = this.mTmpOutlineOffset;
    }
    this.mDrawOutline = (foundLink && this.mFindMode != FIND_NORMAL);
    if (this.mDrawOutline) {
      // backup original outline
      this.mTmpOutline = foundLink.style.outline;
      this.mTmpOutlineOffset = foundLink.style.outlineOffset;
      // draw pseudo focus rect
      // XXX Should we change the following style for FAYT pseudo focus?
      // XXX Shouldn't we change default design if outline is visible already?
      foundLink.style.outline = "1px dotted invert";
      foundLink.style.outlineOffset = "0";
    }

    this.mFoundLink = foundLink;

    // We should update status bar. But we need delay. If the mouse cursor is
    // on the document, the status bar text is changed by mouse event that is
    // fired by scroll event. So, we need to change the status bar text after
    // mouse event.
    if (this.mFindMode != FIND_NORMAL)
      setTimeout(findBar_UpdateStatusBar, 0);
  },

  finishFAYT: function (aKeypressEvent)
  {
    try {
      if (this.mFoundLink)
        this.mFoundLink.focus();
      else if (this.mCurrentWindow)
        this.mCurrentWindow.focus();
      else
        return false;
    }
    catch(e) {
      return false;
    }

    // NOTE: In this time, gFoundLink and gCurrentWindow are set null.
    // Because find toolbar lost focus.

    if (aKeypressEvent)
      aKeypressEvent.preventDefault();

    this.closeFindBar();
    return true;
  },

  delayedCloseFindBar: function ()
  {
    var findField = document.getElementById("find-field");
    var findToolbar = document.getElementById("FindToolbar");
    var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                       .getService(Components.interfaces.nsIWindowWatcher);

    if (window == ww.activeWindow) { 
      var focusedElement = document.commandDispatcher.focusedElement;
      if (focusedElement && focusedElement.parentNode &&
            (focusedElement.parentNode == findToolbar ||
             focusedElement.parentNode.parentNode == findField)) {
        // block scrolling on focus since find already scrolls, further
        // scrolling is due to user action, so don't override this
        var suppressedScroll = document.commandDispatcher.suppressFocusScroll;
        document.commandDispatcher.suppressFocusScroll = true;
        // We MUST reset suppressFocusScroll.
        try {
          if (this.mFoundLink)
            this.mFoundLink.focus();
          else if (this.mCurrentWindow)
            this.mCurrentWindow.focus();
          else
            window.content.focus();
        }
        catch(e) {
          // Retry to set focus.
          try {
            window.content.focus();
          }
          catch(e) { /* We lose focused element! */ }
        }
        document.commandDispatcher.suppressFocusScroll = suppressedScroll;
      }
    }

    findToolbar.hidden = true;
    this.setFindMode(FIND_NORMAL);
    this.setFoundLink(null);
    this.mCurrentWindow = null;
    this.changeSelectionColor(false);
    if (this.mQuickFindTimeout) {
      clearTimeout(this.mQuickFindTimeout);
      this.mQuickFindTimeout = null;    
    }
  },

  shouldFastFind: function (evt)
  {
    if (evt.ctrlKey || evt.altKey || evt.metaKey || evt.getPreventDefault())
      return false;

    var elt = document.commandDispatcher.focusedElement;
    if (elt) {
      if (elt instanceof HTMLInputElement) {
        // block FAYT when an <input> textfield element is focused
        var inputType = elt.type;
        switch (inputType) {
          case "text":
          case "password":
          case "file":
            return false;
        }
      }
      else if (elt instanceof HTMLTextAreaElement ||
               elt instanceof HTMLSelectElement ||
               elt instanceof HTMLIsIndexElement)
        return false;
    }

    // disable FAYT in about:config and about:blank to prevent FAYT opening
    // unexpectedly - to fix bugs 264562, 267150, 269712
    var url = getBrowser().currentURI.spec;
    if (url == "about:blank" || url == "about:config")
      return false;

    var win = document.commandDispatcher.focusedWindow;
    if (win && win.document.designMode == "on")
      return false;

    return true;
  },

  onFindBarBlur: function ()
  {
    this.changeSelectionColor(false);
    this.setFoundLink(null);
    this.mCurrentWindow = null;
  },

  onBrowserMouseUp: function (evt)
  {
    var findToolbar = document.getElementById("FindToolbar");
    if (!findToolbar.hidden && this.mFindMode != FIND_NORMAL)
      this.closeFindBar();
  },

  onBrowserKeyPress: function (evt)
  {
    // Check focused elt
    if (!this.shouldFastFind(evt))
      return;

    var findField = document.getElementById("find-field");
    if (this.mFindMode != FIND_NORMAL && this.mQuickFindTimeout) {
      if (!evt.charCode)
        return;
      this.selectFindBar();
      this.focusFindBar();
      this.fireKeypressEvent(findField.inputField, evt);
      evt.preventDefault();
      return;
    }

    if (evt.charCode == CHAR_CODE_APOSTROPHE ||
        evt.charCode == CHAR_CODE_SLASH ||
        (this.mUseTypeAheadFind &&
         evt.charCode && evt.charCode != CHAR_CODE_SPACE)) {
      var findMode =
        (evt.charCode == CHAR_CODE_APOSTROPHE ||
        (this.mTypeAheadLinksOnly && evt.charCode != CHAR_CODE_SLASH)) ?
          FIND_LINKS : FIND_TYPEAHEAD;
      this.setFindMode(findMode);
      if (this.openFindBar()) {
        this.setFindCloseTimeout();
        this.selectFindBar();
        this.focusFindBar();
        findField.value = "";
        if (this.mUseTypeAheadFind &&
            evt.charCode != CHAR_CODE_APOSTROPHE &&
            evt.charCode != CHAR_CODE_SLASH)
          this.fireKeypressEvent(findField.inputField, evt);
        evt.preventDefault();
      }
      else {
        this.selectFindBar();
        this.focusFindBar();
        if (this.mFindMode != FIND_NORMAL) {
          findField.value = "";
          if (evt.charCode != CHAR_CODE_APOSTROPHE &&
              evt.charCode != CHAR_CODE_SLASH)
            this.fireKeypressEvent(findField.inputField, evt);
          evt.preventDefault();
        }
      }
    }
  },

  onFindBarKeyPress: function (evt)
  {
    if (evt.keyCode == KeyEvent.DOM_VK_RETURN) {
      if (this.mFindMode == FIND_NORMAL) {
        var findString = document.getElementById("find-field");
        if (!findString.value)
          return;

#ifdef XP_MACOSX
        if (evt.metaKey) {
#else
        if (evt.ctrlKey) {
#endif
          document.getElementById("highlight").click();
          return;
        }

        if (evt.shiftKey)
          this.findPrevious();
        else
          this.findNext();
      }
      else {
        if (this.mFoundLink) {
          var tmpLink = this.mFoundLink;
          if (this.finishFAYT(evt))
            this.fireKeypressEvent(tmpLink, evt);
        }
      }
    }
    else if (evt.keyCode == KeyEvent.DOM_VK_TAB) {
      var shouldHandle = !evt.altKey && !evt.ctrlKey && !evt.metaKey;
      if (shouldHandle && this.mFindMode != FIND_NORMAL &&
          this.finishFAYT(evt)) {
        if (evt.shiftKey)
          document.commandDispatcher.rewindFocus();
        else
          document.commandDispatcher.advanceFocus();
      }
    }
    else if (evt.keyCode == KeyEvent.DOM_VK_ESCAPE) {
      this.closeFindBar();
      evt.preventDefault();
    } 
    else if (evt.keyCode == KeyEvent.DOM_VK_PAGE_UP) {
      window.top._content.scrollByPages(-1);
      evt.preventDefault();
    }
    else if (evt.keyCode == KeyEvent.DOM_VK_PAGE_DOWN) {
      window.top._content.scrollByPages(1);
      evt.preventDefault();
    }
    else if (evt.keyCode == KeyEvent.DOM_VK_UP) {
      window.top._content.scrollByLines(-1);
      evt.preventDefault();
    }
    else if (evt.keyCode == KeyEvent.DOM_VK_DOWN) {
      window.top._content.scrollByLines(1);
      evt.preventDefault();
    }
  },

  enableFindButtons: function (aEnable)
  {
    var findNext = document.getElementById("find-next");
    var findPrev = document.getElementById("find-previous");
    var highlight = document.getElementById("highlight");
    findNext.disabled = findPrev.disabled = highlight.disabled = !aEnable;
  },

  updateFoundLink: function (res)
  {
    var val = document.getElementById("find-field").value;
    if (res == Components.interfaces.nsITypeAheadFind.FIND_NOTFOUND || !val) {
      this.setFoundLink(null);
      this.mCurrentWindow = null;
    } else {
      this.setFoundLink(getBrowser().fastFind.foundLink);
      this.mCurrentWindow = getBrowser().fastFind.currentWindow;
    }
  },

  find: function (val)
  {
    if (!val)
      val = document.getElementById("find-field").value;

    this.enableFindButtons(val);

    var highlightBtn = document.getElementById("highlight");
    if (highlightBtn.checked)
      this.setHighlightTimeout();

    this.changeSelectionColor(true);

    var fastFind = getBrowser().fastFind;
    var res = fastFind.find(val, this.mFindMode == FIND_LINKS);
    this.updateFoundLink(res);
    this.updateStatus(res, true);

    if (this.mFindMode != FIND_NORMAL)
      this.setFindCloseTimeout();
  },

  flashFindBar: function ()
  {
    var findToolbar = document.getElementById("FindToolbar");
    if (this.mFlashFindBarCount-- == 0) {
      clearInterval(this.mFlashFindBarTimeout);
      findToolbar.removeAttribute("flash");
      this.mFlashFindBarCount = 6;
      return;
    }
   
    findToolbar.setAttribute("flash",
                             (this.mFlashFindBarCount % 2 == 0) ?
                             "false" : "true");
  },

  onFindCmd: function ()
  {
    this.setFindMode(FIND_NORMAL);
    this.openFindBar();
    if (this.mFlashFindBar) {
      this.mFlashFindBarTimeout = setInterval(this.flashFindBar, 500);
      var prefService =
            Components.classes["@mozilla.org/preferences-service;1"]
                      .getService(Components.interfaces.nsIPrefBranch);

      prefService.setIntPref("accessibility.typeaheadfind.flashBar",
                             --this.mFlashFindBar);
    }
    this.selectFindBar();
    this.focusFindBar();
  },

  onFindAgainCmd: function ()
  {
    var findString = getBrowser().findString;
    if (!findString) {
      this.onFindCmd();
      return;
    }

    var res = this.findNext();
    if (res == Components.interfaces.nsITypeAheadFind.FIND_NOTFOUND) {
      if (this.openFindBar()) {
        this.focusFindBar();
        this.selectFindBar();
        if (this.mFindMode != FIND_NORMAL)
          this.setFindCloseTimeout();

        this.updateStatus(res, true);
      }
    }
  },

  onFindPreviousCmd: function ()
  {
    var findString = getBrowser().findString;
    if (!findString) {
      this.onFindCmd();
      return;
    }

    var res = this.findPrevious();
    if (res == Components.interfaces.nsITypeAheadFind.FIND_NOTFOUND) {
      if (this.openFindBar()) {
        this.focusFindBar();
        this.selectFindBar();
        if (this.mFindMode != FIND_NORMAL)
          this.setFindCloseTimeout();

        this.updateStatus(res, false);
      }
    }
  },

  setHighlightTimeout: function ()
  {
    if (this.mHighlightTimeout)
      clearTimeout(this.mHighlightTimeout);
    this.mHighlightTimeout =
      setTimeout(function() {
                   gFindBar.toggleHighlight(false);
                   gFindBar.toggleHighlight(true);
                 }, 500);  
  },

  isFindBarVisible: function ()
  {
    var findBar = document.getElementById("FindToolbar");
    return !findBar.hidden;
  },

  findNext: function ()
  {
    this.changeSelectionColor(true);

    var fastFind = getBrowser().fastFind; 
    var res = fastFind.findNext();  
    this.updateFoundLink(res);
    this.updateStatus(res, true);

    if (this.mFindMode != FIND_NORMAL && this.isFindBarVisible())
      this.setFindCloseTimeout();

    return res;
  },

  findPrevious: function ()
  {
    this.changeSelectionColor(true);

    var fastFind = getBrowser().fastFind;
    var res = fastFind.findPrevious();
    this.updateFoundLink(res);
    this.updateStatus(res, false);

    if (this.mFindMode != FIND_NORMAL && this.isFindBarVisible())
      this.setFindCloseTimeout();

    return res;
  },

  updateStatus: function (res, findNext)
  {
    var findBar = document.getElementById("FindToolbar");
    var field = document.getElementById("find-field");
    var statusIcon = document.getElementById("find-status-icon");
    var statusText = document.getElementById("find-status");
    switch(res) {
      case Components.interfaces.nsITypeAheadFind.FIND_WRAPPED:
        statusIcon.setAttribute("status", "wrapped");      
        statusText.value =
          findNext ? this.mWrappedToTopStr : this.mWrappedToBottomStr;
        break;
      case Components.interfaces.nsITypeAheadFind.FIND_NOTFOUND:
        statusIcon.setAttribute("status", "notfound");
        statusText.value = this.mNotFoundStr;
        field.setAttribute("status", "notfound");      
        break;
      case Components.interfaces.nsITypeAheadFind.FIND_FOUND:
      default:
        statusIcon.removeAttribute("status");      
        statusText.value = "";
        field.removeAttribute("status");
        break;
    }
  },

  setFindCloseTimeout: function ()
  {
    if (this.mQuickFindTimeout)
      clearTimeout(this.mQuickFindTimeout);

    // Don't close the find toolbar while IME is composing.
    if (this.mIsIMEComposing) {
      this.mQuickFindTimeout = null;
      return;
    }

    this.mQuickFindTimeout =
      setTimeout(function() {
                   if (gFindBar.mFindMode != FIND_NORMAL)
                     gFindBar.closeFindBar();
                 },
                 this.mQuickFindTimeoutLength);
  },

  findBarOnDrop: function (evt)
  {
    nsDragAndDrop.drop(evt, this.mFindbarObserver);
  },

  onFindBarCompositionStart: function (evt)
  {
    this.mIsIMEComposing = true;
    // Don't close the find toolbar while IME is composing.
    if (this.mQuickFindTimeout) {
      clearTimeout(this.mQuickFindTimeout);
      this.mQuickFindTimeout = null;
    }
  },

  onFindBarCompositionEnd: function (evt)
  {
    this.mIsIMEComposing = false;
    if (this.mFindMode != FIND_NORMAL && this.isFindBarVisible())
      this.setFindCloseTimeout();
  },

  setFindMode: function (mode)
  {
    if (mode == this.mFindMode)
      return;

    this.mFindMode = mode;
  }
};

// ================
//  Event Handlers
// ================
function findBar_OnDrop(aEvt)
{
  gFindBar.findBarOnDrop(aEvt);
}

function findBar_OnBrowserKeyPress(aEvt)
{
  gFindBar.onBrowserKeyPress(aEvt);
}

function findBar_OnBrowserMouseUp(aEvt)
{
  gFindBar.onBrowserMouseUp(aEvt);
}

// ======================
//  Timer Event Handlers
// ======================
function findBar_DelayedCloseFindBar()
{
  gFindBar.delayedCloseFindBar();
}

function findBar_UpdateStatusBar()
{
  gFindBar.updateStatusBar();
}
