/** Utility views that are not implemented in the compact popup open in the full report. */
export function navigatePopupDestination(
  id: string,
  navigateInPopup: (id: string) => void,
  openInReport: (section: string) => void,
) {
  if (id === "ai-integrations") openInReport(id);
  else navigateInPopup(id);
}
