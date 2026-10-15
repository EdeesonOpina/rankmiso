export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(() => {
    if (browser.sidePanel?.setPanelBehavior) {
      void browser.sidePanel
        .setPanelBehavior({ openPanelOnActionClick: false })
        .catch(() => undefined);
    }
  });
});
