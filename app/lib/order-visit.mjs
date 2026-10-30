/**
 * Matches the Apps Script behavior: don't create visits for drafts. A submitted new
 * order completes an existing open visit or creates a no-GPS visit if none is open.
 * Editing an existing order completes an open visit but does not invent a new call.
 */
export function getOrderVisitAction({ isDraft = false, isEdit = false, hasOpenVisit = false } = {}) {
  if (isDraft) return "skip";
  if (hasOpenVisit) return "complete-existing";
  if (isEdit) return "skip";
  return "create-and-complete";
}
