/**
 * Customer quotes. Only entries with `permission: true` (written permission on file) are
 * rendered. While none are permitted, the testimonials section shows the founder note.
 */
export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  company: string;
  photo?: string;
  /** Optional video testimonial (mp4 in /public). */
  video?: string;
  permission: boolean;
};

export const TESTIMONIALS: Testimonial[] = [];

export function permittedTestimonials(list: Testimonial[] = TESTIMONIALS): Testimonial[] {
  return list.filter((t) => t.permission);
}
