/** Which Premium section to open after a purchase (what the user was trying to do on Plans). */
let section: 'messages' | 'crush' | null = null;

export function setReturnSection(next: 'messages' | 'crush' | null) {
  section = next;
}

export function takeReturnSection() {
  const s = section;
  section = null;
  return s;
}
