const hex = (n: number) => n.toString(16);
const nibble = () => Math.floor(Math.random() * 16);

/** RFC 4122 v4 UUID. Used as `client_message_id`, so uniqueness per device is what matters. */
export function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c =>
    hex(c === 'x' ? nibble() : 8 + Math.floor(Math.random() * 4)),
  );
}
