/** last.fm's sign-up rule: 2–15 characters, starting with a letter; letters, numbers, _ and - only. */
const USERNAME = /^[A-Za-z][A-Za-z0-9_-]{1,14}$/;

export const isValidUsername = (name: string) => USERNAME.test(name);
