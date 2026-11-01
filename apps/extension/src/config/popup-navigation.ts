/** Keep destinations in the popup when a compact screen exists; otherwise open the report. */
export function navigatePopupDestination(
  id: string,
  hasPopupScreen: boolean,
  navigateInPopup: (id: string) => void,
  openInReport: (section: string) => void,
) {
  if (hasPopupScreen) navigateInPopup(id);
  else openInReport(id);
}
