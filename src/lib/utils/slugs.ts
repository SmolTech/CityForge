/**
 * Generate a URL-friendly slug from text
 * Based on the Flask backend helper function
 */
export function generateSlug(text: string): string {
  // Convert to lowercase and remove non-word characters except spaces and hyphens
  let slug = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim();

  // Replace multiple spaces or hyphens with single hyphen
  slug = slug.replace(/[-\s]+/g, "-");

  // Remove leading/trailing hyphens
  return slug.replace(/^-+|-+$/g, "");
}
