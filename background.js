//Event listener for injected.js
chrome.runtime.onMessageExternal.addListener(function (message, sender) {
    if (message.interception) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {interception: true});
        });
        return true;
    }
    return false;
});

chrome.runtime.onMessage.addListener(function (message, sender) {
    chrome.browserAction.setBadgeBackgroundColor({color: [238, 50, 78, 255]});
    chrome.browserAction.setBadgeText({text: message.data});
});
